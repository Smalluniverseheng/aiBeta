/* ==================== Service Worker · PWA 离线缓存 ==================== */
const VERSION = 'v4.1';
const CACHE_STATIC = 'thirdparty-ai-static-' + VERSION;
const CACHE_RUNTIME = 'thirdparty-ai-runtime-' + VERSION;

/* 应用外壳：安装时预缓存 */
const SHELL = [
  './',
  'index.html',
  'manifest.json',
  'css/base.css', 'css/layout.css', 'css/components.css', 'css/chat.css', 'css/login.css', 'css/pages.css', 'css/watch.css',
  'js/device.js', 'js/icons.js', 'js/models.js', 'js/providers.js', 'js/changelog.js', 'js/modelsync.js', 'js/store.js', 'js/i18n.js', 'js/util.js', 'js/markdown.js',
  'js/api.js', 'js/voice.js', 'js/files.js', 'js/presets.js', 'js/auth.js', 'js/chat.js',
  'js/token.js', 'js/plugins.js', 'js/skills.js', 'js/supabase.js',
  'js/ui.js', 'js/pages.js', 'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'assets/brand.jpg',
  'offline.html'
];

/* 安装：预缓存外壳 */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

/* 激活：清理旧版本缓存 */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k.startsWith('thirdparty-ai-') && k !== CACHE_STATIC && k !== CACHE_RUNTIME)
        .map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

/* 请求策略：
 * - 页面导航 & 同域 JS/CSS：网络优先（保证代码始终最新），断网回退缓存
 * - 图标 & 外部 CDN（品牌图标/KaTeX/pdf.js 等）：缓存优先 + 网络回填
 * - API 请求（POST / 各厂商 API 域名）：直接走网络，不缓存
 */
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;
  // AI API 请求不缓存
  if (/api\.|openai|anthropic|googleapis|deepseek|moonshot|aliyuncs|bigmodel|baidubce|hunyuan|minimax|volces|stepfun|baichuan|xf-yun|skywork|sensenova|mistral|cohere|x\.ai|groq|tavily|xiaomimimo/.test(url.host)) return;

  // 页面导航：网络优先，回退 index.html
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_STATIC).then(c => c.put('index.html', clone));
          return resp;
        })
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  const isCDN = /npmmirror|unpkg|simpleicons|jsdelivr/.test(url.host);
  const isIcon = url.origin === location.origin && /\/icons\//.test(url.pathname);

  // CDN 与图标：缓存优先
  if (isCDN || isIcon) {
    e.respondWith(
      caches.match(req).then(cached => {
        const fetching = fetch(req).then(resp => {
          if (resp && (resp.ok || resp.type === 'opaque')) {
            const clone = resp.clone();
            caches.open(CACHE_RUNTIME).then(c => c.put(req, clone));
          }
          return resp;
        }).catch(() => cached);
        return cached || fetching;
      })
    );
    return;
  }

  // 同域 JS/CSS/manifest：网络优先，回退缓存
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req)
        .then(resp => {
          if (resp && resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_STATIC).then(c => c.put(req, clone));
          }
          return resp;
        })
        .catch(() => caches.match(req))
    );
  }
});
