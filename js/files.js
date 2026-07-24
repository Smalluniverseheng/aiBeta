/* ==================== FILES · 文件解析（图片 / 文本 / PDF / Word） ==================== */
const Files = (() => {

  const TEXT_EXTS = ['txt', 'md', 'markdown', 'json', 'csv', 'log', 'xml', 'yaml', 'yml', 'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'rb', 'php', 'html', 'css', 'scss', 'sql', 'sh', 'bat', 'ini', 'toml', 'vue', 'svelte'];
  const MAX_SIZE = 15 * 1024 * 1024;      // 15MB
  const MAX_TEXT_CHARS = 24000;           // 注入上下文的最大字符数

  function ext(name) { return (name.split('.').pop() || '').toLowerCase(); }

  /* ---------- PDF（pdf.js 按需从 CDN 加载） ---------- */
  async function ensurePdfJs() {
    if (window.pdfjsLib) return;
    await loadScript('https://registry.npmmirror.com/pdfjs-dist/3.11.174/files/build/pdf.min.js', () => window.pdfjsLib);
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://registry.npmmirror.com/pdfjs-dist/3.11.174/files/build/pdf.worker.min.js';
  }

  async function parsePdf(file) {
    await ensurePdfJs();
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    let text = '';
    const maxPages = Math.min(pdf.numPages, 60);
    for (let p = 1; p <= maxPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      text += tc.items.map(it => it.str).join(' ') + '\n';
      if (text.length > MAX_TEXT_CHARS * 2) break;
    }
    return text;
  }

  /* ---------- Word（mammoth 按需从 CDN 加载） ---------- */
  async function parseDocx(file) {
    await loadScript('https://registry.npmmirror.com/mammoth/latest/files/mammoth.browser.min.js', () => window.mammoth);
    const buf = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer: buf });
    return result.value || '';
  }

  /* ---------- 统一入口 ----------
   * 返回 { kind:'image'|'text', name, dataUrl?, text?, truncated? }
   */
  async function parse(file) {
    if (file.size > MAX_SIZE) throw new Error('文件过大（最大 15MB）：' + file.name);
    const e = ext(file.name);

    if (file.type.startsWith('image/')) {
      let dataUrl = await readFileAsDataURL(file);
      dataUrl = await compressImage(dataUrl);
      return { kind: 'image', name: file.name, dataUrl };
    }

    let text = '';
    if (e === 'pdf') {
      Toast.info('正在解析 PDF…');
      text = await parsePdf(file);
    } else if (e === 'docx' || e === 'doc') {
      Toast.info('正在解析 Word 文档…');
      text = await parseDocx(file);
    } else if (TEXT_EXTS.includes(e) || file.type.startsWith('text/')) {
      text = await readFileAsText(file);
    } else {
      throw new Error('暂不支持的文件类型：' + file.name + '（支持 图片/PDF/Word/文本/代码）');
    }

    let truncated = false;
    if (text.length > MAX_TEXT_CHARS) { text = text.slice(0, MAX_TEXT_CHARS); truncated = true; }
    if (!text.trim()) throw new Error('未能从文件中提取到文字内容');
    return { kind: 'text', name: file.name, text, truncated };
  }

  /* 把解析出的文本包装成注入上下文的形式 */
  function wrapAsContext(items) {
    return items.filter(i => i.kind === 'text').map(i => {
      const note = i.truncated ? '（内容过长，已截取前 ' + MAX_TEXT_CHARS + ' 字符）' : '';
      return '📄 文件「' + i.name + '」' + note + '：\n```\n' + i.text + '\n```';
    }).join('\n\n');
  }

  return { parse, wrapAsContext, TEXT_EXTS };
})();
