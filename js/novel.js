/* ==================== 小说阅读器 · 书源/书架/搜索/阅读 ==================== */

const Novel = (() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = s => (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* ---------- 数据读写 ---------- */
  function getSources()  { return Store.state.novelSources || []; }
  function setSources(v) { Store.state.novelSources = v; Store.save(); }
  function getShelf()    { return Store.state.novelShelf || []; }
  function setShelf(v)   { Store.state.novelShelf = v; Store.save(); }
  function getHistory()  { return Store.state.novelHistory || []; }
  function setHistory(v) { Store.state.novelHistory = v; Store.save(); }

  /* ---------- 书源管理 ---------- */
  function addSource(src) {
    const list = getSources();
    if (!list.find(s => s.name === src.name)) { list.push(src); setSources(list); }
  }
  function delSource(name) {
    setSources(getSources().filter(s => s.name !== name));
  }
  /* 从混杂文本中智能提取 JSON 书源 */
  function extractSources(text) {
    const sources = [];
    // 策略1: 尝试直接解析整个文本为 JSON
    try {
      const data = JSON.parse(text);
      const arr = Array.isArray(data) ? data : [data];
      arr.forEach(s => { if (s && s.name && s.url) sources.push(s); });
      if (sources.length) return sources;
    } catch(e) {}
    // 策略2: 从文本中提取所有 JSON 对象/数组
    // 匹配 {...} 和 [...]
    const objRegex = /\{[\s\S]*?\}/g;
    const arrRegex = /\[[\s\S]*?\]/g;
    let match;
    // 先尝试数组
    while ((match = arrRegex.exec(text)) !== null) {
      try {
        const arr = JSON.parse(match[0]);
        if (Array.isArray(arr)) {
          arr.forEach(s => { if (s && s.name && s.url) sources.push(s); });
        }
      } catch(e) {}
    }
    if (sources.length) return sources;
    // 再尝试单个对象
    while ((match = objRegex.exec(text)) !== null) {
      try {
        const obj = JSON.parse(match[0]);
        if (obj && obj.name && obj.url) sources.push(obj);
      } catch(e) {}
    }
    return sources;
  }

  function importSources(text) {
    const sources = extractSources(text);
    if (!sources.length) return { ok: false, err: '未识别到有效书源，请检查格式（需要包含 name 和 url 字段）' };
    let n = 0;
    sources.forEach(s => { if (!getSources().find(x => x.name === s.name)) { addSource(s); n++; } });
    return { ok: true, n, total: sources.length };
  }

  /* 验证书源可用性 */
  async function verifySource(src) {
    try {
      const resp = await fetch(src.url, { mode: 'cors', credentials: 'omit', method: 'HEAD' });
      return { ok: resp.ok, status: resp.status };
    } catch(e) {
      return { ok: false, err: e.message };
    }
  }

  async function verifyAllSources() {
    const list = getSources();
    const results = [];
    for (const src of list) {
      const res = await verifySource(src);
      results.push({ name: src.name, ...res });
    }
    return results;
  }

  /* ---------- 书架 ---------- */
  function inShelf(url) { return getShelf().some(b => b.url === url); }
  function addShelf(book) {
    if (inShelf(book.url)) return;
    const list = getShelf();
    list.unshift({ ...book, addedAt: Date.now(), readAt: 0, chapterIdx: 0, chapterName: '' });
    setShelf(list);
  }
  function delShelf(url) {
    setShelf(getShelf().filter(b => b.url !== url));
  }
  function updateShelf(url, patch) {
    const list = getShelf().map(b => b.url === url ? { ...b, ...patch } : b);
    setShelf(list);
  }

  /* ---------- 搜索 ---------- */
  async function searchBooks(keyword, sourceFilter) {
    const sources = sourceFilter
      ? getSources().filter(s => s.name === sourceFilter)
      : getSources();
    if (!sources.length) return { ok: false, err: '没有书源，请先导入书源' };

    const all = [];
    for (const src of sources) {
      try {
        const list = await searchOneSource(src, keyword);
        all.push(...list.map(b => ({ ...b, sourceName: src.name })));
      } catch(e) { console.warn('书源搜索失败:', src.name, e); }
    }
    return { ok: true, list: all };
  }

  /* 单书源搜索（通过 CORS 代理或直接请求） */
  async function searchOneSource(src, keyword) {
    if (!src.searchUrl) return [];
    const url = src.url + src.searchUrl.replace('{{keyword}}', encodeURIComponent(keyword));

    // 尝试直接请求（部分书源支持 CORS）
    try {
      const resp = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const html = await resp.text();
      return parseSearchHtml(html, src);
    } catch(e) {
      // 直接请求失败，返回空（用户可通过代理解决）
      console.warn('CORS 限制，无法直接请求书源:', src.name);
      return [];
    }
  }

  /* 解析搜索结果 HTML */
  function parseSearchHtml(html, src) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const items = [];
    const rows = doc.querySelectorAll(src.searchList || 'div');
    rows.forEach(row => {
      const nameEl = row.querySelector(src.searchName || 'a');
      const authorEl = src.searchAuthor ? row.querySelector(src.searchAuthor) : null;
      const urlEl = row.querySelector(src.searchUrl || 'a');
      if (nameEl && urlEl) {
        const bookUrl = urlEl.getAttribute('href') || '';
        items.push({
          name: nameEl.textContent.trim(),
          author: authorEl ? authorEl.textContent.trim() : '',
          url: bookUrl.startsWith('http') ? bookUrl : (src.url + bookUrl),
          cover: '',
          sourceName: src.name
        });
      }
    });
    return items.slice(0, 20);
  }

  /* ---------- 章节与正文 ---------- */
  async function fetchChapters(bookUrl, src) {
    try {
      const resp = await fetch(bookUrl, { mode: 'cors', credentials: 'omit' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const html = await resp.text();
      return parseChapters(html, src);
    } catch(e) { return []; }
  }

  function parseChapters(html, src) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const list = [];
    const rows = doc.querySelectorAll(src.chapterList || 'a');
    rows.forEach(a => {
      const href = a.getAttribute('href') || '';
      const url = href.startsWith('http') ? href : (src.url + href);
      list.push({ name: a.textContent.trim(), url });
    });
    return list;
  }

  async function fetchContent(chapterUrl, src) {
    try {
      const resp = await fetch(chapterUrl, { mode: 'cors', credentials: 'omit' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const html = await resp.text();
      return parseContent(html, src);
    } catch(e) { return '<p>加载失败，请检查网络或书源配置</p>'; }
  }

  function parseContent(html, src) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const sel = src.content || '#content';
    const el = doc.querySelector(sel);
    if (!el) return '<p>正文解析失败</p>';
    let text = el.innerHTML;
    // 过滤广告
    (src.contentFilter || []).forEach(bad => {
      text = text.replace(new RegExp(bad, 'gi'), '');
    });
    return text;
  }

  /* ---------- UI 渲染 ---------- */
  function renderShelf() {
    const box = $('novelShelf');
    if (!box) return;
    const books = getShelf();
    if (!books.length) {
      box.innerHTML = '<div class="novel-empty">\u4e66\u67b6\u4e3a\u7a7a\uff0c\u53bb\u641c\u7d22\u6dfb\u52a0\u4e66\u7c4d\u5427</div>';
      return;
    }
    box.innerHTML = books.map(b => `
      <div class="novel-book-card" data-url="${esc(b.url)}" data-source="${esc(b.sourceName || '')}">
        <div class="novel-cover">${esc(b.name[0] || '?')}</div>
        <div class="novel-info">
          <div class="novel-title">${esc(b.name)}</div>
          <div class="novel-author">${esc(b.author || '\u672a\u77e5\u4f5c\u8005')}</div>
          <div class="novel-meta">${esc(b.sourceName || '')} · ${b.chapterName || '\u672a\u8bfb'}</div>
        </div>
      </div>
    `).join('');
  }

  function renderSearchResults(list) {
    const box = $('novelSearchResults');
    if (!box) return;
    if (!list || !list.length) {
      box.innerHTML = '<div class="novel-empty">\u672a\u627e\u5230\u7ed3\u679c</div>';
      return;
    }
    box.innerHTML = list.map(b => `
      <div class="novel-result-row" data-url="${esc(b.url)}" data-name="${esc(b.name)}" data-author="${esc(b.author || '')}" data-source="${esc(b.sourceName)}">
        <div class="novel-r-title">${esc(b.name)}</div>
        <div class="novel-r-meta">${esc(b.author || '\u672a\u77e5\u4f5c\u8005')} · ${esc(b.sourceName)}</div>
        <button class="novel-add-shelf-btn" data-url="${esc(b.url)}">${inShelf(b.url) ? '\u5df2\u5728\u4e66\u67b6' : '\u52a0\u5165\u4e66\u67b6'}</button>
      </div>
    `).join('');
  }

  function renderSourceList() {
    const box = $('novelSourceList');
    if (!box) return;
    const list = getSources();
    box.innerHTML = list.map(s => `
      <div class="novel-source-row">
        <span class="novel-src-name">${esc(s.name)}</span>
        <span class="novel-src-url">${esc(s.url)}</span>
        <button class="novel-src-del" data-name="${esc(s.name)}">\u5220\u9664</button>
      </div>
    `).join('') || '<div class="novel-empty">\u6682\u65e0\u4e66\u6e90\uff0c\u8bf7\u5bfc\u5165</div>';
  }

  function renderChapterList(chapters, currentIdx) {
    const box = $('novelChapterList');
    if (!box) return;
    box.innerHTML = chapters.map((ch, i) => `
      <div class="novel-chapter-row ${i === currentIdx ? 'active' : ''}" data-idx="${i}">${esc(ch.name)}</div>
    `).join('');
  }

  function renderReader(content, title) {
    const box = $('novelReaderContent');
    const head = $('novelReaderTitle');
    if (head) head.textContent = title || '';
    if (box) box.innerHTML = content;
  }

  /* ---------- 公共 API ---------- */
  return {
    getSources, addSource, delSource, importSources,
    getShelf, addShelf, delShelf, inShelf, updateShelf,
    searchBooks, fetchChapters, fetchContent,
    renderShelf, renderSearchResults, renderSourceList, renderChapterList, renderReader, importSources, extractSources, verifySource, verifyAllSources
  };
})();
