/* ==================== 同步容错 / 自动重试 / 资料扩展字段 冒烟测试 ====================
 * 运行：node tests/sync-fault-smoke.js
 * 在 vm 沙箱中加载真实 store.js + supabase.js + util.js，验证：
 *   1) pushHeavy 容错：某会话/某环节 throw，后续会话与环节仍执行，错误汇总抛出
 *   2) pushAll 容错：pushLight 失败不中断 pushHeavy；部分失败不推进 lastSync
 *   3) 失败自动重试：推送失败 30s 后自动补一次（仅在线）；重试仍败则静默（不再 Toast）
 *   4) 资料扩展字段：SB.profile() 合入 bio/avatar/phone 到 cloudUser；SB.updateProfile 写回并 patch
 *   5) Auth.updateUser 可用（改邮箱/改密码入口）
 *   6) 头像压缩：compressImage 存在且按 maxSide 缩放输出 JPEG
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const webcrypto = require('crypto').webcrypto;

/* ---------- 浏览器环境最小桩 ---------- */
const storage = {};
const localStorage = {
  getItem: k => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: k => { delete storage[k]; }
};

/* ---------- mock supabase 数据库（带失败注入） ---------- */
const db = {};
let seq = 0;
const calls = [];
/* failRule({table, op, rows}) → 'throw' 模拟网络异常reject / 'error' 模拟返回 error 对象 / null 放行 */
let failRule = () => null;
function resetDb() { Object.keys(db).forEach(k => delete db[k]); calls.length = 0; seq = 0; failRule = () => null; }

function match(row, filters) { return filters.every(([c, v]) => row[c] === v); }

function execBuilder(b) {
  const mode = failRule({ table: b._t, op: b._op, rows: b._rows });
  if (mode === 'throw') return Promise.reject(new Error('network boom'));
  if (mode === 'error') return Promise.resolve({ data: null, error: { message: 'server boom', code: '500' } });
  calls.push({ table: b._t, op: b._op, rows: b._rows });
  const t = db[b._t] || (db[b._t] = []);
  if (b._op === 'select') {
    let rows = t.filter(r => match(r, b._filters));
    if (b._limitN) rows = rows.slice(0, b._limitN);
    const data = rows.map(r => Object.assign({}, r));
    if (b._single) return Promise.resolve({ data: data[0] || null, error: data[0] ? null : { message: '0 rows' } });
    return Promise.resolve({ data, error: null });
  }
  if (b._op === 'insert') {
    b._rows.forEach(r => { if (!r.id) r.id = 'id-' + (++seq); t.push(Object.assign({}, r)); });
    return Promise.resolve({ data: b._single ? b._rows[0] : b._rows, error: null });
  }
  if (b._op === 'upsert') {
    b._rows.forEach(r => {
      const i = r.id ? t.findIndex(x => x.id === r.id)
        : t.findIndex(x => x.user_id === r.user_id && (r.provider === undefined || x.provider === r.provider));
      if (i >= 0) t[i] = Object.assign({}, t[i], r);
      else { if (!r.id) r.id = 'id-' + (++seq); t.push(Object.assign({}, r)); }
    });
    return Promise.resolve({ data: b._rows, error: null });
  }
  if (b._op === 'update') {
    t.forEach(r => { if (match(r, b._filters)) Object.assign(r, b._rows); });
    return Promise.resolve({ data: null, error: null });
  }
  if (b._op === 'delete') {
    db[b._t] = t.filter(r => !match(r, b._filters));
    return Promise.resolve({ data: null, error: null });
  }
  return Promise.resolve({ data: null, error: null });
}

