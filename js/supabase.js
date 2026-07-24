/* ==================== SB · Supabase 云端同步 ====================
 * 云能力总入口（全局单例 SB，与 UMD 的 window.supabase 区分）。
 * 仅使用 publishable key；secret key 永不入前端。
 * 设计要点：
 *   - SDK（supabase-js v2 UMD）由 index.html 引入，加载失败时全部云功能优雅降级，
 *     本地功能零影响；首次实际使用时才创建 client（懒初始化，与 CDN 回退兼容）。
 *   - 分级同步：全用户轻量（设置白名单/加密 Key/昵称/角色），管理员额外全量（对话/消息/用量/备份）。
 *   - API Key 用「登录密码派生密钥」AES-GCM 加密后上传；密码与派生密钥只缓存于内存，不落盘。
 */
const SB = (() => {
  const SUPABASE_URL = 'https://mxvxlgjzeboktufumxbp.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_WzUzAQK5cOEsn7QwFB2cAw_ubIkG7RJ';
  const ADMIN_EMAIL = 'admin@thirdparty.ai';
  /* 轻量同步的设置白名单（state 里不存在的小字段自动跳过，前向兼容） */
  const SETTINGS_WHITELIST = ['theme', 'lang', 'voiceSettings', 'toolsEnabled', 'currentModelId', 'debatePreset', 'collabRoles', 'tokenSort', 'autoSpeak'];
  const ATTACH_MAX = 200 * 1024;   // 附件内容 >200KB 不入库，只存元数据
  const BACKUP_KEEP = 10;          // 云端备份保留份数
  const PUSH_DEBOUNCE = 2000;      // Store.save 触发推送的防抖
  const RETRY_DELAY = 30000;       // 推送失败后的自动重试间隔（仅一次）

  let client = null;        // supabase client（懒创建）
  let sdkFailed = false;    // SDK 加载/初始化失败标记
  let pwCache = null;       // 登录密码（仅内存，用于派生加密密钥）
  let encKey = null;        // 本会话派生的 AES-GCM 密钥缓存
  let encSalt = null;       // 本会话加密随机盐（每行 IV 独立随机）
  const dkCache = {};       // 解密用派生密钥缓存（按 salt 缓存）
  let pushTimer = null;
  let retryTimer = null;    // 推送失败后的自动重试定时器
  let suppress = false;     // 同步自身写本地时抑制再次调度（防循环）

  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const nowIso = () => new Date().toISOString();

  function w() { return typeof window !== 'undefined' ? window : globalThis; }

  /* ---------- 懒初始化：SDK 不存在则返回 false（优雅降级） ---------- */
  function ready() {
    if (client) return true;
    if (sdkFailed) return false;
    const g = w();
    if (g.supabase && typeof g.supabase.createClient === 'function') {
      try {
        client = g.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        return true;
      } catch (e) { sdkFailed = true; }
    }
    return false;
  }

  /* app 启动时调用：尝试初始化，失败（含 CDN 回退也失败）时 Toast 提示一次 */
  function init() {
    if (ready()) return true;
    // CDN 主链失败时 index.html 会回退 unpkg（异步），3 秒后重试一次
    setTimeout(() => {
      if (ready()) return;
      sdkFailed = true;
      if (typeof Toast !== 'undefined') Toast.warning('云服务不可用，已切换为纯本地模式');
    }, 3000);
    return false;
  }

  function t(key, fallback) {
    return (typeof I18n !== 'undefined' && I18n.t(key)) || fallback || key;
  }

  /* ---------- 错误翻译：RLS/网络/服务端/常见认证错误 → 中文 ---------- */
  function errMsg(e) {
    const m = String((e && (e.message || e.error_description || e.msg)) || e || '');
    if ((e && e.code === '42501') || /row[- ]level security|permission denied/i.test(m)) return t('cld.permDenied', '权限不足');
    if (/Failed to fetch|NetworkError|Network request failed|Load failed/i.test(m) || (e && e.name === 'TypeError' && /fetch/i.test(m))) return t('cld.netErr', '网络异常，稍后重试');
    // 服务端 5xx / 空消息（SDK 对非 JSON 错误体会给出 message='{}'）
    if ((e && typeof e.status === 'number' && e.status >= 500) || !m || m === '{}' || /unexpected_failure|internal server/i.test(m)) return t('cld.srvErr', '服务器异常，稍后重试');
    if (/Invalid login credentials/i.test(m)) return t('cld.badCred', '邮箱或密码错误');
    if (/User already registered/i.test(m)) return t('cld.dupEmail', '该邮箱已注册，请直接登录');
    if (/Email not confirmed/i.test(m)) return t('cld.notConfirmed', '邮箱未验证，请先到邮箱点击验证链接');
    if (/at least 6 characters/i.test(m)) return t('cld.pwdShort', '密码至少 6 位');
    if (/Unable to validate email address|invalid email/i.test(m)) return t('cld.badEmail', '邮箱格式不正确');
    return m || t('cld.syncFail', '同步失败');
  }

  /* ---------- 账号别名映射：1234 / admin → 管理员邮箱；含 @ 视为邮箱；其余走本地 ---------- */
  function mapAccount(account) {
    const a = String(account || '').trim();
    if (!a) return null;
    if (/^(1234|admin)$/i.test(a)) return ADMIN_EMAIL;
    if (a.indexOf('@') > 0) return a.toLowerCase();
    return null;
  }

  function cloudUser() {
    return (typeof Store !== 'undefined' && Store.state && Store.state.cloudUser) || null;
  }
  function canSync() {
    if (!ready() || !cloudUser()) return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;  // 离线静默跳过
    return true;
  }
  function meta() {
    const s = Store.state;
    if (!s.cloudMeta || typeof s.cloudMeta !== 'object') s.cloudMeta = { lastSync: 0, lastSettingsSync: 0, lastUsagePush: 0, usageTotal: 0 };
    return s.cloudMeta;
  }
  function cloudMap() {
    const s = Store.state;
    if (!s.cloudMap || typeof s.cloudMap !== 'object') s.cloudMap = {};
    return s.cloudMap;
  }
  /* 同步期间写本地不触发再次推送 */
  function saveLocal(immediate) {
    suppress = true;
    try { Store.save(immediate); } finally { suppress = false; }
  }
  function emit() {
    if (typeof document !== 'undefined') {
      try { document.dispatchEvent(new CustomEvent('sbsync')); } catch (e) {}
    }
  }

  /* ==================== Auth ==================== */
  const Auth = {
    async signIn(email, password) {
      if (!ready()) return { user: null, error: new Error('sdk not ready') };
      try {
        const r = await client.auth.signInWithPassword({ email, password });
        return { user: r.data && r.data.user, error: r.error };
      } catch (e) { return { user: null, error: e }; }
    },
    async signUp(email, password, name) {
      if (!ready()) return { user: null, error: new Error('sdk not ready') };
      try {
        const r = await client.auth.signUp({ email, password, options: { data: { name: name || '' } } });
        return { user: r.data && r.data.user, error: r.error };
      } catch (e) { return { user: null, error: e }; }
    },
    async signOut() {
      clearPassword();
      if (!ready()) return;
      try { await client.auth.signOut(); } catch (e) {}
    },
    async getUser() {
      if (!ready()) return null;
      try {
        const r = await client.auth.getSession();
        return (r.data && r.data.session && r.data.session.user) || null;
      } catch (e) { return null; }
    },
    async resetPassword(email) {
      if (!ready()) return { error: new Error('sdk not ready') };
      try {
        const r = await client.auth.resetPasswordForEmail(email);
        return { error: r.error };
      } catch (e) { return { error: e }; }
    },
    /* 账号安全：改邮箱（{email}，需新邮箱验证后生效）/ 改密码（{password}）/ 改元数据（{data}） */
    async updateUser(attrs) {
      if (!ready()) return { user: null, error: new Error('sdk not ready') };
      try {
        const r = await client.auth.updateUser(attrs);
        return { user: r.data && r.data.user, error: r.error };
      } catch (e) { return { user: null, error: e }; }
    }
  };

  /* ---------- profiles → {id, displayName, isAdmin, bio, avatar, phone, email} ---------- */
  async function profile() {
    if (!ready()) return null;
    const u = await Auth.getUser();
    if (!u) return null;
    try {
      const r = await client.from('profiles').select('id,display_name,is_admin,bio,avatar_url,phone').eq('id', u.id).single();
      if (r.error || !r.data) return null;
      const prof = {
        id: r.data.id, displayName: r.data.display_name || '', isAdmin: !!r.data.is_admin,
        bio: r.data.bio || '', avatar: r.data.avatar_url || '', phone: r.data.phone || '',
        email: u.email || ''
      };
      /* 扩展字段直接合入 cloudUser（登录/恢复链路的调用方只读 displayName/isAdmin，
         cloudUser 可能尚未建立——登录场景由 firstSync 再次调用本方法完成合入） */
      const cu = cloudUser();
      if (cu && cu.id === prof.id) {
        cu.isAdmin = prof.isAdmin;
        if (prof.displayName) cu.name = prof.displayName;
        if (prof.email) cu.email = prof.email;
        cu.bio = prof.bio;
        cu.avatar = prof.avatar;
        cu.phone = prof.phone;
      }
      return prof;
    } catch (e) { return null; }
  }

  /* ---------- 资料扩展字段写回（displayName/bio/avatar/phone → profiles 列） ---------- */
  async function updateProfile(fields) {
    if (!canSync()) return { ok: false, error: t('cld.cloudOff', '云服务不可用') };
    const cu = cloudUser();
    const cols = { displayName: 'display_name', bio: 'bio', avatar: 'avatar_url', phone: 'phone' };
    const row = {};
    Object.keys(cols).forEach(k => { if (fields[k] !== undefined) row[cols[k]] = fields[k]; });
    if (!Object.keys(row).length) return { ok: true };
    try {
      const r = await client.from('profiles').update(row).eq('id', cu.id);
      if (r.error) return { ok: false, error: errMsg(r.error) };
      // 云端写入成功后同步 patch 本地 cloudUser 并落盘（编辑页/资料卡即时生效）
      if (row.display_name !== undefined) cu.name = row.display_name;
      if (row.bio !== undefined) cu.bio = row.bio;
      if (row.avatar_url !== undefined) cu.avatar = row.avatar_url;
      if (row.phone !== undefined) cu.phone = row.phone;
      saveLocal(true);
      emit();
      return { ok: true };
    } catch (e) { return { ok: false, error: errMsg(e) }; }
  }

  /* ==================== 密码派生加密（PBKDF2 10 万次 + AES-GCM） ==================== */
  function setPassword(p) { pwCache = p || null; encKey = null; encSalt = null; }
  function clearPassword() { pwCache = null; encKey = null; encSalt = null; for (const k in dkCache) delete dkCache[k]; }
  function hasPassword() { return !!pwCache; }
  function cryptoOk() { return typeof crypto !== 'undefined' && !!crypto.subtle; }

  function b64(buf) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buf))); }
  function unb64(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }

  async function deriveKey(password, salt) {
    const mat = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      mat, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
  }
  /* 会话级加密密钥：盐一次随机，整会话复用（IV 每行独立），PBKDF2 只跑一次 */
  async function sessionKey() {
    if (!pwCache || !cryptoOk()) return null;
    if (!encKey) {
      encSalt = crypto.getRandomValues(new Uint8Array(16));
      encKey = await deriveKey(pwCache, encSalt);
    }
    return encKey;
  }
  async function encryptText(plain) {
    const key = await sessionKey();
    if (!key) return null;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(String(plain)));
    return { encrypted: b64(ct), iv: b64(iv), salt: b64(encSalt) };
  }
  async function decryptText(obj) {
    if (!pwCache || !cryptoOk()) return null;
    const key = dkCache[obj.salt] || (dkCache[obj.salt] = await deriveKey(pwCache, unb64(obj.salt)));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(obj.iv) }, key, unb64(obj.encrypted));
    return dec.decode(pt);
  }

  /* ---------- 设置白名单挑选（深拷贝，防止引用泄漏） ---------- */
  function pickSettings(state) {
    const out = {};
    SETTINGS_WHITELIST.forEach(k => {
      if (state && state[k] !== undefined) {
        try { out[k] = JSON.parse(JSON.stringify(state[k])); } catch (e) {}
      }
    });
    return out;
  }

  /* ---------- 本地 apiKeys 中真正需要同步的条目（跳过空值与套餐选择字段） ---------- */
  function keyEntries() {
    const keys = Store.state.apiKeys || {};
    return Object.keys(keys).filter(k => k !== 'mimoPlan' && typeof keys[k] === 'string' && keys[k].trim());
  }

  /* ==================== Sync · 同步状态 ==================== */
  const SyncState = { syncing: false, lastError: null };
  function status() {
    return {
      ready: ready(),
      syncing: SyncState.syncing,
      lastError: SyncState.lastError,
      lastSync: meta().lastSync || 0,
      user: cloudUser(),
      keyReady: hasPassword()   // 密码派生密钥可用（会话恢复后需重新登录才能同步 Key）
    };
  }

  /* ---------- 轻量推送：settings / 昵称 / 加密 Key / 角色（全用户） ---------- */
  async function pushLight() {
    if (!canSync()) return { ok: false, skipped: true };
    const cu = cloudUser();
    const uid = cu.id;
    let err = null;
    // 1) 设置白名单 → user_settings.settings（jsonb）
    try {
      const r = await client.from('user_settings').upsert(
        { user_id: uid, settings: pickSettings(Store.state), updated_at: nowIso() },
        { onConflict: 'user_id' }
      );
      if (r.error) err = r.error;
    } catch (e) { err = e; }
    // 2) 昵称 → profiles.display_name（用 UPDATE：upsert 的 INSERT 提议行 is_admin 会取默认值 false，触发反提权 WITH CHECK）
    try {
      const r = await client.from('profiles').update({ display_name: cu.name || '' }).eq('id', uid);
      if (r.error && !err) err = r.error;
    } catch (e) { if (!err) err = e; }
    // 3) API Keys 加密上传（密码派生密钥可用时；会话恢复未输密码则跳过）
    if (hasPassword() && cryptoOk()) {
      for (const provider of keyEntries()) {
        try {
          const box = await encryptText(Store.state.apiKeys[provider].trim());
          if (!box) break;
          const r = await client.from('encrypted_api_keys').upsert({
            user_id: uid, provider,
            encrypted_key: box.encrypted, iv: box.iv, salt: box.salt,
            updated_at: nowIso()
          }, { onConflict: 'user_id,provider' });
          if (r.error && !err) err = r.error;
        } catch (e) { if (!err) err = e; }
      }
    }
    // 4) 自定义角色：全量替换（先删后插）
    try {
      const d = await client.from('custom_roles').delete().eq('user_id', uid);
      if (d.error && !err) err = d.error;
      const rows = (Store.state.customPresets || []).map(p => ({
        user_id: uid, name: p.name || '', description: p.desc || '',
        system_prompt: p.system || '', icon: p.icon || '', is_builtin: false
      }));
      if (rows.length) {
        const r = await client.from('custom_roles').insert(rows);
        if (r.error && !err) err = r.error;
      }
    } catch (e) { if (!err) err = e; }

    meta().lastSettingsSync = Date.now();
    if (err) throw err;
    return { ok: true };
  }

  /* ---------- 轻量拉取：登录后合并（云端较新覆盖本地） ---------- */
  async function pullLight() {
    if (!canSync()) return { ok: false, skipped: true };
    const uid = cloudUser().id;
    let changed = false;
    let err = null;
    // 1) 设置：云端 updated_at 较新则覆盖本地白名单字段
    try {
      const r = await client.from('user_settings').select('settings,updated_at').eq('user_id', uid).single();
      if (r.data && r.data.settings) {
        const cloudTs = new Date(r.data.updated_at || 0).getTime();
        if (cloudTs > (meta().lastSettingsSync || 0)) {
          const s = r.data.settings;
          SETTINGS_WHITELIST.forEach(k => { if (s[k] !== undefined) Store.state[k] = s[k]; });
          changed = true;
        }
        meta().lastSettingsSync = Math.max(meta().lastSettingsSync || 0, cloudTs, Date.now());
      }
    } catch (e) { err = e; }
    // 2) 加密 Key：解密写回本地（密码可用时；单行解密失败跳过该行）
    if (hasPassword() && cryptoOk()) {
      try {
        const r = await client.from('encrypted_api_keys').select('provider,encrypted_key,iv,salt').eq('user_id', uid);
        if (!r.error && Array.isArray(r.data)) {
          for (const row of r.data) {
            try {
              const plain = await decryptText({ encrypted: row.encrypted_key, iv: row.iv, salt: row.salt });
              if (plain) { Store.state.apiKeys[row.provider] = plain; changed = true; }
            } catch (e) { /* 单行失败不影响其它 */ }
          }
        }
      } catch (e) { if (!err) err = e; }
    }
    // 3) 自定义角色：本地为空且云端有 → 采用云端（否则本地为准，由推送覆盖云端）
    try {
      const r = await client.from('custom_roles').select('name,description,system_prompt,icon').eq('user_id', uid);
      if (!r.error && Array.isArray(r.data) && r.data.length && !(Store.state.customPresets || []).length) {
        const grads = ['linear-gradient(135deg,#6366F1,#8B5CF6)', 'linear-gradient(135deg,#0EA5E9,#38BDF8)', 'linear-gradient(135deg,#10B981,#34D399)', 'linear-gradient(135deg,#F59E0B,#F97316)', 'linear-gradient(135deg,#EC4899,#F4726B)', 'linear-gradient(135deg,#14B8A6,#2DD4BF)'];
        Store.state.customPresets = r.data.map((row, i) => ({
          id: 'cloud-' + Date.now() + '-' + i, name: row.name || '', desc: row.description || '',
          system: row.system_prompt || '', icon: row.icon || 'sparkles', grad: grads[i % grads.length], custom: true
        }));
        changed = true;
      }
    } catch (e) { if (!err) err = e; }

    if (changed) {
      saveLocal(true);
      if (typeof UI !== 'undefined' && UI.applyTheme) UI.applyTheme();
      if (typeof Pages !== 'undefined' && Store.state.loggedIn && Pages.renderProfile) Pages.renderProfile();
    }
    if (err) throw err;
    return { ok: true, changed };
  }

  /* ==================== 管理员全量同步（isAdmin 才执行） ==================== */
  function isAdmin() { const cu = cloudUser(); return !!(cu && cu.isAdmin); }

  function providerOf(modelId) {
    if (!modelId || typeof getModel !== 'function') return null;
    const m = getModel(modelId);
    return m ? m.provider : null;
  }

  /* 附件只存元信息；图片 base64 不入库（>200KB 标记 hasContent:false） */
  function attachMeta(m) {
    const atts = [];
    if (m.image) atts.push({ type: 'image', name: 'image', size: m.image.length, hasContent: m.image.length <= ATTACH_MAX });
    (m.files || []).forEach(name => atts.push({ type: 'file', name: String(name), size: 0, hasContent: false }));
    return atts.length ? atts : null;
  }

  function msgToRow(m, convId, cloudId) {
    const row = {
      conversation_id: convId,
      role: m.role === 'user' ? 'user' : (m.role === 'system' ? 'system' : 'assistant'),
      content: m.content || '',
      model: m.modelId || null,
      provider: providerOf(m.modelId),
      thinking: m.thinking || null,
      tool_calls: (m.toolCalls && m.toolCalls.length) ? m.toolCalls : null,
      attachments: attachMeta(m),
      tokens_used: m.tokensUsed || 0,
      is_error: !!m.error,
      local_id: m.id
    };
    if (cloudId) row.id = cloudId;
    return row;
  }

  /* conversations 推送：维护 cloudMap {本地会话id → 云端uuid}；单会话失败不拖垮其余，错误汇总后抛出 */
  async function pushConversations() {
    const uid = cloudUser().id;
    const map = cloudMap();
    const chats = Store.state.chats || [];
    const known = [], fresh = [];
    chats.forEach(c => (map[c.id] ? known : fresh).push(c));
    let err = null;
    if (known.length) {
      try {
        const rows = known.map(c => ({
          id: map[c.id], user_id: uid, title: c.title || '新对话', mode: c.mode || 'single',
          local_id: c.id, updated_at: new Date(c.updatedAt || Date.now()).toISOString()
        }));
        const r = await client.from('conversations').upsert(rows);
        if (r.error) err = r.error;
      } catch (e) { err = e; }
    }
    for (const c of fresh) {
      try {
        // 先按 local_id 找回（防止上次插入成功但映射丢失造成重复）
        let cid = null;
        const q = await client.from('conversations').select('id').eq('user_id', uid).eq('local_id', c.id).limit(1);
        if (q.data && q.data.length) cid = q.data[0].id;
        else {
          const r = await client.from('conversations').insert({
            user_id: uid, title: c.title || '新对话', mode: c.mode || 'single',
            local_id: c.id, updated_at: new Date(c.updatedAt || Date.now()).toISOString()
          }).select('id').single();
          if (r.error) throw r.error;
          cid = r.data && r.data.id;
        }
        if (cid) map[c.id] = cid;
      } catch (e) { if (!err) err = e; }   // 跳过该会话，继续其余
    }
    if (err) throw err;
  }

  /* messages 推送：按会话查已有 local_id → 幂等 upsert；单会话失败继续其余 */
  async function pushMessages() {
    const map = cloudMap();
    let err = null;
    for (const c of (Store.state.chats || [])) {
      const cid = map[c.id];
      if (!cid || !(c.messages || []).length) continue;
      try {
        const exist = {};
        const q = await client.from('messages').select('id,local_id').eq('conversation_id', cid);
        if (q.error) throw q.error;
        (q.data || []).forEach(r => { if (r.local_id) exist[r.local_id] = r.id; });
        const rows = c.messages.map(m => msgToRow(m, cid, exist[m.id]));
        for (let i = 0; i < rows.length; i += 100) {
          const r = await client.from('messages').upsert(rows.slice(i, i + 100));
          if (r.error) throw r.error;
        }
      } catch (e) { if (!err) err = e; }   // 跳过该会话，继续其余
    }
    if (err) throw err;
  }

  /* token_usage：本地聚合作一行 snapshot（estimated），总量变化才插 */
  async function pushUsage() {
    const ts = Store.state.tokenStats;
    if (!ts || !ts.byModel) return;
    let prompt = 0, completion = 0;
    Object.keys(ts.byModel).forEach(id => {
      prompt += ts.byModel[id].prompt || 0;
      completion += ts.byModel[id].completion || 0;
    });
    const total = prompt + completion;
    const m = meta();
    if (!total || total === (m.usageTotal || 0)) return;
    const r = await client.from('token_usage').insert({
      user_id: cloudUser().id, provider: 'snapshot', model: 'local-aggregate(estimated)',
      prompt_tokens: prompt, completion_tokens: completion, total_tokens: total, cost_usd: 0
    });
    if (r.error) throw r.error;
    m.usageTotal = total;
    m.lastUsagePush = Date.now();
  }

  /* 全量推送：各环节独立容错（一步失败不中断后续步骤），错误汇总后抛出 */
  async function pushHeavy() {
    if (!canSync() || !isAdmin()) return { ok: false, skipped: true };
    const errs = [];
    for (const step of [pushConversations, pushMessages, pushUsage]) {
      try { await step(); } catch (e) { errs.push(e); }
    }
    saveLocal();   // cloudMap / meta 落盘（部分成功也保留进度）
    if (errs.length) throw errs[0];
    return { ok: true };
  }

  /* 云端消息 → 本地消息结构 */
  function rowToMsg(row) {
    const msg = {
      id: row.local_id || ('c' + row.id),
      role: row.role === 'user' ? 'user' : 'assistant',
      content: row.content || '',
      thinking: row.thinking || '',
      toolCalls: row.tool_calls || [],
      ts: row.created_at ? new Date(row.created_at).getTime() : Date.now()
    };
    if (row.model) msg.modelId = row.model;
    if (row.is_error) msg.error = true;
    return msg;
  }

  /* 拉取云端对话+消息合入本地（双向合并：云端新的覆盖，本地独有的随后由 push 上传） */
  async function pullHeavy() {
    if (!canSync() || !isAdmin()) return { ok: false, skipped: true };
    const map = cloudMap();
    const byCloudId = {};
    Object.keys(map).forEach(localId => { byCloudId[map[localId]] = localId; });
    const r = await client.from('conversations').select('id,title,mode,local_id,updated_at').eq('user_id', cloudUser().id);
    if (r.error) throw r.error;
    let changed = false;
    for (const conv of (r.data || [])) {
      let chat = (Store.state.chats || []).find(c => c.id === byCloudId[conv.id]) ||
                 (Store.state.chats || []).find(c => c.id === conv.local_id);
      const cloudTs = new Date(conv.updated_at || 0).getTime();
      if (!chat) {
        // 云端独有 → 新建本地会话
        const localId = (conv.local_id && !(Store.state.chats || []).some(c => c.id === conv.local_id)) ? conv.local_id : genLocalId();
        chat = { id: localId, title: conv.title || '新对话', mode: conv.mode || 'single', messages: [], createdAt: cloudTs || Date.now(), updatedAt: cloudTs || Date.now() };
        Store.state.chats.unshift(chat);
        map[localId] = conv.id;
        byCloudId[conv.id] = localId;
        changed = true;
      } else {
        map[chat.id] = conv.id;
        byCloudId[conv.id] = chat.id;
        if (cloudTs > (chat.updatedAt || 0)) {
          chat.title = conv.title || chat.title;
          chat.mode = conv.mode || chat.mode;
          chat.updatedAt = cloudTs;
          changed = true;
        }
      }
      // 合并消息：按 local_id 补缺
      const mq = await client.from('messages').select('*').eq('conversation_id', conv.id);
      if (mq.error) continue;
      chat.messages = chat.messages || [];
      const have = {};
      chat.messages.forEach(m => { have[m.id] = true; });
      let added = false;
      (mq.data || []).forEach(row => {
        const lid = row.local_id || ('c' + row.id);
        if (!have[lid]) { chat.messages.push(rowToMsg(row)); have[lid] = true; added = true; }
      });
      if (added) { chat.messages.sort((a, b) => (a.ts || 0) - (b.ts || 0)); changed = true; }
    }
    if (changed) {
      saveLocal(true);
      if (typeof UI !== 'undefined' && Store.state.loggedIn) { UI.renderSidebar(); UI.renderChat(); }
    }
    return { ok: true, changed };
  }

  function genLocalId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  /* ---------- 组合推送：轻量 +（管理员）全量；两级独立容错，全部成功才推进 lastSync ---------- */
  async function pushAll() {
    if (!canSync()) return { ok: false, skipped: true };
    const errs = [];
    try { await pushLight(); } catch (e) { errs.push(e); }
    if (isAdmin()) { try { await pushHeavy(); } catch (e) { errs.push(e); } }
    if (!errs.length) meta().lastSync = Date.now();
    saveLocal();
    emit();
    if (errs.length) throw errs[0];
    return { ok: true };
  }

  /* 同步失败后 30s 自动重试一次（仅在线时；仍失败则静默，下次 save 再试） */
  function scheduleRetry() {
    clearRetry();
    retryTimer = setTimeout(async () => {
      retryTimer = null;
      if (SyncState.syncing || !canSync()) return;   // 同步中/离线/未登录云 → 放弃本次重试
      SyncState.syncing = true; emit();
      try {
        await pushAll();
        SyncState.lastError = null;
      } catch (e) {
        SyncState.lastError = errMsg(e);   // 静默：不再 Toast，等下次 save 触发推送
      }
      SyncState.syncing = false; emit();
    }, RETRY_DELAY);
  }
  function clearRetry() {
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  }

  /* Store.save 挂钩：2s 防抖；抑制期内/离线/未登录云 → 跳过 */
  function schedulePush(delay) {
    if (suppress || !canSync()) return;
    clearRetry();   // 新的本地变更取代待执行的重试
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      pushTimer = null;
      if (SyncState.syncing) { schedulePush(); return; }   // 手动同步进行中，顺延（默认防抖，防空转）
      SyncState.syncing = true; emit();
      try {
        await pushAll();
        SyncState.lastError = null;
      } catch (e) {
        SyncState.lastError = errMsg(e);
        if (typeof Toast !== 'undefined') Toast.error(t('cld.syncFail', '同步失败') + '：' + SyncState.lastError);
        scheduleRetry();   // 30s 后自动补一次
      }
      SyncState.syncing = false; emit();
    }, delay == null ? PUSH_DEBOUNCE : delay);
  }

  /* 手动「立即同步」：管理员先拉后推（双向合并），普通用户轻量拉推；各环节独立容错 */
  async function syncNow() {
    if (!canSync()) return { ok: false, error: t('cld.cloudOff', '云服务不可用') };
    if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }   // 与手动同步合并，避免重复推送
    clearRetry();
    SyncState.syncing = true; emit();
    const errs = [];
    if (isAdmin()) { try { await pullHeavy(); } catch (e) { errs.push(e); } }
    try { await pullLight(); } catch (e) { errs.push(e); }
    try { await pushAll(); } catch (e) { errs.push(e); }
    SyncState.syncing = false; emit();
    if (errs.length) {
      SyncState.lastError = errMsg(errs[0]);
      return { ok: false, error: SyncState.lastError };
    }
    SyncState.lastError = null;
    return { ok: true };
  }

  /* 登录后首次同步：管理员全量双向，普通用户轻量；各环节独立容错 */
  async function firstSync() {
    if (!canSync()) return;
    if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
    clearRetry();
    SyncState.syncing = true; emit();
    const errs = [];
    try { await profile(); } catch (e) {}   // 登录场景 cloudUser 刚建立：合入 bio/avatar/phone 等扩展字段
    if (isAdmin()) {
      try { await pullHeavy(); } catch (e) { errs.push(e); }
      try { await pushHeavy(); } catch (e) { errs.push(e); }
    }
    try { await pullLight(); } catch (e) { errs.push(e); }
    try { await pushLight(); } catch (e) { errs.push(e); }
    if (!errs.length) meta().lastSync = Date.now();
    saveLocal();
    if (errs.length) {
      SyncState.lastError = errMsg(errs[0]);
      if (typeof Toast !== 'undefined') Toast.error(t('cld.syncFail', '同步失败') + '：' + SyncState.lastError);
    } else {
      SyncState.lastError = null;
    }
    SyncState.syncing = false; emit();
  }

  /* ==================== 云端备份（管理员，RLS 限制） ==================== */
  async function backupNow() {
    if (!canSync()) return { ok: false, error: t('cld.cloudOff', '云服务不可用') };
    if (!isAdmin()) return { ok: false, error: t('cld.adminOnly', '仅管理员可用') };
    try {
      const json = Store.exportAll();
      const r = await client.from('cloud_backups').insert({
        user_id: cloudUser().id,
        backup_name: '手动备份 ' + new Date().toLocaleString(),
        backup_data: JSON.parse(json),
        size_bytes: json.length
      });
      if (r.error) throw r.error;
      // 只保留最近 BACKUP_KEEP 份
      const list = await client.from('cloud_backups').select('id,created_at').eq('user_id', cloudUser().id).order('created_at', { ascending: false });
      if (!list.error && list.data && list.data.length > BACKUP_KEEP) {
        const stale = list.data.slice(BACKUP_KEEP).map(b => b.id);
        await client.from('cloud_backups').delete().in('id', stale);
      }
      return { ok: true };
    } catch (e) { return { ok: false, error: errMsg(e) }; }
  }

  async function listBackups() {
    if (!canSync() || !isAdmin()) return { ok: false, list: [], error: t('cld.adminOnly', '仅管理员可用') };
    try {
      const r = await client.from('cloud_backups').select('id,backup_name,size_bytes,created_at').eq('user_id', cloudUser().id).order('created_at', { ascending: false });
      if (r.error) throw r.error;
      return { ok: true, list: r.data || [] };
    } catch (e) { return { ok: false, list: [], error: errMsg(e) }; }
  }

  async function restoreBackup(id) {
    if (!canSync() || !isAdmin()) return { ok: false, error: t('cld.adminOnly', '仅管理员可用') };
    try {
      const r = await client.from('cloud_backups').select('backup_data').eq('id', id).single();
      if (r.error) throw r.error;
      if (!r.data || !r.data.backup_data) return { ok: false, error: t('cld.syncFail', '同步失败') };
      return { ok: true, data: r.data.backup_data };
    } catch (e) { return { ok: false, error: errMsg(e) }; }
  }

  const Sync = { schedulePush, syncNow, firstSync, pushAll, pushLight, pullLight, pushHeavy, pullHeavy, backupNow, listBackups, restoreBackup, status };

  return {
    init, ready, mapAccount, errMsg,
    Auth, profile, updateProfile, setPassword, clearPassword, hasPassword, Sync,
    /* 测试钩子（下划线开头，供 node 冒烟测试直接验证内部逻辑） */
    _pickSettings: pickSettings,
    _deriveKey: deriveKey,
    _encryptText: encryptText,
    _decryptText: decryptText,
    _isAdmin: isAdmin,
    _ADMIN_EMAIL: ADMIN_EMAIL,
    _SETTINGS_WHITELIST: SETTINGS_WHITELIST
  };
})();
