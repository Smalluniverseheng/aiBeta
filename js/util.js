/* ==================== UTIL · 工具函数 ==================== */

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function debounce(fn, wait) {
  let t;
  return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), wait); };
}

function fmtTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  if (sameDay) return hm;
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return '昨天 ' + hm;
  return (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

function download(filename, content, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy') ? resolve() : reject(new Error('复制失败')); }
    catch (e) { reject(e); }
    ta.remove();
  });
}

/* ---------- Toast ---------- */
const Toast = (() => {
  const TOAST_ICONS = { success: 'check', error: 'x', info: 'info', warning: 'zap' };
  function show(msg, type, duration) {
    type = type || 'info';
    duration = duration || 2600;
    const box = $('#toastContainer');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = icon(TOAST_ICONS[type] || 'info', 16) + '<span>' + esc(msg) + '</span>';
    box.appendChild(el);
    el._timer = setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 300);
    }, duration);
    return el;
  }
  function dismiss(el) {
    if (!el) return;
    clearTimeout(el._timer);
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 180);
  }
  return { show, dismiss, success: m => show(m, 'success'), error: m => show(m, 'error', 3800), info: (m, d) => show(m, 'info', d), warning: m => show(m, 'warning', 3200) };
})();

/* ---------- 确认对话框 ---------- */
function confirmDialog(title, desc, danger) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.innerHTML =
      '<div class="modal modal-sm" style="animation:popIn .22s var(--ease)">' +
      '<div class="modal-header"><h3>' + icon(danger ? 'trash' : 'info', 19) + esc(title) + '</h3></div>' +
      '<div class="modal-body"><p style="color:var(--text-2);font-size:13.5px;line-height:1.7">' + esc(desc || '') + '</p></div>' +
      '<div class="modal-footer">' +
      '<button class="btn btn-ghost" data-act="no">取消</button>' +
      '<button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-act="yes">确认</button>' +
      '</div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => {
      const act = e.target.closest('[data-act]');
      if (act || e.target === overlay) {
        overlay.remove();
        resolve(act ? act.dataset.act === 'yes' : false);
      }
    });
  });
}

/* ---------- 文本域自适应高度 ---------- */
function autoResize(ta) {
  if (!ta) return;
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 180) + 'px';
}

/* ---------- rAF 节流（流式渲染防卡顿） ---------- */
function makeRafScheduler(fn) {
  let scheduled = false;
  let lastArgs = null;
  return function (...args) {
    lastArgs = args;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      fn.apply(null, lastArgs);
    });
  };
}

/* ---------- 文件读取 ---------- */
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsText(file, 'utf-8');
  });
}

/* ---------- 图片压缩（视觉模型上传前处理） ---------- */
function compressImage(dataUrl, maxSide, quality) {
  maxSide = maxSide || 1600;
  quality = quality || 0.85;
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (Math.max(width, height) > maxSide) {
        const ratio = maxSide / Math.max(width, height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/* ---------- 动态加载外部脚本（CDN，带缓存） ---------- */
const _scriptCache = {};
function loadScript(url, check) {
  if (check && check()) return Promise.resolve();
  if (_scriptCache[url]) return _scriptCache[url];
  _scriptCache[url] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.onload = resolve;
    s.onerror = () => reject(new Error('加载失败: ' + url));
    document.head.appendChild(s);
  });
  return _scriptCache[url];
}

/* ---------- 拼音/关键词模糊匹配（模型搜索用） ---------- */
function matchKeyword(text, kw) {
  if (!kw) return true;
  return String(text).toLowerCase().includes(String(kw).toLowerCase().trim());
}