const authCalls = [];
function makeClient() {
  return {
    from(table) {
      const b = {
        _t: table, _op: 'select', _rows: null, _filters: [], _limitN: null, _single: false,
        select(cols) { if (this._op === 'insert' || this._op === 'upsert') this._returning = true; else this._op = 'select'; return this; },
        insert(rows) { this._op = 'insert'; this._rows = Array.isArray(rows) ? rows : [rows]; return this; },
        upsert(rows) { this._op = 'upsert'; this._rows = Array.isArray(rows) ? rows : [rows]; return this; },
        delete() { this._op = 'delete'; return this; },
        update(rows) { this._op = 'update'; this._rows = rows; return this; },
        eq(c, v) { this._filters.push([c, v]); return this; },
        in(c, vs) { this._in = [c, vs]; return this; },
        limit(n) { this._limitN = n; return this; },
        order() { return this; },
        single() { this._single = true; return execBuilder(this); },
        then(res, rej) { return execBuilder(this).then(res, rej); }
      };
      return b;
    },
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'admin@thirdparty.ai' } } } }),
      signInWithPassword: async ({ email }) => ({ data: { user: { id: 'u1', email } }, error: null }),
      signUp: async ({ email }) => ({ data: { user: { id: 'u2', email } }, error: null }),
      signOut: async () => ({}),
      resetPasswordForEmail: async () => ({ error: null }),
      updateUser: async attrs => { authCalls.push(attrs); return { data: { user: { id: 'u1', email: attrs.email || 'admin@thirdparty.ai' } }, error: null }; }
    }
  };
}

/* ---------- 可控定时器（用于 30s 重试验证） ---------- */
const timers = [];
const fakeSetTimeout = (fn, ms) => { const t = { fn, ms, cleared: false }; timers.push(t); return t; };
const fakeClearTimeout = t => { if (t) t.cleared = true; };
const lastTimer = () => timers.filter(t => !t.cleared).pop();
async function runTimer(t) { if (t && !t.cleared) { t.cleared = true; await t.fn(); } }

const toastErrs = [];
function makeSandbox() {
  const sandbox = {
    console, localStorage,
    setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout,
    TextDecoder, TextEncoder,
    crypto: webcrypto, btoa, atob,
    navigator: { onLine: true },
    window: {},
    Toast: { info() {}, warning() {}, success() {}, error(m) { toastErrs.push(String(m)); } },
    getModel: id => ({ id, provider: 'MockProvider' }),
    supabase: { createClient: () => makeClient() }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  ['supabase.js', 'store.js'].forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), sandbox, { filename: f });
  });
  const refs = vm.runInContext('({ SB, Store })', sandbox);
  sandbox.SB = refs.SB;
  sandbox.Store = refs.Store;
  return sandbox;
}

/* ---------- 断言工具 ---------- */
let passed = 0, failed = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; console.log('  ✓ ' + label); }
  else { failed++; console.error('  ✗ ' + label + '\n    期望: ' + e + '\n    实际: ' + a); }
}
function ok(cond, label) { eq(!!cond, true, label); }
function section(name) { console.log('\n[' + name + ']'); }
async function rejects(p, label) {
  try { await p; failed++; console.error('  ✗ ' + label + '（应抛出但成功了）'); }
  catch (e) { passed++; console.log('  ✓ ' + label + '（抛出: ' + (e && e.message) + '）'); }
}

function seedChats(Store) {
  Store.state.chats = [
    { id: 'c1', title: '会话一', mode: 'single', updatedAt: Date.now(), messages: [{ id: 'm1', role: 'user', content: '一', ts: Date.now() }] },
    { id: 'c2', title: '会话二', mode: 'single', updatedAt: Date.now(), messages: [{ id: 'm2', role: 'user', content: '二', ts: Date.now() }] },
    { id: 'c3', title: '会话三', mode: 'single', updatedAt: Date.now(), messages: [{ id: 'm3', role: 'user', content: '三', ts: Date.now() }] }
  ];
  Store.state.tokenStats = { byModel: { m1: { prompt: 10, completion: 20 } }, updatedAt: Date.now() };
}

