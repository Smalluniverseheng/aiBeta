/* ==================== TOKENSTATS · Token 用量统计 ====================
 * 记账口径：usage 优先取 API 真实返回（prompt/completion 为真实 token 数）；
 * 接口未返回 usage 时，用 estimate() 对请求/返回文本本地估算，并标记 estimated=true
 * （估算仅供趋势参考，非精确计费值）。
 * 数据落在 Store.state.tokenStats.byModel[modelId]，随 Store 持久化到本地。
 * 加载顺序无硬性要求：所有入口都对 Store/getModel 缺失做了容错。
 */
const TokenStats = (() => {

  /* ---------- 轻量 token 估算（无外部库） ----------
   * CJK（汉字/日文假名/韩文音节，含中文标点与全角字符）≈ 1 token / 字；
   * ASCII 英文/数字等半角字符 ≈ 1 token / 4 字符；
   * 其他 unicode ≈ 1 token / 2 字符；结果向上取整。 */
  function estimate(text) {
    if (!text) return 0;
    text = String(text);
    let cjk = 0, ascii = 0, other = 0;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      // 代理对（扩展 B 区以后的汉字等）按 1 个 CJK 字计
      if (code >= 0xD800 && code <= 0xDBFF && i + 1 < text.length) { cjk++; i++; continue; }
      if (
        (code >= 0x4E00 && code <= 0x9FFF) ||  // CJK 统一表意文字
        (code >= 0x3400 && code <= 0x4DBF) ||  // 扩展 A
        (code >= 0xF900 && code <= 0xFAFF) ||  // 兼容表意文字
        (code >= 0x3000 && code <= 0x303F) ||  // CJK 标点（。、「」等）
        (code >= 0xFF00 && code <= 0xFFEF) ||  // 全角标点 / 全角英数
        (code >= 0x3040 && code <= 0x30FF) ||  // 日文假名
        (code >= 0xAC00 && code <= 0xD7AF)     // 韩文音节
      ) cjk++;
      else if (code < 0x80) ascii++;
      else other++;
    }
    return Math.ceil(cjk + ascii / 4 + other / 2);
  }

  /* ---------- 存储结构（老数据/字段缺失自动初始化，容错） ---------- */
  function bucket() {
    if (typeof Store === 'undefined' || !Store.state) return null;
    const s = Store.state;
    if (!s.tokenStats || typeof s.tokenStats !== 'object') s.tokenStats = { byModel: {}, updatedAt: 0 };
    if (!s.tokenStats.byModel || typeof s.tokenStats.byModel !== 'object') s.tokenStats.byModel = {};
    return s.tokenStats;
  }

  /* ---------- 记账 ----------
   * modelId：模型 ID
   * usage：{ prompt:number, completion:number, estimated:boolean }
   * 累加到 byModel[modelId] = {prompt, completion, count, firstTs, lastTs}
   * （count 为调用次数；firstTs 仅首次写入；lastTs 每次更新），并刷新 updatedAt 后持久化。 */
  function record(modelId, usage) {
    try {
      const ts = bucket();
      if (!ts || !modelId || !usage) return;
      const now = Date.now();
      const b = ts.byModel[modelId] || (ts.byModel[modelId] = { prompt: 0, completion: 0, count: 0, firstTs: now, lastTs: now });
      b.prompt += Math.max(0, Math.round(usage.prompt || 0));
      b.completion += Math.max(0, Math.round(usage.completion || 0));
      b.count += 1;
      if (!b.firstTs) b.firstTs = now;
      b.lastTs = now;
      ts.updatedAt = now;
      Store.save();
    } catch (e) { /* 记账失败不影响对话 */ }
  }

  /* ---------- 按厂商聚合 ----------
   * 目录（getModel）里已不存在的模型归入 provider='其他/已移除'，name 用 id 兜底。
   * 返回按总用量降序：[{provider, prompt, completion, total, count, lastTs, models:[...]}] */
  function byProvider() {
    const ts = bucket();
    const map = {};
    if (ts) {
      Object.keys(ts.byModel).forEach(id => {
        const b = ts.byModel[id];
        const m = typeof getModel === 'function' ? getModel(id) : null;
        const provider = m ? m.provider : '其他/已移除';
        const name = m ? (m.name || id) : id;
        const total = (b.prompt || 0) + (b.completion || 0);
        const p = map[provider] || (map[provider] = { provider, prompt: 0, completion: 0, total: 0, count: 0, lastTs: 0, models: [] });
        p.prompt += b.prompt || 0;
        p.completion += b.completion || 0;
        p.total += total;
        p.count += b.count || 0;
        if ((b.lastTs || 0) > p.lastTs) p.lastTs = b.lastTs;
        p.models.push({
          id, name,
          prompt: b.prompt || 0, completion: b.completion || 0, total,
          count: b.count || 0, firstTs: b.firstTs || 0, lastTs: b.lastTs || 0
        });
      });
    }
    const arr = Object.keys(map).map(k => map[k]);
    arr.forEach(p => p.models.sort((a, b) => b.total - a.total));
    arr.sort((a, b) => b.total - a.total);
    return arr;
  }

  /* ---------- 全局合计：{prompt, completion, total, count} ---------- */
  function grand() {
    const ts = bucket();
    const g = { prompt: 0, completion: 0, total: 0, count: 0 };
    if (ts) {
      Object.keys(ts.byModel).forEach(id => {
        const b = ts.byModel[id];
        g.prompt += b.prompt || 0;
        g.completion += b.completion || 0;
        g.count += b.count || 0;
      });
    }
    g.total = g.prompt + g.completion;
    return g;
  }

  /* ---------- 数字格式化：999 → '999'；12400 → '12.4K'；1234567 → '1.23M' ---------- */
  function fmt(n) {
    n = Number(n) || 0;
    if (n < 1000) return String(Math.round(n));
    if (n < 1e6) return (n / 1e3).toFixed(1) + 'K';
    return (n / 1e6).toFixed(2) + 'M';
  }

  /* ---------- 清空统计（只动 tokenStats，不影响 Store 其他字段） ---------- */
  function reset() {
    const ts = bucket();
    if (!ts) return;
    ts.byModel = {};
    ts.updatedAt = 0;
    try { Store.save(); } catch (e) {}
  }

  return { estimate, record, byProvider, grand, fmt, reset };
})();
