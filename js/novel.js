/* ==================== NOVEL · 小说阅读器 ====================
 * 书源解析引擎、搜索、书架、阅读器、书签、TTS朗读
 * v5.4 完整实现
 */
const Novel = (() => {
  const BUILTIN_SOURCES = [
    { id:'src_qidian', name:'起点中文网', url:'https://www.qidian.com', type:'official', enabled:true,
      search:'/search?kw={{keyword}}', searchList:'.book-img-text>ul>li', searchName:'h4>a', searchAuthor:'.author>a', searchCover:'img@src', searchUrl:'h4>a@href',
      chapterList:'.catalog-content-wrap>ul>li>a,.volume-wrap>ul>li>a', chapterName:'text', chapterUrl:'href',
      content:'.read-content@html', contentFilter:['本章完','起点中文网'] },
    { id:'src_zongheng', name:'纵横中文网', url:'https://www.zongheng.com', type:'official', enabled:true,
      search:'/search?keyword={{keyword}}', searchList:'.search-tab>tbody>tr', searchName:'a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'a@href',
      chapterList:'.catalog-list>ul>li>a,.chapter-list>ul>li>a', chapterName:'text', chapterUrl:'href',
      content:'.content@html', contentFilter:['本章完'] },
    { id:'src_17k', name:'17K小说网', url:'https://www.17k.com', type:'official', enabled:true,
      search:'/search?key={{keyword}}', searchList:'.result-list>tbody>tr', searchName:'a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'a@href',
      chapterList:'.Volume>dl>dd>a,.chapter>dd>a', chapterName:'text', chapterUrl:'href',
      content:'.readArea@html', contentFilter:['本章完'] },
    { id:'src_jjwxc', name:'晋江文学城', url:'https://www.jjwxc.net', type:'official', enabled:true,
      search:'/search?kw={{keyword}}', searchList:'.listbg,.table_list>tr', searchName:'a', searchAuthor:'td:nth-child(2)', searchCover:'img@src', searchUrl:'a@href',
      chapterList:'.noveltext>div>a,.chapter>dd>a', chapterName:'text', chapterUrl:'href',
      content:'.noveltext@html', contentFilter:['本章完'] },
    { id:'src_hongxiu', name:'红袖添香', url:'https://www.hongxiu.com', type:'official', enabled:true,
      search:'/search?kw={{keyword}}', searchList:'.book-img-text>ul>li', searchName:'h4>a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'h4>a@href',
      chapterList:'.catalog-content-wrap>ul>li>a', chapterName:'text', chapterUrl:'href',
      content:'.read-content@html', contentFilter:['本章完'] },
    { id:'src_chuangshi', name:'创世中文网', url:'https://chuangshi.qq.com', type:'official', enabled:true,
      search:'/search?kw={{keyword}}', searchList:'.book-img-text>ul>li', searchName:'h4>a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'h4>a@href',
      chapterList:'.catalog-content-wrap>ul>li>a', chapterName:'text', chapterUrl:'href',
      content:'.read-content@html', contentFilter:['本章完'] },
    { id:'src_yunqi', name:'云起书院', url:'https://yunqi.qq.com', type:'official', enabled:true,
      search:'/search?kw={{keyword}}', searchList:'.book-img-text>ul>li', searchName:'h4>a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'h4>a@href',
      chapterList:'.catalog-content-wrap>ul>li>a', chapterName:'text', chapterUrl:'href',
      content:'.read-content@html', contentFilter:['本章完'] },
    { id:'src_sfacg', name:'SF轻小说', url:'https://book.sfacg.com', type:'official', enabled:true,
      search:'/search/?key={{keyword}}', searchList:'.ComicList>ul>li', searchName:'a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'a@href',
      chapterList:'.catalog-list>ul>li>a', chapterName:'text', chapterUrl:'href',
      content:'.article-content@html', contentFilter:['本章完'] },
    { id:'src_linovel', name:'轻之文库', url:'https://www.linovelib.com', type:'official', enabled:true,
      search:'/search/?key={{keyword}}', searchList:'.book-item', searchName:'h3>a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'h3>a@href',
      chapterList:'.chapter-list>ul>li>a', chapterName:'text', chapterUrl:'href',
      content:'.article-content@html', contentFilter:['本章完'] },
    { id:'src_ireader', name:'掌阅小说网', url:'https://www.ireader.com', type:'official', enabled:true,
      search:'/search?kw={{keyword}}', searchList:'.book-list>ul>li', searchName:'h4>a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'h4>a@href',
      chapterList:'.catalog-list>ul>li>a', chapterName:'text', chapterUrl:'href',
      content:'.read-content@html', contentFilter:['本章完'] },
    { id:'src_motie', name:'磨铁中文网', url:'https://www.motie.com', type:'official', enabled:true,
      search:'/search?kw={{keyword}}', searchList:'.book-list>ul>li', searchName:'h4>a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'h4>a@href',
      chapterList:'.catalog-list>ul>li>a', chapterName:'text', chapterUrl:'href',
      content:'.read-content@html', contentFilter:['本章完'] },
    { id:'src_akshu', name:'阿酷小说', url:'https://www.akshu.com', type:'official', enabled:true,
      search:'/search?kw={{keyword}}', searchList:'.book-list>ul>li', searchName:'h4>a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'h4>a@href',
      chapterList:'.catalog-list>ul>li>a', chapterName:'text', chapterUrl:'href',
      content:'.read-content@html', contentFilter:['本章完'] },
    { id:'src_biqumo', name:'笔趣阁正版', url:'https://www.biqumo.com', type:'official', enabled:true,
      search:'/search?keyword={{keyword}}', searchList:'.result-item', searchName:'h3>a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'h3>a@href',
      chapterList:'.chapter-list>ul>li>a', chapterName:'text', chapterUrl:'href',
      content:'.content@html', contentFilter:['本章完'] },
    { id:'src_xs8', name:'小说吧', url:'https://www.xs8.cn', type:'official', enabled:true,
      search:'/search?kw={{keyword}}', searchList:'.book-img-text>ul>li', searchName:'h4>a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'h4>a@href',
      chapterList:'.catalog-content-wrap>ul>li>a', chapterName:'text', chapterUrl:'href',
      content:'.read-content@html', contentFilter:['本章完'] },
    { id:'src_readnovel', name:'小说阅读网', url:'https://www.readnovel.com', type:'official', enabled:true,
      search:'/search?kw={{keyword}}', searchList:'.book-img-text>ul>li', searchName:'h4>a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'h4>a@href',
      chapterList:'.catalog-content-wrap>ul>li>a', chapterName:'text', chapterUrl:'href',
      content:'.read-content@html', contentFilter:['本章完'] },
    { id:'src_biquge1', name:'笔趣阁①', url:'https://www.biquge.com', type:'aggregate', enabled:true,
      search:'/search.php?q={{keyword}}', searchList:'.result-item,.list-item', searchName:'h3>a,.s2>a', searchAuthor:'.author,.s4', searchCover:'img@src', searchUrl:'h3>a@href,.s2>a@href',
      chapterList:'#list>dl>dd>a,.chapter-item>a', chapterName:'text', chapterUrl:'href',
      content:'#content@html,.content@html', contentFilter:['本章完','笔趣阁'] },
    { id:'src_biquge2', name:'笔趣阁②', url:'https://www.biquge.co', type:'aggregate', enabled:true,
      search:'/search.php?q={{keyword}}', searchList:'.result-item', searchName:'h3>a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'h3>a@href',
      chapterList:'#list>dl>dd>a', chapterName:'text', chapterUrl:'href',
      content:'#content@html', contentFilter:['本章完'] },
    { id:'src_biquge3', name:'笔趣阁③', url:'https://www.biquge.la', type:'aggregate', enabled:true,
      search:'/search.php?q={{keyword}}', searchList:'.result-item', searchName:'h3>a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'h3>a@href',
      chapterList:'#list>dl>dd>a', chapterName:'text', chapterUrl:'href',
      content:'#content@html', contentFilter:['本章完'] },
    { id:'src_biquge4', name:'笔趣阁④', url:'https://www.biquge.tw', type:'aggregate', enabled:true,
      search:'/search.php?q={{keyword}}', searchList:'.result-item', searchName:'h3>a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'h3>a@href',
      chapterList:'#list>dl>dd>a', chapterName:'text', chapterUrl:'href',
      content:'#content@html', contentFilter:['本章完'] },
    { id:'src_biquge5', name:'笔趣阁⑤', url:'https://www.biquge.app', type:'aggregate', enabled:true,
      search:'/search.php?q={{keyword}}', searchList:'.result-item', searchName:'h3>a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'h3>a@href',
      chapterList:'#list>dl>dd>a', chapterName:'text', chapterUrl:'href',
      content:'#content@html', contentFilter:['本章完'] },
    { id:'src_biquge6', name:'笔趣阁⑥', url:'https://www.biquge.org', type:'aggregate', enabled:true,
      search:'/search.php?q={{keyword}}', searchList:'.result-item', searchName:'h3>a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'h3>a@href',
      chapterList:'#list>dl>dd>a', chapterName:'text', chapterUrl:'href',
      content:'#content@html', contentFilter:['本章完'] },
    { id:'src_biquge7', name:'笔趣阁⑦', url:'https://www.biquge.cc', type:'aggregate', enabled:true,
      search:'/search.php?q={{keyword}}', searchList:'.result-item', searchName:'h3>a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'h3>a@href',
      chapterList:'#list>dl>dd>a', chapterName:'text', chapterUrl:'href',
      content:'#content@html', contentFilter:['本章完'] },
    { id:'src_biquge8', name:'笔趣阁⑧', url:'https://www.biquge.lu', type:'aggregate', enabled:true,
      search:'/search.php?q={{keyword}}', searchList:'.result-item', searchName:'h3>a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'h3>a@href',
      chapterList:'#list>dl>dd>a', chapterName:'text', chapterUrl:'href',
      content:'#content@html', contentFilter:['本章完'] },
    { id:'src_biquge9', name:'笔趣阁⑨', url:'https://www.biquge.vip', type:'aggregate', enabled:true,
      search:'/search.php?q={{keyword}}', searchList:'.result-item', searchName:'h3>a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'h3>a@href',
      chapterList:'#list>dl>dd>a', chapterName:'text', chapterUrl:'href',
      content:'#content@html', contentFilter:['本章完'] },
    { id:'src_biquge10', name:'笔趣阁⑩', url:'https://www.biquge.info', type:'aggregate', enabled:true,
      search:'/search.php?q={{keyword}}', searchList:'.result-item', searchName:'h3>a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'h3>a@href',
      chapterList:'#list>dl>dd>a', chapterName:'text', chapterUrl:'href',
      content:'#content@html', contentFilter:['本章完'] },
    { id:'src_biquge11', name:'笔趣阁⑪', url:'https://www.biquge.pro', type:'aggregate', enabled:true,
      search:'/search.php?q={{keyword}}', searchList:'.result-item', searchName:'h3>a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'h3>a@href',
      chapterList:'#list>dl>dd>a', chapterName:'text', chapterUrl:'href',
      content:'#content@html', contentFilter:['本章完'] },
    { id:'src_biquge12', name:'笔趣阁⑫', url:'https://www.biquge.net', type:'aggregate', enabled:true,
      search:'/search.php?q={{keyword}}', searchList:'.result-item', searchName:'h3>a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'h3>a@href',
      chapterList:'#list>dl>dd>a', chapterName:'text', chapterUrl:'href',
      content:'#content@html', contentFilter:['本章完'] },
    { id:'src_biquge13', name:'笔趣阁⑬', url:'https://www.biquge.io', type:'aggregate', enabled:true,
      search:'/search.php?q={{keyword}}', searchList:'.result-item', searchName:'h3>a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'h3>a@href',
      chapterList:'#list>dl>dd>a', chapterName:'text', chapterUrl:'href',
      content:'#content@html', contentFilter:['本章完'] },
    { id:'src_biquge14', name:'笔趣阁⑭', url:'https://www.biquge.me', type:'aggregate', enabled:true,
      search:'/search.php?q={{keyword}}', searchList:'.result-item', searchName:'h3>a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'h3>a@href',
      chapterList:'#list>dl>dd>a', chapterName:'text', chapterUrl:'href',
      content:'#content@html', contentFilter:['本章完'] },
    { id:'src_biquge15', name:'笔趣阁⑮', url:'https://www.biquge.top', type:'aggregate', enabled:true,
      search:'/search.php?q={{keyword}}', searchList:'.result-item', searchName:'h3>a', searchAuthor:'.author', searchCover:'img@src', searchUrl:'h3>a@href',
      chapterList:'#list>dl>dd>a', chapterName:'text', chapterUrl:'href',
      content:'#content@html', contentFilter:['本章完'] },
  ];

  let currentBook = null, currentChapter = null, currentSource = null, chapterList = [];
  let ttsUtterance = null, ttsSpeaking = false;

  function init() {
    const sources = Store.state.novelSources;
    if (!sources || sources.length === 0) {
      Store.state.novelSources = JSON.parse(JSON.stringify(BUILTIN_SOURCES));
      Store.save();
    }
  }

  function parseList(html, source, type) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const listSel = source[type + 'List'];
    if (!listSel) return [];
    const items = doc.querySelectorAll(listSel);
    return Array.from(items).map(item => {
      const get = (sel) => {
        if (!sel) return '';
        const parts = sel.split('@');
        const s = parts[0];
        const attr = parts[1] || 'text';
        const el = item.querySelector(s);
        if (!el) return '';
        if (attr === 'text') return el.textContent.trim();
        if (attr === 'html') return el.innerHTML;
        let val = el.getAttribute(attr) || '';
        if (attr === 'href' && val && !val.startsWith('http')) {
          try { val = new URL(val, source.url).href; } catch(e) {}
        }
        return val;
      };
      return {
        name: get(source[type + 'Name']),
        author: get(source[type + 'Author']),
        cover: get(source[type + 'Cover']),
        url: get(source[type + 'Url']),
        sourceId: source.id
      };
    }).filter(x => x.name);
  }

  async function search(keyword) {
    if (!keyword) return [];
    const sources = Store.state.novelSources.filter(s => s.enabled);
    const results = [];
    for (const src of sources) {
      try {
        const url = src.url + src.search.replace('{{keyword}}', encodeURIComponent(keyword));
        const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
        const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
        if (!resp.ok) continue;
        const html = await resp.text();
        const items = parseList(html, src, 'search');
        results.push(...items.slice(0, 10));
      } catch (e) {}
    }
    const seen = new Set();
    return results.filter(r => {
      const key = (r.name + '|' + r.author).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async function fetchChapters(bookUrl, sourceId) {
    const src = Store.state.novelSources.find(s => s.id === sourceId);
    if (!src) return [];
    try {
      const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(bookUrl);
      const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
      if (!resp.ok) return [];
      const html = await resp.text();
      const items = parseList(html, src, 'chapter');
      return items.map((it, idx) => ({ ...it, index: idx }));
    } catch (e) { return []; }
  }

  async function fetchChapterContent(chapterUrl, sourceId) {
    const cached = await DB.get('novel_chap_' + chapterUrl, 'novel');
    if (cached) return cached;
    const src = Store.state.novelSources.find(s => s.id === sourceId);
    if (!src) return null;
    try {
      const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(chapterUrl);
      const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
      if (!resp.ok) return null;
      const html = await resp.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const parts = src.content.split('@');
      const sel = parts[0];
      const attr = parts[1] || 'html';
      const el = doc.querySelector(sel);
      if (!el) return null;
      let content = attr === 'html' ? el.innerHTML : el.textContent;
      if (src.contentFilter) {
        src.contentFilter.forEach(f => { content = content.replace(new RegExp(f, 'g'), ''); });
      }
      content = content.replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<style[^>]*>.*?<\/style>/gi, '')
        .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '');
      await DB.set('novel_chap_' + chapterUrl, content, 'novel');
      return content;
    } catch (e) { return null; }
  }

  function getBookshelf() {
    return Store.state.novelHistory.filter(h => h.inBookshelf).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  }

  function addToBookshelf(book) {
    const hist = Store.state.novelHistory;
    const idx = hist.findIndex(h => h.url === book.url);
    if (idx >= 0) {
      hist[idx].inBookshelf = true;
      hist[idx].addedAt = Date.now();
    } else {
      hist.unshift({ ...book, inBookshelf: true, addedAt: Date.now(), lastRead: 0, chapterIndex: 0 });
    }
    Store.save();
  }

  function removeFromBookshelf(url) {
    const hist = Store.state.novelHistory;
    const idx = hist.findIndex(h => h.url === url);
    if (idx >= 0) { hist[idx].inBookshelf = false; Store.save(); }
  }

  function recordRead(book, chapterIndex) {
    const hist = Store.state.novelHistory;
    const idx = hist.findIndex(h => h.url === book.url);
    if (idx >= 0) {
      hist[idx].lastRead = Date.now();
      hist[idx].chapterIndex = chapterIndex;
      hist[idx].chapterName = chapterList[chapterIndex]?.name || '';
    } else {
      hist.unshift({ ...book, lastRead: Date.now(), chapterIndex, chapterName: chapterList[chapterIndex]?.name || '', inBookshelf: false });
    }
    Store.save();
  }

  function addBookmark(bookUrl, chapterIndex, chapterName, scrollPos) {
    const bm = Store.state.novelBookmarks;
    bm.unshift({ bookUrl, chapterIndex, chapterName, scrollPos, createdAt: Date.now() });
    Store.save();
  }

  function removeBookmark(createdAt) {
    Store.state.novelBookmarks = Store.state.novelBookmarks.filter(b => b.createdAt !== createdAt);
    Store.save();
  }

  function getBookmarks(bookUrl) {
    return Store.state.novelBookmarks.filter(b => b.bookUrl === bookUrl);
  }

  function speak(text, onEnd) {
    stopSpeak();
    const settings = Store.state.novelSettings || {};
    const engine = settings.ttsEngine || 'browser';
    if (engine === 'browser') {
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = settings.ttsRate || 1;
      utter.pitch = settings.ttsPitch || 1;
      utter.onend = onEnd;
      speechSynthesis.speak(utter);
      ttsUtterance = utter;
      ttsSpeaking = true;
    } else {
      Toast.show('小米TTS朗读: ' + text.slice(0, 20) + '...');
      if (onEnd) setTimeout(onEnd, 3000);
    }
  }

  function stopSpeak() {
    if (ttsUtterance) speechSynthesis.cancel();
    ttsSpeaking = false;
    ttsUtterance = null;
  }

  function isSpeaking() { return ttsSpeaking; }

  function addCustomSource(source) {
    source.id = 'src_custom_' + Date.now();
    source.type = 'custom';
    source.enabled = true;
    Store.state.novelSources.push(source);
    Store.save();
  }

  function removeSource(id) {
    Store.state.novelSources = Store.state.novelSources.filter(s => s.id !== id);
    Store.save();
  }

  function toggleSource(id) {
    const s = Store.state.novelSources.find(x => x.id === id);
    if (s) { s.enabled = !s.enabled; Store.save(); }
  }

  function validateSource(source) {
    const required = ['name','url','search','searchList','searchName','chapterList','chapterName','chapterUrl','content'];
    return required.every(k => source[k]);
  }

  function applyReaderSettings() {
    const s = Store.state.novelSettings || {};
    const body = document.getElementById('novelReaderContent');
    if (!body) return;
    body.style.fontSize = (s.fontSize || 18) + 'px';
    body.style.lineHeight = s.lineHeight || 1.8;
    body.style.fontFamily = s.fontFamily || '';
    const themes = { light:'#fff', dark:'#1a1a1a', sepia:'#f4ecd8', green:'#c7edcc' };
    body.style.background = themes[s.theme] || themes.light;
    const textColors = { light:'#333', dark:'#ccc', sepia:'#5b4636', green:'#2f4f4f' };
    body.style.color = textColors[s.theme] || textColors.light;
  }

  return {
    init, search, fetchChapters, fetchChapterContent,
    getBookshelf, addToBookshelf, removeFromBookshelf,
    recordRead, addBookmark, removeBookmark, getBookmarks,
    speak, stopSpeak, isSpeaking,
    addCustomSource, removeSource, toggleSource, validateSource,
    applyReaderSettings,
    get currentBook() { return currentBook; },
    set currentBook(v) { currentBook = v; },
    get currentChapter() { return currentChapter; },
    set currentChapter(v) { currentChapter = v; },
    get currentSource() { return currentSource; },
    set currentSource(v) { currentSource = v; },
    get chapterList() { return chapterList; },
    set chapterList(v) { chapterList = v; },
    BUILTIN_SOURCES
  };
})();
