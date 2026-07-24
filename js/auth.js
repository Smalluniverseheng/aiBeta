/* ==================== AUTH · 认证与后端切换 ====================
 * 设计要点：
 *   - 后端可用时：走 Worker 代理，支持跨设备同步（使用 SB 对象）
 *   - 后端不可用时：自动降级为直连厂商，零依赖
 *   - 使用现有 SB 对象（js/supabase.js），不重复创建 client
 */

// 后端可用性检测
var BACKEND_AVAILABLE = false;
var BACKEND_CHECKED = false;

function checkBackend() {
  if (BACKEND_CHECKED) return Promise.resolve(BACKEND_AVAILABLE);
  return new Promise(function(resolve) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://ai-gateway.1829487897.workers.dev/api/v1/health', true);
    xhr.timeout = 3000;
    xhr.onload = function() {
      BACKEND_AVAILABLE = (xhr.status === 200);
      BACKEND_CHECKED = true;
      console.log('[Auth] 后端状态:', BACKEND_AVAILABLE ? '可用' : '不可用（降级模式）');
      resolve(BACKEND_AVAILABLE);
    };
    xhr.onerror = xhr.ontimeout = function() {
      BACKEND_AVAILABLE = false;
      BACKEND_CHECKED = true;
      console.log('[Auth] 后端状态: 不可用（降级模式）');
      resolve(false);
    };
    xhr.send();
  });
}

// 获取后端状态（供 UI 显示）
function isBackendAvailable() {
  return BACKEND_AVAILABLE;
}

// 获取用户 Token（后端可用时，使用 SB 对象）
function getUserToken() {
  if (!BACKEND_AVAILABLE) return Promise.resolve(null);
  return new Promise(function(resolve) {
    try {
      if (typeof SB !== 'undefined' && SB.client && SB.client.auth) {
        SB.client.auth.getSession().then(function(result) {
          var session = result.data && result.data.session;
          resolve(session && session.access_token ? session.access_token : null);
        }).catch(function(e) {
          resolve(null);
        });
      } else {
        resolve(null);
      }
    } catch (e) {
      resolve(null);
    }
  });
}

// 页面加载时检测后端
if (typeof window !== 'undefined') {
  checkBackend();
}

/* ==================== AUTH · 登录 / 注册 ====================
 * 两层会话：
 *   1) 本地会话（localStorage 用户表 + Store.state.loggedIn）——原有机制不变
 *   2) 云端会话（Supabase，js/supabase.js 的 SB）——叠加在本地会话之上
 */
const Auth = (() => {

  async function hash(p) {
    if (crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('3rd-ai:' + p));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 0;
    const s = '3rd-ai:' + p;
    for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
    return String(h);
  }

  async function login(account, password) {
    const users = Store.getUsers();
    const u = users[account];
    if (!u) return { ok: false, error: '账号不存在，请用邮箱登录或注册' };
    if (u.cloud) return { ok: false, error: '该账号是云端账号，请用邮箱 + 云端密码登录' };
    if (u.password !== await hash(password)) return { ok: false, error: '密码错误，请重试' };
    Store.patch({ loggedIn: true, user: account, userInfo: u });
    return { ok: true };
  }

  async function cloudLogin(email, password) {
    if (typeof SB === 'undefined' || !SB.ready()) return { ok: false, error: '云服务不可用，请检查网络或改用游客模式' };
    const r = await SB.Auth.signIn(email, password);
    if (r.error || !r.user) return { ok: false, error: SB.errMsg(r.error || new Error('登录失败')) };
    SB.setPassword(password);
    const prof = await SB.profile();
    const meta = (r.user.user_metadata) || {};
    const name = (prof && prof.displayName) || meta.name || email.split('@')[0];
    const isAdmin = !!(prof && prof.isAdmin);
    const users = Store.getUsers();
    const user = users[email] || { account: email, password: 'cloud-only', createdAt: Date.now() };
    user.name = name;
    user.cloud = true;
    users[email] = user;
    Store.saveUsers(users);
    Store.patch({ loggedIn: true, user: email, userInfo: user, cloudUser: { id: r.user.id, email, name, isAdmin } });
    SB.Sync.firstSync();
    return { ok: true, name, isAdmin };
  }

  async function cloudRegister(info) {
    const { account, password, name } = info;
    if (!name || !name.trim()) return { ok: false, error: '请填写昵称' };
    if (!account || account.indexOf('@') < 0) return { ok: false, error: '请输入正确的邮箱地址' };
    if (!password || password.length < 6) return { ok: false, error: '密码至少 6 位' };
    if (password !== info.password2) return { ok: false, error: '两次输入的密码不一致' };
    if (typeof SB === 'undefined' || !SB.ready()) return { ok: false, error: '云服务不可用，请检查网络或改用游客模式' };
    const r = await SB.Auth.signUp(account.trim().toLowerCase(), password, name.trim());
    if (r.error) return { ok: false, error: SB.errMsg(r.error) };
    return { ok: true };
  }

  async function register(info) {
    const { account, password, name } = info;
    if (!name || !name.trim()) return { ok: false, error: '请填写昵称' };
    if (!account || account.length < 3) return { ok: false, error: '账号至少 3 位' };
    if (!password || password.length < 4) return { ok: false, error: '密码至少 4 位' };
    if (password !== info.password2) return { ok: false, error: '两次输入的密码不一致' };
    const users = Store.getUsers();
    if (users[account]) return { ok: false, error: '该账号已被注册' };
    const user = { account, password: await hash(password), name: name.trim(), remark: info.remark || '', createdAt: Date.now() };
    users[account] = user;
    Store.saveUsers(users);
    Store.patch({ loggedIn: true, user: account, userInfo: user });
    return { ok: true };
  }

  function guest() {
    const user = { account: 'guest', name: '游客', remark: '本地浏览模式', guest: true, createdAt: Date.now() };
    Store.patch({ loggedIn: true, user: 'guest', userInfo: user });
  }

  async function cloudSignOut() {
    if (typeof SB !== 'undefined') await SB.Auth.signOut();
    Store.patch({ cloudUser: null, cloudMap: {}, cloudMeta: { lastSync: 0, lastSettingsSync: 0, lastUsagePush: 0, usageTotal: 0 } });
  }

  function logout() {
    API.abortAll();
    Voice.stopSpeak();
    Voice.stopInput();
    if (Store.state.cloudUser && typeof SB !== 'undefined') SB.Auth.signOut();
    Store.patch({ loggedIn: false, user: null, userInfo: null, currentChatId: null, cloudUser: null, cloudMap: {}, cloudMeta: { lastSync: 0, lastSettingsSync: 0, lastUsagePush: 0, usageTotal: 0 } });
    UI.showLogin();
    Toast.info('已退出登录');
  }

  function checkSession() {
    const s = Store.state;
    if (s.loggedIn && s.user) {
      if (s.user === 'guest') return !!(s.userInfo && s.userInfo.guest);
      const users = Store.getUsers();
      if (users[s.user]) { Store.patch({ userInfo: users[s.user] }); return true; }
    }
    return false;
  }

  return { login, cloudLogin, cloudRegister, register, guest, logout, cloudSignOut, checkSession };
})();