/* ==================== STORE · 状态与本地存储 ====================
 * 所有持久化都经过本模块。后期接入后端时：
 * 只需将 load()/save() 换成服务端同步（REST/WebSocket），上层 UI 无需改动。
 */
const Store = (() => {
  const STATE_KEY = 'ai_chat_state_v5';
  const USERS_KEY = 'ai_users_v5';
  const LEGACY_KEYS = ['ai_chat_state_v4', 'ai_users_v4'];

  const DEFAULTS = {
    loggedIn: false,
    user: null,
    userInfo: null,
    theme: 'system',
  proxyMode: 'local',
    apiKeys: {},
    chats: [],
    currentChatId: null,
    currentModelId: 'mimo-v2.5-pro',
    currentMode: 'single',
    multiModels: [],
    debatePro: [],
    debateCon: [],
    debateJudge: [],
    collabModels: [],
    debateRounds: 2,
    debateFormat: 'standard',
    collabRounds: 2,
    avatar: null,          // { type:'preset', idx } 或 { type:'image', data }
    lang: 'zh-CN',         // 界面语言（zh-CN/zh-TW/en/fr/es/ru/ar）
    voiceSettings: { enabled: true, voiceURI: '', rate: 1, ttsEngine: 'browser', ttsVoice: 'mimo_default', asrEngine: 'browser' },
    webSearch: { enabled: false, tavilyKey: '' },
    thinkingOn: true,       // 深度思考开关（支持的模型生效）
    presetExtra: {},        // 预设角色追加提示词 { presetId: text }
    customPresets: [],      // 用户自建角色 [{id,name,icon,grad,desc,system,custom:true}]
    rankTab: 'overall',     // 模型排行榜页签 overall|coding
    rankChart: 'bar',       // 排行榜图型 bar|radar
    toolsEnabled: { translate: true, polish: true, summary: true, codeExplain: true },  // 其他页效率工具开关
    plugins: { installed: ['tavily-search'], configs: {} },   // 插件库（js/plugins.js；tavily 配置落在 webSearch，此处存其余插件）
    skills: { enabled: ['polish', 'summary', 'codeExplain'], custom: [] },  // 技能库（js/skills.js；enabled 与 toolsEnabled 双向同步）
    sidebarCollapsed: false,
    recentModels: [],
    tokenStats: { byModel: {}, updatedAt: 0 },  // Token 用量统计（js/token.js 读写，重置不影响其他字段）
    cloudUser: null,        // 云端账号 {id, email, name, isAdmin}（js/supabase.js；游客/本地账号为 null）
    cloudMap: {},           // 会话映射 {本地会话id: 云端uuid}（管理员全量同步用）
    cloudMeta: { lastSync: 0, lastSettingsSync: 0, lastUsagePush: 0, usageTotal: 0 }  // 同步游标
  };

  let state = JSON.parse(JSON.stringify(DEFAULTS));
  let saveTimer = null;

  /* 注意：state 引用全程不可替换（Store.state 在模块初始化时已绑定），
     所有加载/重置都必须就地修改该对象 */
  function load() {
    try {
      // 优先读 v5；没有则尝试迁移 v4 数据（保留对话与 Key）
      let raw = localStorage.getItem(STATE_KEY);
      if (!raw) raw = localStorage.getItem(LEGACY_KEYS[0]);
      if (raw) {
        const parsed = JSON.parse(raw);
        // voiceSettings 深合并：老数据缺少新字段（ttsEngine/asrEngine 等）时补默认值
        parsed.voiceSettings = Object.assign(JSON.parse(JSON.stringify(DEFAULTS.voiceSettings)), parsed.voiceSettings || {});
        replaceState(Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), parsed));
      }
    } catch (e) { /* 数据损坏时使用默认 */ }
    if (!Array.isArray(state.chats)) state.chats = [];
    if (!state.apiKeys) state.apiKeys = {};
    // 老数据没有 tokenStats 时补默认（Object.assign(DEFAULTS, parsed) 已覆盖，这里再兜底字段残缺）
    if (!state.tokenStats || typeof state.tokenStats !== 'object') state.tokenStats = { byModel: {}, updatedAt: 0 };
    if (!state.tokenStats.byModel || typeof state.tokenStats.byModel !== 'object') state.tokenStats.byModel = {};
    // 老数据没有 plugins / skills 字段（或字段残缺）时补默认
    if (!state.plugins || typeof state.plugins !== 'object') state.plugins = { installed: ['tavily-search'], configs: {} };
    if (!Array.isArray(state.plugins.installed)) state.plugins.installed = ['tavily-search'];
    if (!state.plugins.configs || typeof state.plugins.configs !== 'object') state.plugins.configs = {};
    if (!state.skills || typeof state.skills !== 'object') state.skills = { enabled: ['polish', 'summary', 'codeExplain'], custom: [] };
    if (!Array.isArray(state.skills.enabled)) state.skills.enabled = ['polish', 'summary', 'codeExplain'];
    if (!Array.isArray(state.skills.custom)) state.skills.custom = [];
    // 老数据没有云端同步字段时补默认
    if (!state.cloudMap || typeof state.cloudMap !== 'object') state.cloudMap = {};
    if (!state.cloudMeta || typeof state.cloudMeta !== 'object') state.cloudMeta = { lastSync: 0, lastSettingsSync: 0, lastUsagePush: 0, usageTotal: 0 };
    if (state.cloudUser !== null && (typeof state.cloudUser !== 'object' || !state.cloudUser.id)) state.cloudUser = null;
    return state;
  }

  function replaceState(next) {
    Object.keys(state).forEach(k => delete state[k]);
    Object.assign(state, next);
  }

  function save(immediate) {
    if (saveTimer) clearTimeout(saveTimer);
    const write = () => {
      try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); }
      catch (e) {
        // 存储超限：尝试清理最旧对话的图片数据
        try {
          state.chats.slice(-3).forEach(c => (c.messages || []).forEach(m => { if (m.image) m.image = null; }));
          localStorage.setItem(STATE_KEY, JSON.stringify(state));
        } catch (e2) {}
      }
    };
    if (immediate) { write(); } else { saveTimer = setTimeout(write, 400); }
    // 云端账号在线时联动推送（SB 内部防抖 2s；游客/本地账号/离线时静默跳过）
    if (state.cloudUser && typeof SB !== 'undefined' && SB.Sync) SB.Sync.schedulePush();
  }

  function patch(obj) { Object.assign(state, obj); save(); }

  function reset() {
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem(USERS_KEY);
    replaceState(JSON.parse(JSON.stringify(DEFAULTS)));
  }

  /* ---- 用户表（本地演示账号体系；接后端后替换为服务端鉴权） ---- */
  function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }

  /* ---- 数据统计 / 导出 ---- */
  function stats() {
    const chats = state.chats || [];
    const msgCount = chats.reduce((a, c) => a + (c.messages ? c.messages.length : 0), 0);
    const keyCount = Object.entries(state.apiKeys || {}).filter(([k, v]) => v && k !== 'mimoPlan').length;
    let bytes = 0;
    try { bytes = (localStorage.getItem(STATE_KEY) || '').length; } catch (e) {}
    return { chats: chats.length, messages: msgCount, keys: keyCount, bytes };
  }

  function exportAll() {
    return JSON.stringify({ app: 'thirdparty-ai', version: APP_VERSION, exportedAt: new Date().toISOString(), state }, null, 2);
  }

  function importAll(json) {
    const data = JSON.parse(json);
    const incoming = data.state || data;
    if (!incoming || typeof incoming !== 'object') throw new Error('数据格式不正确');
    replaceState(Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), incoming));
    save(true);
  }

  return { state, DEFAULTS, load, save, patch, reset, getUsers, saveUsers, stats, exportAll, importAll };
})();


