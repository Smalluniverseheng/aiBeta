/* ==================== MARKDOWN · 安全渲染器（防 XSS） ==================== */
const MD = (() => {

  /* 轻量语法高亮 */
  function highlight(code, lang) {
    let s = esc(code);
    if (!lang || /^(text|txt|plain)$/.test(lang)) return s;
    const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(function|return|const|let|var|if|else|for|while|class|import|export|from|async|await|new|try|catch|throw|switch|case|break|continue|default|typeof|instanceof|of|in|def|elif|print|lambda|None|True|False|pass|raise|with|as|yield|public|private|static|void|int|long|double|float|char|boolean|package|extends|implements|final|this|super|null|true|false|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|TABLE|JOIN|GROUP|ORDER|BY|LIMIT)\b|\b(\d+\.?\d*)\b/g;
    return s.replace(re, (m, com, str, kw, num) => {
      if (com) return '<span class="tok-c">' + com + '</span>';
      if (str) return '<span class="tok-s">' + str + '</span>';
      if (kw) return '<span class="tok-k">' + kw + '</span>';
      if (num) return '<span class="tok-n">' + num + '</span>';
      return m;
    });
  }

  function inline(text) {
    let s = esc(text);
    // 行内代码（先处理，防内部被格式化）
    const codes = [];
    s = s.replace(/`([^`\n]+)`/g, (m, c) => { codes.push(c); return '\u0001' + (codes.length - 1) + '\u0002'; });
    // 图片 / 链接
    s = s.replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, '<img class="msg-image" src="$2" alt="$1" loading="lazy">');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    // 粗斜体
    s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    // 还原行内代码
    s = s.replace(/\u0001(\d+)\u0002/g, (m, i) => '<code>' + esc(codes[+i]) + '</code>');
    return s;
  }

  function render(src) {
    if (!src) return '';
    const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let i = 0;
    let listStack = []; // 'ul' | 'ol'

    const closeLists = (to) => {
      while (listStack.length > (to || 0)) out.push('</' + listStack.pop() + '>');
    };

    while (i < lines.length) {
      const line = lines[i];

      // 代码块
      const fence = line.match(/^```(\w*)\s*$/);
      if (fence) {
        closeLists();
        const lang = (fence[1] || 'text').toLowerCase();
        const buf = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        const raw = buf.join('\n');
        out.push(
          '<div class="code-block"><div class="code-block-head"><span class="code-lang">' + esc(lang) + '</span>' +
          '<button class="code-copy" data-code="' + encodeURIComponent(raw) + '">' + icon('copy', 13) + '<span>复制</span></button></div>' +
          '<pre><code>' + highlight(raw, lang) + '</code></pre></div>'
        );
        continue;
      }

      // 表格
      if (/^\s*\|.+\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
        closeLists();
        const parseRow = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => inline(c.trim()));
        const head = parseRow(line);
        i += 2;
        const rows = [];
        while (i < lines.length && /^\s*\|.+\|\s*$/.test(lines[i])) { rows.push(parseRow(lines[i])); i++; }
        out.push('<table><thead><tr>' + head.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' +
          rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table>');
        continue;
      }

      // 标题
      const h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) { closeLists(); const lv = h[1].length; out.push('<h' + lv + '>' + inline(h[2]) + '</h' + lv + '>'); i++; continue; }

      // 分割线
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { closeLists(); out.push('<hr>'); i++; continue; }

      // 引用
      if (/^\s*>\s?/.test(line)) {
        closeLists();
        const buf = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
        out.push('<blockquote>' + render(buf.join('\n')) + '</blockquote>');
        continue;
      }

      // 列表
      const ul = line.match(/^(\s*)[-*+]\s+(.*)$/);
      const ol = line.match(/^(\s*)\d+[.、]\s+(.*)$/);
      if (ul || ol) {
        const m = ul || ol;
        const type = ul ? 'ul' : 'ol';
        const depth = Math.floor(m[1].length / 2) + 1;
        while (listStack.length > depth) out.push('</' + listStack.pop() + '>');
        if (listStack.length < depth || listStack[listStack.length - 1] !== type) {
          if (listStack.length >= depth) out.push('</' + listStack.pop() + '>');
          out.push('<' + type + '>');
          listStack.push(type);
        }
        out.push('<li>' + inline(m[2]) + '</li>');
        i++;
        continue;
      }

      // 空行 / 普通段落
      closeLists();
      if (!line.trim()) { i++; continue; }
      const buf = [line];
      i++;
      while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\s*>|\s*[-*+]\s|\s*\d+[.、]\s|\s*\|)/.test(lines[i])) { buf.push(lines[i]); i++; }
      out.push('<p>' + inline(buf.join(' ')) + '</p>');
    }
    closeLists();
    return '<div class="md">' + out.join('') + '</div>';
  }

  /* 绑定代码复制按钮（事件委托即可，见 ui.js） */
  function bindCopy(container) {
    container.addEventListener('click', e => {
      const btn = e.target.closest('.code-copy');
      if (!btn) return;
      const code = decodeURIComponent(btn.dataset.code || '');
      copyText(code).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = icon('check', 13) + '<span>已复制</span>';
        setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = icon('copy', 13) + '<span>复制</span>'; }, 1600);
      });
    });
  }

  /* KaTeX 数学公式（可选增强，CDN 加载失败不影响正文） */
  let katexLoading = null;
  function renderMath(container) {
    if (!container.textContent || !/(\$\$?[^$]+\$|\\\(|\\\[)/.test(container.textContent)) return;
    if (!katexLoading) {
      katexLoading = loadScript('https://registry.npmmirror.com/katex/latest/files/dist/katex.min.js', () => window.katex)
        .then(() => loadScript('https://registry.npmmirror.com/katex/latest/files/dist/contrib/auto-render.min.js', () => window.renderMathInElement))
        .catch(() => null);
    }
    katexLoading.then(() => {
      if (window.renderMathInElement) {
        try {
          window.renderMathInElement(container, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '\\[', right: '\\]', display: true },
              { left: '$', right: '$', display: false },
              { left: '\\(', right: '\\)', display: false }
            ],
            throwOnError: false
          });
        } catch (e) {}
      }
    });
  }

  return { render, bindCopy, renderMath, inline };
})();
