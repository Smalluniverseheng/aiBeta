/* ==================== Supabase 云端同步冒烟测试 ====================
 * 运行：node tests/sb-smoke.js
 * 在 vm 沙箱中模拟浏览器环境（mock window.supabase 的 UMD 客户端）加载真实
 * store.js + supabase.js，验证：
 *   1) 账号别名映射：1234/admin → 管理员邮箱；邮箱原样；其他走本地
 *   2) 设置白名单过滤：只挑白名单小字段，apiKeys/chats 等绝不进 settings
 *   3) 分级逻辑：isAdmin=false 时 pushHeavy 跳过（conversations/messages 零调用），
 *      isAdmin=true 时全量推送并维护 cloudMap
 *   4) 密码派生密钥 AES-GCM 加密/解密闭环；Key 行落库的是密文
 *   5) SDK 缺失 / 离线 / 未登录云 三种降级均静默不抛错
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

/* ---------- mock supabase 数据库 ---------- */
const db = {};
let seq = 0;
const calls = [];   // {table, op, rows}
function resetDb() { Object.keys(db).forEach(k => delete db[k]); calls.length = 0; seq = 0; }

function match(row, filters) { return filters.every(([c, v]) => row[c] === v); }

function execBuilder(b) {
  calls.push({ table: b._t, op: b._op, rows: b._rows });
  const t = db[b._t] || (db[b._t] = []);
  if (b._op === 'select') {
    let rows = t.filter(r => match(r, b._filters));
    if (b._in) rows = rows.filter(r => b._in[1].includes(r[b._in[0]]));
    if (b._limitN) rows = rows.slice(0, b._limitN);
    const data = rows.map(r => Object.assign({}, r));
    if (b._single) return { data: data[0] || null, error: data[0] ? null : { message: '0 rows' } };
    return { data, error: null };
  }
  if (b._op === 'insert') {
    b._rows.forEach(r => { if (!r.id) r.id = 'id-' + (++seq); t.push(Object.assign({}, r)); });
    return { data: b._single ? b._rows[0] : b._rows, error: null };
  }
  if (b._op === 'upsert') {
    b._rows.forEach(r => {
      const i = r.id ? t.findIndex(x => x.id === r.id)
        : t.findIndex(x => x.user_id === r.user_id && (r.provider === undefined || x.provider === r.provider));
      if (i >= 0) t[i] = Object.assign({}, t[i], r);
      else { if (!r.id) r.id = 'id-' + (++seq); t.push(Object.assign({}, r)); }
    });
    return { data: b._rows, error: null };
  }
  if (b._op === 'delete') {
    const keep = t.filter(r => !match(r, b._filters));
    db[b._t] = keep;
    return { data: null, error: null };
  }
  if (b._op === 'update') {
    t.forEach(r => { if (match(r, b._filters)) Object.assign(r, b._rows); });
    return { data: null, error: null };
  }
  return { data: null, error: null };
}

function makeClient() {
  return {
    from(table) {
      const b = {
        _t: table, _op: 'select', _rows: null, _filters: [], _in: null, _limitN: null, _single: false,
        // 真实 supabase-js 中 insert/upsert 后的 .select() 表示「返回写入行」，不改变操作
        select(cols) { if (this._op === 'insert' || this._op === 'upsert') this._returning = true; else this._op = 'select'; return this; },
        insert(rows) { this._op = 'insert'; this._rows = Array.isArray(rows) ? rows : [rows]; return this; },
        upsert(rows) { this._op = 'upsert'; this._rows = Array.isArray(rows) ? rows : [rows]; return this; },
        delete() { this._op = 'delete'; return this; },
        update(rows) { this._op = 'update'; this._rows = rows; return this; },
        eq(c, v) { this._filters.push([c, v]); return this; },
        in(c, vs) { this._in = [c, vs]; return this; },
        limit(n) { this._limitN = n; return this; },
        order() { return this; },
        single() { this._single = true; return Promise.resolve(execBuilder(this)); },
        then(res, rej) { return Promise.resolve(execBuilder(this)).then(res, rej); }
      };
      return b;
    },
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'u1', email: 'admin@thirdparty.ai' } } } }),
      signInWithPassword: async ({ email, password }) => ({ data: { user: { id: 'u1', email } }, error: null }),
      signUp: async ({ email }) => ({ data: { user: { id: 'u2', email } }, error: null }),
      signOut: async () => ({}),
      resetPasswordForEmail: async () => ({ error: null })
    }
  };
}