// ========== 跨设备同步（v3.8 新增）==========
// 这些函数在 Store 定义之后加载，不会破坏原有逻辑

function syncToCloud() {
  if (typeof getUserToken !== 'function') return;
  getUserToken().then(function(token) {
    if (!token) return;
    var data = { api_keys: {} };
    var providers = ['openai','anthropic','google','deepseek','moonshot','alibaba',
      'baichuan','zhipu','minimax','spark','ernie','hunyuan','doubao','qwen',
      'coze','groq','cohere','mistral','perplexity','together','fireworks','novita','siliconflow'];
    for (var i = 0; i < providers.length; i++) {
      var key = localStorage.getItem('apiKey_' + providers[i]);
      if (key) data.api_keys[providers[i]] = key;
    }
    fetch('https://ai-gateway.1829487897.workers.dev/api/v1/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncData: data, userToken: token })
    }).catch(function(e) { console.warn('[Sync] 同步失败:', e); });
  });
}

function restoreFromCloud() {
  if (typeof getUserToken !== 'function') return;
  getUserToken().then(function(token) {
    if (!token) return;
    fetch('https://ai-gateway.1829487897.workers.dev/api/v1/keys', {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(function(res) { return res.json(); }).then(function(data) {
      var count = 0;
      var keys = data.keys || {};
      for (var provider in keys) {
        if (keys.hasOwnProperty(provider)) {
          localStorage.setItem('apiKey_' + provider, keys[provider]);
          count++;
        }
      }
      if (count > 0 && typeof showToast === 'function') {
        showToast('已从云端恢复 ' + count + ' 个 API Key');
      }
    }).catch(function(e) { console.warn('[Sync] 恢复失败:', e); });
  });
}

function syncChatToCloud(chatId, title, model, mode, messages) {
  if (typeof getUserToken !== 'function') return;
  getUserToken().then(function(token) {
    if (!token) return;
    fetch('https://ai-gateway.1829487897.workers.dev/api/v1/chats/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: chatId, title: title, model: model, mode: mode, messages: messages, userToken: token })
    }).catch(function(e) { console.warn('[Sync] 聊天记录同步失败:', e); });
  });
}

function restoreChatsFromCloud() {
  if (typeof getUserToken !== 'function') return;
  getUserToken().then(function(token) {
    if (!token) return;
    fetch('https://ai-gateway.1829487897.workers.dev/api/v1/chats', {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(function(res) { return res.json(); }).then(function(data) {
      if (data.chats && data.chats.length > 0) {
        var localChats = JSON.parse(localStorage.getItem('ai_chat_state_v5') || '{}').chats || [];
        var chatMap = {};
        for (var i = 0; i < localChats.length; i++) {
          chatMap[localChats[i].id] = localChats[i];
        }
        for (var j = 0; j < data.chats.length; j++) {
          var cloudChat = data.chats[j];
          var existing = chatMap[cloudChat.id];
          if (!existing || new Date(cloudChat.updated_at) > new Date(existing.updated_at)) {
            chatMap[cloudChat.id] = cloudChat;
          }
        }
        var merged = [];
        for (var id in chatMap) {
          if (chatMap.hasOwnProperty(id)) merged.push(chatMap[id]);
        }
        var state = JSON.parse(localStorage.getItem('ai_chat_state_v5') || '{}');
        state.chats = merged;
        localStorage.setItem('ai_chat_state_v5', JSON.stringify(state));
        if (typeof showToast === 'function') {
          showToast('已同步 ' + data.chats.length + ' 个对话');
        }
      }
    }).catch(function(e) { console.warn('[Sync] 聊天记录恢复失败:', e); });
  });
}
