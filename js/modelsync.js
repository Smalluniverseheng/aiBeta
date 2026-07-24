/* ==================== MODELSYNC · 模型目录实时同步 ====================
 * 从已配置 API Key 的厂商拉取 /v1/models 实时列表：
 *   - 厂商返回的新模型 → 以 status:'new' 合并进目录（存于本地，刷新不丢）
 *   - 目录中有但厂商列表中已没有的 → 标记 status:'deprecated'（已下架）
 * 手动维护仍只需编辑 js/models.js 嵌入式文件。
 */
const ModelSync = (() => {
  const SYNC_KEY = 'ai_models_sync_v1';

  function getSyncData() {
    try { return JSON.parse(localStorage.getItem(SYNC_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveSyncData(d) { localStorage.setItem(SYNC_KEY, JSON.stringify(d)); }

  /* 各厂商模型列表接口 */
  async function fetchProviderModels(provider) {
    const cfg = PROVIDERS[provider];
    if (!cfg) throw new Error('未知厂商');
    const key = getKeyForModel({ provider });
    if (!key) throw new Error('未配置 Key');

    if (cfg.format === 'google') {
      const resp = await fetch(cfg.base() + '/v1beta/models?key=' + encodeURIComponent(key) + '&pageSize=100');
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const d = await resp.json();
      return (d.models || []).map(m => String(m.name || '').replace(/^models\//, '')).filter(Boolean);
    }

    const headers = cfg.format === 'anthropic'
      ? { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }
      : cfg.headers(key);
    const resp = await fetch(cfg.base() + '/v1/models', { headers });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const d = await resp.json();
    return (d.data || []).map(m => m.id).filter(Boolean);
  }

  /* 同步单个厂商 */
  async function syncProvider(provider) {
    const ids = await fetchProviderModels(provider);
    const data = getSyncData();
    data[provider] = { ids, ts: Date.now() };
    saveSyncData(data);
    ModelCatalog.rebuild();
    return ids;
  }

  /* 同步所有已配置 Key 的厂商（返回各厂商结果） */
  async function syncAll(onProgress) {
    const providers = Object.keys(PROVIDERS).filter(p => {
      try { return !!getKeyForModel({ provider: p }); } catch (e) { return false; }
    });
    const results = {};
    for (const p of providers) {
      if (onProgress) onProgress(p);
      try { results[p] = { ok: true, count: (await syncProvider(p)).length }; }
      catch (e) { results[p] = { ok: false, error: e.message }; }
    }
    return results;
  }

  function lastSync(provider) {
    const d = getSyncData();
    return d[provider] ? d[provider].ts : null;
  }

  return { syncProvider, syncAll, lastSync, getSyncData };
})();

/* ==================== MODELCATALOG · 目录合并层 ====================
 * 运行时目录 = 嵌入式 MODELS + 同步得到的新模型（含下架标记合并）
 */
const ModelCatalog = (() => {
  let merged = [];

  function rebuild() {
    const sync = ModelSync.getSyncData();
    const base = MODELS.map(m => Object.assign({}, m));
    const byId = {};
    base.forEach(m => { byId[m.id] = m; });

    Object.keys(sync).forEach(provider => {
      const remoteIds = sync[provider].ids || [];
      const remoteSet = new Set(remoteIds);
      const providerModels = base.filter(m => m.provider === provider);

      // 厂商已同步过 → 本地有而远端没有的 chat 模型标记下架
      providerModels.forEach(m => {
        if ((m.type || 'chat') === 'chat' && !remoteSet.has(m.id) && m.status !== 'deprecated') {
          m.status = 'deprecated';
          m.autoDeprecated = true;
        }
      });
      // 远端有而本地没有 → 新增（仅保留看起来像对话模型的）
      remoteIds.forEach(id => {
        if (byId[id]) return;
        if (!looksLikeChatModel(id)) return;
        base.unshift({
          id, name: id, provider, type: 'chat', ctx: 128,
          vision: /vision|vl|omni|4o|gemini|claude|gpt-5/i.test(id),
          thinking: /reason|think|r1|o\d|deep/i.test(id),
          stream: true, status: 'new', fromSync: true
        });
        byId[id] = true;
      });
    });

    merged = base;
  }

  /* 过滤嵌入/语音/图像等非对话模型 ID */
  function looksLikeChatModel(id) {
    return !/embed|tts|whisper|dall-e|image|audio|transcri|moderation|search-rerank|rerank|bge-|clip/i.test(id);
  }

  function all() { if (!merged.length) rebuild(); return merged; }
  function get(id) { return all().find(m => m.id === id) || null; }
  function byProvider(p) { return all().filter(m => m.provider === p); }
  function providers() {
    const seen = {}, order = [];
    all().forEach(m => { if (!seen[m.provider]) { seen[m.provider] = 1; order.push(m.provider); } });
    return order;
  }

  return { rebuild, all, get, byProvider, providers };
})();