function makeSandbox(withSdk) {
  const sandbox = {
    console, localStorage,
    setTimeout, clearTimeout, setInterval, clearInterval,
    TextDecoder, TextEncoder,
    crypto: webcrypto, btoa, atob,
    navigator: { onLine: true },
    window: {},
    getModel: id => ({ id, provider: 'MockProvider' })
  };
  sandbox.window = sandbox;   // window 即全局（与浏览器一致）
  if (withSdk) sandbox.supabase = { createClient: () => makeClient() };
  vm.createContext(sandbox);
  ['supabase.js', 'store.js'].forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), sandbox, { filename: f });
  });
  // const 声明不挂到全局对象，需显式取回
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
function callsOf(table) { return calls.filter(c => c.table === table); }

async function main() {

  /* ==================== 1. 别名映射 ==================== */
  section('账号别名映射');
  let sb = makeSandbox(true);
  let { SB } = sb;
  eq(SB.mapAccount('1234'), 'admin@thirdparty.ai', "1234 → 管理员邮箱");
  eq(SB.mapAccount('admin'), 'admin@thirdparty.ai', "admin → 管理员邮箱");
  eq(SB.mapAccount('ADMIN'), 'admin@thirdparty.ai', "ADMIN（大小写不敏感）→ 管理员邮箱");
  eq(SB.mapAccount('User@X.com'), 'user@x.com', "邮箱原样（转小写）");
  eq(SB.mapAccount('bob'), null, "普通账号 → null（走本地）");
  eq(SB.mapAccount(''), null, "空账号 → null");

  /* ==================== 2. 白名单过滤 ==================== */
  section('设置白名单过滤');
  const src = {
    theme: 'dark', lang: 'en', voiceSettings: { enabled: true, rate: 1.5 },
    toolsEnabled: { translate: false }, currentModelId: 'm1', tokenSort: 'recent',
    apiKeys: { openai: 'sk-secret' }, chats: [{ id: 'c1' }], customPresets: [{ id: 'p1' }],
    webSearch: { enabled: true }, avatar: { type: 'preset' }
  };
  const picked = SB._pickSettings(src);
  eq(Object.keys(picked).sort(), ['currentModelId', 'lang', 'theme', 'tokenSort', 'toolsEnabled', 'voiceSettings'], '仅白名单且存在的字段被选中');
  ok(!('apiKeys' in picked) && !('chats' in picked) && !('webSearch' in picked), 'apiKeys/chats/webSearch 绝不进 settings');
  picked.voiceSettings.rate = 9;
  eq(src.voiceSettings.rate, 1.5, '深拷贝：修改挑选结果不影响原 state');
  ok(Array.isArray(SB._SETTINGS_WHITELIST) && SB._SETTINGS_WHITELIST.indexOf('apiKeys') < 0, '白名单不含 apiKeys');

  /* ==================== 3. 分级同步 ==================== */
  section('分级逻辑（isAdmin=false → pushHeavy 跳过）');
  const Store = sb.Store;
  Store.load();
  Store.state.cloudUser = { id: 'u1', email: 'user@x.com', name: '普通用户', isAdmin: false };
  Store.state.chats = [{ id: 'chat1', title: '测试会话', mode: 'single', updatedAt: Date.now(), messages: [
    { id: 'm1', role: 'user', content: '你好', ts: Date.now() },
    { id: 'm2', role: 'assistant', content: '你好！', modelId: 'm1', thinking: '想了一下', ts: Date.now() }
  ] }];
  Store.state.apiKeys = { openai: 'sk-plain-key', mimoPlan: 'tokenPlan', empty: '' };
  Store.state.customPresets = [{ id: 'p1', name: '角色A', desc: 'd', system: 's', icon: 'star' }];
  SB.Sync.schedulePush = () => {};   // 阻断 Store.save 的联动调度，保证测试确定性
  SB.setPassword('test-pw');

  resetDb();
  let r = await SB.Sync.pushHeavy();
  ok(r.skipped === true, '普通用户 pushHeavy 直接 skipped');
  eq(callsOf('conversations').length, 0, '普通用户零 conversations 调用');
  eq(callsOf('messages').length, 0, '普通用户零 messages 调用');

  r = await SB.Sync.pushLight();
  ok(r.ok === true, '普通用户 pushLight 成功');
  eq(callsOf('user_settings').length, 1, 'user_settings upsert 一次');
  const settingsRow = (db.user_settings || [])[0];
  ok(settingsRow && settingsRow.settings && !settingsRow.settings.apiKeys, 'settings jsonb 内无 apiKeys');
  eq(callsOf('conversations').length, 0, 'pushLight 不触碰 conversations');
  const keyRows = db.encrypted_api_keys || [];
  eq(keyRows.length, 1, '仅 1 个有效 Key 被上传（mimoPlan/空值被过滤）');
  ok(keyRows[0] && keyRows[0].provider === 'openai' && keyRows[0].encrypted_key !== 'sk-plain-key', 'Key 落库为密文');
  eq((db.custom_roles || []).length, 1, '自定义角色已同步');

  section('分级逻辑（isAdmin=true → 全量推送）');
  Store.state.cloudUser = { id: 'u1', email: 'admin@thirdparty.ai', name: '管理员', isAdmin: true };
  resetDb();
  r = await SB.Sync.pushHeavy();
  ok(r.ok === true, '管理员 pushHeavy 成功');
  eq(callsOf('conversations').length >= 1, true, 'conversations 已推送');
  eq((db.conversations || []).length, 1, '云端 1 条会话');
  eq((db.conversations || [])[0].local_id, 'chat1', '会话带 local_id');
  eq(Object.keys(Store.state.cloudMap).length, 1, 'cloudMap 已建立映射');
  eq((db.messages || []).length, 2, '云端 2 条消息');
  const m2 = (db.messages || []).find(m => m.local_id === 'm2');
  ok(m2 && m2.thinking === '想了一下' && m2.provider === 'MockProvider', '消息含 thinking/provider 映射');
  // 二次推送幂等：不产生重复行
  await SB.Sync.pushHeavy();
  eq((db.conversations || []).length, 1, '重复 pushHeavy 会话不重复（幂等）');
  eq((db.messages || []).length, 2, '重复 pushHeavy 消息不重复（幂等）');

  section('token_usage 快照');
  Store.state.tokenStats = { byModel: { m1: { prompt: 10, completion: 20, count: 2 } }, updatedAt: Date.now() };
  resetDb();
  await SB.Sync.pushHeavy();
  eq((db.token_usage || []).length, 1, '用量快照插入 1 行');
  await SB.Sync.pushHeavy();
  eq((db.token_usage || []).length, 1, '总量未变不重复插入');

  /* ==================== 4. 加密闭环 ==================== */
  section('密码派生加密闭环');
  const box = await SB._encryptText('sk-live-123');
  ok(box && box.encrypted && box.iv && box.salt, '加密产出 encrypted/iv/salt');
  const plain = await SB._decryptText(box);
  eq(plain, 'sk-live-123', '解密还原明文');
  SB.clearPassword();
  const none = await SB._encryptText('x');
  eq(none, null, '无密码时加密返回 null（跳过 Key 同步）');

  /* ==================== 5. 降级路径 ==================== */
  section('优雅降级');
  Store.state.cloudUser = null;
  r = await SB.Sync.pushLight();
  ok(r.skipped === true, '未登录云：pushLight 跳过');
  sb.navigator.onLine = false;
  Store.state.cloudUser = { id: 'u1', email: 'a@b.c', name: 'n', isAdmin: true };
  r = await SB.Sync.pushHeavy();
  ok(r.skipped === true, '离线：pushHeavy 静默跳过');
  sb.navigator.onLine = true;

  const sb2 = makeSandbox(false);   // 无 window.supabase
  const SB2 = sb2.SB;
  eq(SB2.ready(), false, 'SDK 缺失：ready() = false');
  const signInR = await SB2.Auth.signIn('a@b.c', 'x');
  ok(!!signInR.error, 'SDK 缺失：signIn 返回错误而不抛异常');
  sb2.Store.load();
  sb2.Store.save();   // 触发 Store.save 挂钩，不应抛错
  ok(true, 'SDK 缺失：Store.save 挂钩不抛错');

  /* ---------- 汇总 ---------- */
  console.log('\n========================================');
  console.log('通过 ' + passed + ' / ' + (passed + failed));
  if (failed) { console.error('有 ' + failed + ' 项失败'); process.exit(1); }
  console.log('全部通过 ✓');
}

main().catch(e => { console.error('测试执行异常：', e); process.exit(1); });
