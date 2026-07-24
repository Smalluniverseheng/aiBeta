/* ==================== PLUGINS · 插件库 ====================
 * 平台能力插件的安装与配置。
 * - tavily-search：联网搜索，配置读写直接落到 Store.state.webSearch（旧逻辑零改动）
 * - github-connector：GitHub 仓库连接器，供 AI 调试与推送代码（配置存 plugins.configs）
 * - tencent-cloud：腾讯云控制台（纯前端仅保存凭据，API 调用待后端代理）
 * - opensource-ecosystem：开源生态信息卡（无开关无配置）
 */
const Plugins = (() => {

  const PLUGIN_DEFS = [
    {
      id: 'tavily-search',
      name: '联网搜索',
      icon: 'globe',
      desc: 'Tavily 检索 · 回答附真实来源',
      fields: [
        { key: 'tavilyKey', label: 'Tavily API Key', ph: 'tvly-...', secret: true, hint: 'tavily.com 免费申请' }
      ]
    },
    {
      id: 'github-connector',
      name: 'GitHub 连接器',
      icon: 'terminal',
      desc: '授权 AI 读写你的仓库 · 调试与推送代码',
      fields: [
        { key: 'token', label: 'Personal Access Token', ph: 'ghp_... / github_pat_...', secret: true, hint: 'GitHub → Settings → Developer settings → Tokens' },
        { key: 'repo', label: '仓库（owner/name）', ph: 'octocat/hello-world' },
        { key: 'branch', label: '分支', ph: 'main' }
      ]
    },
    {
      id: 'tencent-cloud',
      name: '腾讯云控制台',
      icon: 'layers',
      desc: '云资源查询与管理 · COS / CVM / Lighthouse',
      backend: true,   // 待后端代理：TC3 签名密钥不能暴露在前端请求里
      note: '纯前端模式仅保存凭据，API 调用能力待后端代理上线后启用（TC3 签名需防泄露）',
      fields: [
        { key: 'secretId', label: 'SecretId', ph: 'AKID...', secret: true },
        { key: 'secretKey', label: 'SecretKey', ph: '••••••', secret: true },
        { key: 'region', label: '地域（Region）', ph: 'ap-guangzhou' }
      ]
    },
    {
      id: 'opensource-ecosystem',
      name: '开源生态',
      icon: 'compass',
      desc: '可对接的开源插件 / 技能生态一览',
      info: true   // 信息卡：无开关无配置
    }
  ];

  /* 开源生态信息卡内容（后续版本将支持导入开源技能包） */
  const ECO_LINKS = [
    { name: 'MCP servers 仓库', desc: 'Anthropic 主导的 Model Context Protocol 官方服务器合集，标准化连接文件系统、数据库与各类工具', url: 'github.com/modelcontextprotocol/servers' },
    { name: 'Dify 插件市场', desc: 'Dify 官方插件生态，涵盖模型、工具与 Agent 策略，一键安装扩展能力', url: 'marketplace.dify.ai' },
    { name: 'LobeChat 插件', desc: 'LobeChat 社区插件索引，丰富的 Function Calling 工具插件', url: 'lobehub.com/plugins' },
    { name: 'Open WebUI Tools', desc: 'Open WebUI 社区工具库，可直接导入的 Python 工具脚本', url: 'openwebui.com/tools' }
  ];

  /* ---- 配置读写：tavily 直连 webSearch，其余落 plugins.configs ---- */
  function ensureStore() {
    const s = Store.state;
    if (!s.plugins || typeof s.plugins !== 'object') s.plugins = { installed: ['tavily-search'], configs: {} };
    if (!Array.isArray(s.plugins.installed)) s.plugins.installed = ['tavily-search'];
    if (!s.plugins.configs || typeof s.plugins.configs !== 'object') s.plugins.configs = {};
    return s.plugins;
  }

  function getConfig(id) {
    if (id === 'tavily-search') {
      const ws = Store.state.webSearch || {};
      return { enabled: !!ws.enabled, tavilyKey: ws.tavilyKey || '' };
    }
    const cfg = ensureStore().configs[id] || {};
    // github 分支缺省 main
    if (id === 'github-connector' && !cfg.branch) cfg.branch = 'main';
    return Object.assign({ enabled: false }, cfg);
  }

  function setConfig(id, cfg) {
    if (id === 'tavily-search') {
      Store.state.webSearch.enabled = !!cfg.enabled;
      Store.state.webSearch.tavilyKey = (cfg.tavilyKey || '').trim();
    } else {
      const cur = getConfig(id);
      ensureStore().configs[id] = Object.assign(cur, cfg);
    }
    Store.save();
  }

  function toggle(id, on) {
    setConfig(id, { enabled: !!on });
  }

  function isEnabled(id) {
    return !!getConfig(id).enabled;
  }

  function get(id) {
    const def = PLUGIN_DEFS.find(d => d.id === id);
    if (!def) return null;
    const config = getConfig(id);
    return { def, config, enabled: !!config.enabled };
  }

  function list() {
    return PLUGIN_DEFS.map(d => get(d.id));
  }

  /* ---- GitHub 连接器（跨模块契约：ui.js 消费，签名勿改） ---- */
  function getGithub() {
    const cfg = getConfig('github-connector');
    if (!cfg.enabled) return null;
    return { enabled: true, token: cfg.token || '', repo: cfg.repo || '', branch: cfg.branch || 'main' };
  }

  /* Unicode 安全 base64 */
  function utf8ToBase64(str) {
    if (window.TextEncoder) {
      const bytes = new TextEncoder().encode(str);
      let bin = '';
      bytes.forEach(b => { bin += String.fromCharCode(b); });
      return btoa(bin);
    }
    return btoa(unescape(encodeURIComponent(str)));
  }

  function ghError(status) {
    if (status === 401) return new Error('Token 无效或已过期');
    if (status === 404) return new Error('仓库不存在或无权限');
    return new Error('GitHub 请求失败（HTTP ' + status + '）');
  }

  /* 推送文件到仓库：存在则更新（带 sha），不存在则新建；resolve 文件 html_url */
  async function githubPush(path, content, message) {
    const gh = getGithub();
    if (!gh || !gh.token || !gh.repo) throw new Error('请先在「插件库」启用并配置 GitHub 连接器');
    const branch = (gh.branch || 'main').trim() || 'main';
    const api = 'https://api.github.com/repos/' + gh.repo.trim() + '/contents/' +
      String(path).split('/').map(encodeURIComponent).join('/');
    const headers = {
      'Authorization': 'Bearer ' + gh.token,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };
    // 1) 取 sha（404 视为新建）
    let sha;
    try {
      const r = await fetch(api + '?ref=' + encodeURIComponent(branch), { headers });
      if (r.ok) { sha = (await r.json()).sha; }
      else if (r.status === 404) { sha = undefined; }
      else throw ghError(r.status);
    } catch (e) {
      if (e instanceof TypeError) throw new Error('网络请求失败，请检查网络连接');
      throw e;
    }
    // 2) 创建 / 更新
    const body = { message: message || '更新 ' + path, content: utf8ToBase64(content), branch };
    if (sha) body.sha = sha;
    let r2;
    try {
      r2 = await fetch(api, { method: 'PUT', headers, body: JSON.stringify(body) });
    } catch (e) {
      throw new Error('网络请求失败，请检查网络连接');
    }
    if (r2.ok) {
      const j = await r2.json();
      if (j && j.content && j.content.html_url) return j.content.html_url;
      return 'https://github.com/' + gh.repo.trim() + '/blob/' + branch + '/' + path;
    }
    if (r2.status === 401 || r2.status === 404) throw ghError(r2.status);
    let msg = '推送失败（HTTP ' + r2.status + '）';
    try { const j = await r2.json(); if (j && j.message) msg += '：' + j.message; } catch (e) {}
    throw new Error(msg);
  }

  return { PLUGIN_DEFS, ECO_LINKS, list, get, getConfig, setConfig, toggle, isEnabled, getGithub, githubPush };
})();