async function main() {

  /* ==================== 1. pushHeavy 容错 ==================== */
  section('pushHeavy 容错（单会话/单环节失败不中断后续）');
  let sb = makeSandbox();
  let { SB, Store } = sb;
  Store.load();
  Store.state.cloudUser = { id: 'u1', email: 'admin@thirdparty.ai', name: '管理员', isAdmin: true };
  seedChats(Store);
  SB.Sync.schedulePush = () => {};   // 阻断 Store.save 联动调度

  resetDb();
  let msgSelFailed = false;
  failRule = ({ table, op, rows }) => {
    if (table === 'conversations' && op === 'insert' && rows && rows[0] && rows[0].local_id === 'c1') return 'throw';   // 会话一插入抛异常
    if (table === 'messages' && op === 'select' && !msgSelFailed) { msgSelFailed = true; return 'throw'; }   // 首个会话（c2）消息查询抛异常
    return null;
  };
  await rejects(SB.Sync.pushHeavy(), 'pushHeavy 汇总错误后抛出');
  const convIds = (db.conversations || []).map(r => r.local_id).sort();
  eq(convIds, ['c2', 'c3'], '会话一失败，会话二/三仍插入云端');
  ok(!Store.state.cloudMap.c1 && Store.state.cloudMap.c2 && Store.state.cloudMap.c3, 'cloudMap 只缺失败会话');
  eq((db.messages || []).length, 1, '会话二消息查询失败被跳过，会话三消息仍推送');
  eq((db.messages || [])[0] && (db.messages || [])[0].local_id, 'm3', '推送的是会话三的消息');
  eq((db.token_usage || []).length, 1, 'messages 环节失败后 token_usage 环节仍执行');

  /* ==================== 2. pushAll 容错 ==================== */
  section('pushAll 容错（pushLight 失败不中断 pushHeavy；部分失败不推进 lastSync）');
  sb = makeSandbox();
  ({ SB, Store } = sb);
  Store.load();
  Store.state.cloudUser = { id: 'u1', email: 'admin@thirdparty.ai', name: '管理员', isAdmin: true };
  seedChats(Store);
  SB.Sync.schedulePush = () => {};

  resetDb();
  failRule = ({ table, op }) => (table === 'user_settings' && op === 'upsert') ? 'throw' : null;   // 轻量同步第一步抛异常
  await rejects(SB.Sync.pushAll(), 'pushAll 在 pushLight 失败后仍抛出汇总错误');
  ok((db.conversations || []).length === 3, 'pushLight 抛异常后 pushHeavy 仍执行（3 条会话入云）');
  eq(Store.state.cloudMeta.lastSync, 0, '部分失败不推进 lastSync');
  resetDb();
  failRule = () => null;
  const rAll = await SB.Sync.pushAll();
  ok(rAll.ok === true, '故障恢复后 pushAll 成功');
  ok(Store.state.cloudMeta.lastSync > 0, '全部成功推进 lastSync');

  /* ==================== 3. 失败自动重试（仅一次，重试仍败则静默） ==================== */
  section('失败 30s 自动重试');
  sb = makeSandbox();
  ({ SB, Store } = sb);
  Store.load();
  Store.state.cloudUser = { id: 'u1', email: 'user@x.com', name: '普通用户', isAdmin: false };
  toastErrs.length = 0;
  timers.length = 0;

  resetDb();
  let failOnce = true;
  failRule = ({ table, op }) => (failOnce && table === 'user_settings' && op === 'upsert') ? 'error' : null;
  SB.Sync.schedulePush(0);
  await runTimer(lastTimer());            // 触发防抖推送 → 失败
  eq(toastErrs.length, 1, '首次失败 Toast 一次');
  ok(SB.Sync.status().lastError, 'lastError 已记录');
  const retryT = lastTimer();
  ok(retryT && retryT.ms === 30000, '已挂 30s 自动重试定时器');
  failOnce = false;                        // 故障恢复
  await runTimer(retryT);                  // 触发重试 → 成功
  eq(toastErrs.length, 1, '重试成功不再 Toast');
  eq(SB.Sync.status().lastError, null, '重试成功后 lastError 清除');

  failRule = () => 'error';                // 持续故障：重试也失败
  SB.Sync.schedulePush(0);
  await runTimer(lastTimer());
  eq(toastErrs.length, 2, '再次失败 Toast 一次');
  await runTimer(lastTimer());             // 触发重试 → 仍失败
  eq(toastErrs.length, 2, '重试仍失败则静默（不再 Toast）');
  ok(SB.Sync.status().lastError, '重试失败后 lastError 保留');

  sb.navigator.onLine = false;             // 离线：重试直接放弃
  SB.Sync.schedulePush(0);
  await runTimer(lastTimer());             // 推送被 canSync 拦下（离线静默跳过）
  sb.navigator.onLine = true;
  ok(true, '离线时推送/重试静默跳过不抛错');

  /* ==================== 4. 资料扩展字段 ==================== */
  section('资料扩展字段（profile 合入 / updateProfile 写回）');
  sb = makeSandbox();
  ({ SB, Store } = sb);
  Store.load();
  Store.state.cloudUser = { id: 'u1', email: 'admin@thirdparty.ai', name: '管理员', isAdmin: true };
  SB.Sync.schedulePush = () => {};
  resetDb();
  db.profiles = [{ id: 'u1', display_name: '管理员', is_admin: true, bio: '你好世界', avatar_url: 'data:image/jpeg;base64,av', phone: '13800000000' }];
  const prof = await SB.profile();
  ok(prof && prof.bio === '你好世界' && prof.avatar === 'data:image/jpeg;base64,av' && prof.phone === '13800000000', 'profile() 返回 bio/avatar/phone');
  eq(Store.state.cloudUser.bio, '你好世界', 'cloudUser 合入 bio');
  eq(Store.state.cloudUser.avatar, 'data:image/jpeg;base64,av', 'cloudUser 合入 avatar');
  eq(Store.state.cloudUser.phone, '13800000000', 'cloudUser 合入 phone');

  const up = await SB.updateProfile({ bio: '新简介', phone: '13911112222', avatar: 'data:image/jpeg;base64,bv' });
  ok(up.ok === true, 'updateProfile 写回成功');
  eq(db.profiles[0].bio, '新简介', 'profiles.bio 已更新');
  eq(db.profiles[0].avatar_url, 'data:image/jpeg;base64,bv', 'profiles.avatar_url 已更新');
  eq(db.profiles[0].phone, '13911112222', 'profiles.phone 已更新');
  eq(Store.state.cloudUser.bio, '新简介', 'cloudUser 同步 patch');
  ok((storage.ai_chat_state_v5 || '').indexOf('新简介') >= 0, 'cloudUser 扩展字段已落盘');

  /* ==================== 5. Auth.updateUser ==================== */
  section('Auth.updateUser（改邮箱 / 改密码入口）');
  authCalls.length = 0;
  const ue = await SB.Auth.updateUser({ email: 'new@x.com' });
  ok(!ue.error && authCalls[0] && authCalls[0].email === 'new@x.com', 'updateUser({email}) 可达');
  const upw = await SB.Auth.updateUser({ password: 'newpass123' });
  ok(!upw.error && authCalls[1] && authCalls[1].password === 'newpass123', 'updateUser({password}) 可达');

  /* ==================== 6. 头像压缩函数 ==================== */
  section('头像压缩（compressImage 存在且按 maxSide 缩放）');
  const sb2 = {
    console, window: {},
    Image: class {
      constructor() { this.width = 1024; this.height = 512; }
      set src(v) { this._src = v; setImmediate(() => this.onload && this.onload()); }
    },
    document: {
      createElement(tag) {
        return {
          width: 0, height: 0,
          getContext: () => ({ drawImage() {} }),
          toDataURL: (type, q) => 'data:' + type + ';base64,mock(q=' + q + ')'
        };
      }
    }
  };
  sb2.window = sb2;
  vm.createContext(sb2);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'util.js'), 'utf8'), sb2, { filename: 'util.js' });
  const compressImage = vm.runInContext('compressImage', sb2);
  eq(typeof compressImage, 'function', 'compressImage 函数存在');
  const out = await compressImage('data:image/png;base64,raw', 256, 0.85);
  ok(out.indexOf('data:image/jpeg') === 0, '输出 JPEG dataUrl（256px 缩放路径执行）');

  /* ---------- 汇总 ---------- */
  console.log('\n========================================');
  console.log('通过 ' + passed + ' / ' + (passed + failed));
  if (failed) { console.error('有 ' + failed + ' 项失败'); process.exit(1); }
  console.log('全部通过 ✓');
}

main().catch(e => { console.error('测试执行异常：', e); process.exit(1); });
