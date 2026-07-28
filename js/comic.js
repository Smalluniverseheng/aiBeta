/* ==================== 漫画阅读器 · 图源/书架/搜索/阅读 ==================== */

const Comic = (() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = s => (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function getSources()  { return Store.state.comicSources || []; }
  function setSources(v) { Store.state.comicSources = v; Store.save(); }
  function getShelf()    { return Store.state.comicShelf || []; }
  function setShelf(v)   { Store.state.comicShelf = v; Store.save(); }

  function addSource(src) {
    const list = getSources();
    if (!list.find(s => s.name === src.name)) { list.push(src); setSources(list); }
  

  function isUrl(str) {
    return /^https?:\/\//i.test(str.trim());
  }

  async function fetchSourceFromUrl(url) {
    try {
      const resp = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return await resp.text();
    } catch(e) {
      try {
        const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
        const resp2 = await fetch(proxyUrl, { credentials: 'omit' });
        if (!resp2.ok) throw new Error('Proxy HTTP ' + resp2.status);
        return await resp2.text();
      } catch(e2) {
        throw new Error('无法下载图源: ' + e.message);
      }
    }
  }}
  function delSource(name) {
    setSources(getSources().filter(s => s.name !== name));
  }
  async function importSources(text) {
    try {
      const data = JSON.parse(text);
      const arr = Array.isArray(data) ? data : [data];
      let n = 0;
      arr.forEach(s => { if (s.name && s.url) { addSource(s); n++; } });
      return { ok: true, n };
    } catch(e) { return { ok: false, err: e.message }; }
  }

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

  async function searchBooks(keyword, sourceFilter) {
    const sources = sourceFilter ? getSources().filter(s => s.name === sourceFilter) : getSources();
    if (!sources.length) return { ok: false, err: '\u6ca1\u6709\u56fe\u6e90\uff0c\u8bf7\u5148\u5bfc\u5165\u56fe\u6e90' };
    const all = [];
    for (const src of sources) {
      try {
        const list = await searchOneSource(src, keyword);
        all.push(...list.map(b => ({ ...b, sourceName: src.name })));
      } catch(e) { console.warn('\u56fe\u6e90\u641c\u7d22\u5931\u8d25:', src.name, e); }
    }
    return { ok: true, list: all };
  }

  async function searchOneSource(src, keyword) {
    if (!src.searchUrl) return [];
    const url = src.url + src.searchUrl.replace('{{keyword}}', encodeURIComponent(keyword));
    try {
      const resp = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const html = await resp.text();
      return parseSearchHtml(html, src);
    } catch(e) { return []; }
  }

  function parseSearchHtml(html, src) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const items = [];
    const rows = doc.querySelectorAll(src.searchList || 'div');
    rows.forEach(row => {
      const nameEl = row.querySelector(src.searchName || 'a');
      const authorEl = src.searchAuthor ? row.querySelector(src.searchAuthor) : null;
      const urlEl = row.querySelector(src.searchUrl || 'a');
      const coverEl = src.searchCover ? row.querySelector(src.searchCover) : null;
      if (nameEl && urlEl) {
        const bookUrl = urlEl.getAttribute('href') || '';
        items.push({
          name: nameEl.textContent.trim(),
          author: authorEl ? authorEl.textContent.trim() : '',
          url: bookUrl.startsWith('http') ? bookUrl : (src.url + bookUrl),
          cover: coverEl ? (coverEl.getAttribute('src') || coverEl.getAttribute('data-src') || '') : '',
          sourceName: src.name
        });
      }
    });
    return items.slice(0, 20);
  }

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

  async function fetchImages(chapterUrl, src) {
    try {
      const resp = await fetch(chapterUrl, { mode: 'cors', credentials: 'omit' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const html = await resp.text();
      return parseImages(html, src);
    } catch(e) { return []; }
  }

  function parseImages(html, src) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const sel = src.images || 'img';
    const imgs = doc.querySelectorAll(sel);
    const list = [];
    imgs.forEach(img => {
      let src = img.getAttribute('src') || img.getAttribute('data-src') || '';
      if (src && !src.startsWith('http')) src = '';
      if (src) list.push(src);
    });
    return list;
  }

  /* ---------- UI ---------- */
  function renderShelf() {
    const box = $('comicShelf');
    if (!box) return;
    const books = getShelf();
    if (!books.length) {
      box.innerHTML = '<div class="novel-empty">\u4e66\u67b6\u4e3a\u7a7a\uff0c\u53bb\u641c\u7d22\u6dfb\u52a0\u6f2b\u753b\u5427</div>';
      return;
    }
    box.innerHTML = books.map(b => `
      <div class="comic-book-card" data-url="${esc(b.url)}" data-source="${esc(b.sourceName || '')}">
        <div class="comic-cover" style="background:${b.cover ? 'url('+esc(b.cover)+')' : '#444'} center/cover;"></div>
        <div class="comic-info">
          <div class="comic-title">${esc(b.name)}</div>
          <div class="comic-author">${esc(b.author || '\u672a\u77e5')}</div>
          <div class="comic-meta">${esc(b.sourceName || '')} · ${b.chapterName || '\u672a\u8bfb'}</div>
        </div>
      </div>
    `).join('');
  }

  function renderSearchResults(list) {
    const box = $('comicSearchResults');
    if (!box) return;
    if (!list || !list.length) {
      box.innerHTML = '<div class="novel-empty">\u672a\u627e\u5230\u7ed3\u679c</div>';
      return;
    }
    box.innerHTML = list.map(b => `
      <div class="comic-result-row" data-url="${esc(b.url)}" data-name="${esc(b.name)}" data-author="${esc(b.author || '')}" data-source="${esc(b.sourceName)}" data-cover="${esc(b.cover || '')}">
        <div class="comic-r-cover" style="background:${b.cover ? 'url('+esc(b.cover)+')' : '#444'} center/cover;"></div>
        <div class="comic-r-info">
          <div class="comic-r-title">${esc(b.name)}</div>
          <div class="comic-r-meta">${esc(b.author || '\u672a\u77e5')} · ${esc(b.sourceName)}</div>
          <button class="novel-add-shelf-btn" data-url="${esc(b.url)}">${inShelf(b.url) ? '\u5df2\u5728\u4e66\u67b6' : '\u52a0\u5165\u4e66\u67b6'}</button>
        </div>
      </div>
    `).join('');
  }

  function renderSourceList() {
    const box = $('comicSourceList');
    if (!box) return;
    const list = getSources();
    box.innerHTML = list.map(s => `
      <div class="novel-source-row">
        <span class="novel-src-name">${esc(s.name)}</span>
        <span class="novel-src-url">${esc(s.url)}</span>
        <button class="novel-src-del" data-name="${esc(s.name)}">\u5220\u9664</button>
      </div>
    `).join('') || '<div class="novel-empty">\u6682\u65e0\u56fe\u6e90\uff0c\u8bf7\u5bfc\u5165</div>';
  }

  function renderChapterList(chapters, currentIdx) {
    const box = $('comicChapterList');
    if (!box) return;
    box.innerHTML = chapters.map((ch, i) => `
      <div class="novel-chapter-row ${i === currentIdx ? 'active' : ''}" data-idx="${i}">${esc(ch.name)}</div>
    `).join('');
  }

  function renderReader(images, title) {
    const box = $('comicReaderContent');
    const head = $('comicReaderTitle');
    if (head) head.textContent = title || '';
    if (box) {
      box.innerHTML = images.map(url => `
        <img class="comic-page-img" src="${esc(url)}" loading="lazy" alt="\u6f2b\u753b\u9875">
      `).join('');
    }
  }

  return {
    getSources, addSource, delSource, importSources,
    getShelf, addShelf, delShelf, inShelf, updateShelf,
    searchBooks, fetchChapters, fetchImages,
    renderShelf, renderSearchResults, renderSourceList, renderChapterList, renderReader
  };
})();
