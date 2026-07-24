/* ==================== AUTH · 登录 / 注册 ====================
 * 两层会话：
 *   1) 本地会话（localStorage 用户表 + Store.state.loggedIn）——原有机制不变，
 *      云端用户也会落一条本地记录（password 哨兵值，无法用本地密码登录），保证离线可用。
 *   2) 云端会话（Supabase，js/supabase.js 的 SB）——叠加在本地会话之上，
 *      登录成功写 Store.state.cloudUser，同步由 SB.Sync 负责。
 * 不再自动创建演示账号；管理员别名 1234/admin 的映射在 SB.mapAccount。
 */
const Auth = (() => {

  async function hash(p) {
    if (crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('3rd-ai:' + p));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // 降级（非安全上下文）
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

  /* 云端登录（管理员 / 普通用户共用）：SB 鉴权 → profile → 本地记录 → 首次同步 */
  async function cloudLogin(email, password) {
    if (typeof SB === 'undefined' || !SB.ready()) return { ok: false, error: '云服务不可用，请检查网络或改用游客模式' };
    const r = await SB.Auth.signIn(email, password);
    if (r.error || !r.user) return { ok: false, error: SB.errMsg(r.error || new Error('登录失败')) };
    SB.setPassword(password);   // 仅内存，用于派生 Key 加密密钥
    const prof = await SB.profile();
    const meta = (r.user.user_metadata) || {};
    const name = (prof && prof.displayName) || meta.name || email.split('@')[0];
    const isAdmin = !!(prof && prof.isAdmin);
    // 落一条本地记录（password 哨兵不可登录，仅维持本地会话机制）
    const users = Store.getUsers();
    const user = users[email] || { account: email, password: 'cloud-only', createdAt: Date.now() };
    user.name = name;
    user.cloud = true;
    users[email] = user;
    Store.saveUsers(users);
    Store.patch({ loggedIn: true, user: email, userInfo: user, cloudUser: { id: r.user.id, email, name, isAdmin } });
    // 首次同步（后台：管理员全量双向 / 普通用户轻量）
    SB.Sync.firstSync();
    return { ok: true, name, isAdmin };
  }

  /* 云端注册：邮箱 + 密码 + 昵称；需邮件验证，注册后不自动登录 */
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

  /* 游客登录：不创建账号，仅本地浏览使用 */
  function guest() {
    const user = { account: 'guest', name: '游客', remark: '本地浏览模式', guest: true, createdAt: Date.now() };
    Store.patch({ loggedIn: true, user: 'guest', userInfo: user });
  }

  /* 仅退出云端账号：本地会话与数据保留 */
  async function cloudSignOut() {
    if (typeof SB !== 'undefined') await SB.Auth.signOut();
    Store.patch({ cloudUser: null, cloudMap: {}, cloudMeta: { lastSync: 0, lastSettingsSync: 0, lastUsagePush: 0, usageTotal: 0 } });
  }

  function logout() {
    API.abortAll();
    Voice.stopSpeak();
    Voice.stopInput();
    if (Store.state.cloudUser && typeof SB !== 'undefined') SB.Auth.signOut();  // 云会话一并退出（后台，不阻塞）
    Store.patch({ loggedIn: false, user: null, userInfo: null, currentChatId: null, cloudUser: null, cloudMap: {}, cloudMeta: { lastSync: 0, lastSettingsSync: 0, lastUsagePush: 0, usageTotal: 0 } });
    UI.showLogin();
    Toast.info('已退出登录');
  }

  /* 进入应用前的会话检查 */
  function checkSession() {
    const s = Store.state;
    if (s.loggedIn && s.user) {
      if (s.user === 'guest') return !!(s.userInfo && s.userInfo.guest); // 游客会话
      const users = Store.getUsers();
      if (users[s.user]) { Store.patch({ userInfo: users[s.user] }); return true; }
    }
    return false;
  }

  return { login, cloudLogin, cloudRegister, register, guest, logout, cloudSignOut, checkSession };
})();
