# 开发交接文档 v5.4

> 项目: 第三方科技 · AI 智能聚合平台
> 当前版本: v5.3（已部署到 aiBeta/main）
> 目标版本: v5.4
> 开发分支: `aiBeta/5.4`（已基于 main 创建）
> 最后更新: 2026-07-27

---

## 一、5.3 当前状态（已完成）

v5.3 已合并到 `aiBeta/main`，GitHub Pages 部署源已改为 `main` 分支。

### 1.1 已完成功能

| 功能 | 状态 |
|------|------|
| 思考面板流式渲染 + 折叠/展开 + 自动折叠 | ✅ |
| 消息气泡样式优化（用户紫色/AI深色/系统居中） | ✅ |
| 长消息 >800px 自动折叠 | ✅ |
| 代码块复制按钮悬浮显示 | ✅ |
| SSE 30秒熔断 + 进度提示 | ✅ |
| Esc键停止生成 + 继续生成 | ✅ |
| Token用量实时统计 + 成本计算 | ✅ |
| Token统计按天/周/月筛选 | ✅ |
| 翻译独立空间 + 历史记录 + 收藏 | ✅ |
| 模型目录443个 + 教育/医疗/法律/金融分类 + 免费/付费标签 | ✅ |
| API Key自动匹配（粘贴Key自动识别厂商） | ✅ |
| 各厂商真实定价（输入/输出/缓存命中/未命中） | ✅ |

### 1.2 已知 Bug（必须在 5.4 修复）

| Bug | 严重程度 | 说明 |
|-----|---------|------|
| **回收站打不开** | P0 | `bindSubpageEvents()` 未绑定 `data-sub="trash"` 点击事件 |
| **帮助中心打不开** | P0 | `bindSubpageEvents()` 未绑定 `data-sub="help"` 点击事件 |
| 后端同步 "null value in column id" | P1 | Supabase messages 表 id 非空约束，推送前需生成 UUID |

### 1.3 5.3 部署验证

测试地址: `https://smalluniverseheng.github.io/aiBeta/?nocache=1`

---

## 二、5.4 开发任务（全部必须完成）

### 2.1 P0 — 修复已知 Bug

#### 2.1.1 回收站打不开

**根因**: `js/pages.js` 的 `bindSubpageEvents()` 函数中没有处理 `data-sub="trash"` 的点击事件。

**修复方案**:
```javascript
// 在 bindSubpageEvents() 的 click 事件委托中添加
const sub = row.dataset.sub;
if (sub === 'trash') { Pages.open('trash'); }
if (sub === 'help') { Pages.open('help'); }
```

**修改文件**: `js/pages.js`
**预计工作量**: 5 分钟

#### 2.1.2 帮助中心打不开

同上，添加 `sub === 'help'` 的处理。

---

### 2.2 P1 — 消息编辑重发

**需求**: 用户消息右侧"编辑重发"按钮点击后，弹出输入框修改内容，确认后重新发送。

**实现方案**:
1. `msgHtml()` 中已有 `data-act="edit"` 按钮
2. `bindMsgEvents()` 中处理 `edit` 动作：
   - 获取原消息内容，显示编辑输入框（inline 或 modal）
   - 用户修改后，删除该消息及之后的所有消息
   - 将修改后的内容作为新用户消息发送
3. `chat.js` 中新增 `editAndResend(msgId, newContent)` 函数

**修改文件**: `js/ui.js`（事件绑定）、`js/chat.js`（重发逻辑）
**预计工作量**: 30 分钟

---

### 2.3 P2 — AI 绘画独立空间 + 图生视频

#### 2.3.1 AI 绘画独立页面

**当前问题**: 弹窗形式（`paintModal`），体验差，历史记录无法保存。

**方案**:
- 新建独立子页面 `subPaint`（类似 `subTranslate` 的全屏界面）
- 左侧：输入区（提示词 + 参数选择：尺寸/风格/数量/厂商）
- 右侧：结果画廊（支持历史记录、重新生成、下载、收藏）
- 入口：发现页 → AI 绘画
- 历史保存到 `Store.state.paintHistory`
- 云端同步（`paintHistory` 加入 `SETTINGS_WHITELIST`）

**需要新增/修改**:
- `index.html`: 添加 `subPaint` DOM 结构
- `js/pages.js`: `renderPaint()` + `bindPaintEvents()`
- `js/store.js`: `paintHistory: []`
- `js/supabase.js`: `SETTINGS_WHITELIST` 添加 `'paintHistory'`
- `css/pages.css`: 绘画页面样式

**预计工作量**: 1.5 小时

#### 2.3.2 图生视频

**需求**: 上传图片 + 输入提示词 → 生成视频。

**技术难点**:
- 各厂商视频生成 API 差异极大，均为异步任务+轮询模式
- 视频生成时间：10 秒 ~ 5 分钟不等
- 需要任务队列 + 轮询机制

**方案**:
- 新建独立子页面 `subVideo`
- 左侧：上传图片 + 提示词 + 参数（时长/运镜/风格/厂商）
- 右侧：任务列表（排队中/生成中/已完成）
- 每个任务轮询状态，完成后显示视频播放器
- 支持下载 MP4
- 历史保存到 `Store.state.videoHistory`

**首批支持厂商**:
| 厂商 | API 模式 | 优先级 |
|------|---------|--------|
| 通义万相（阿里） | 异步任务+轮询 | P0 |
| 可灵（快手） | 异步任务+轮询 | P1 |

**厂商适配通用接口**:
```javascript
// js/api.js 新增
async function generateVideo(opts) {
  // 1. 上传图片获取 URL（如果需要）
  // 2. 提交生成任务，获取 task_id
  // 3. 返回 task_id
}

async function pollVideoTask(provider, taskId) {
  // 轮询任务状态
  // 返回: { status: 'pending'|'processing'|'success'|'failed', video: url, progress: 0-100 }
}
```

**需要新增**:
- `js/api.js`: `generateVideo()` + `pollVideoTask()`
- `js/models.js`: 新增 `type: 'video'` 模型（通义万相视频、可灵视频）
- `js/providers.js`: 新增视频厂商配置（baseURL、headers、task API 端点）
- `index.html`: `subVideo` DOM
- `js/pages.js`: `renderVideo()` + `bindVideoEvents()`
- `js/store.js`: `videoHistory: []`, `videoTasks: []`
- `js/supabase.js`: `SETTINGS_WHITELIST` 添加 `'videoHistory'`
- `css/pages.css`: 视频页面样式

**预计工作量**: 3 小时（通义万相 1.5h + 可灵 1.5h）

---

### 2.4 P3 — 性能优化

#### 2.4.1 虚拟滚动

**需求**: 对话超过 100 条消息时，只渲染视口内的消息。

**方案**:
- 使用 `IntersectionObserver` 或简单的滚动位置计算
- 视口外消息替换为占位 div（保持滚动条高度）
- 上下各保留 10 条缓冲消息
- 监听 `scroll` 事件，动态添加/移除消息 DOM

**修改文件**: `js/ui.js`（`renderChat()` + 滚动监听）
**预计工作量**: 1.5 小时

#### 2.4.2 图片懒加载

**需求**: 对话中的图片（用户上传/AI生成）延迟加载。

**方案**:
- 图片 `src` 初始为空，`data-src` 放真实 URL
- `IntersectionObserver` 检测到进入视口后加载
- 配合 `loading="lazy"` 原生属性

**修改文件**: `js/ui.js`（`msgHtml()` 中图片生成逻辑）
**预计工作量**: 20 分钟

#### 2.4.3 IndexedDB 本地缓存

**需求**: 缓存大文件、图片、模型列表，减少重复下载。

**方案**:
- 新建 `js/db.js`，封装 IndexedDB
- 缓存内容：模型列表、用户头像/图片、生成的图片/视频
- 提供 `DB.get(key)` / `DB.set(key, value)` / `DB.del(key)` API
- 挂载到 `window.DB`

**修改文件**: 新建 `js/db.js`，`index.html` 引入
**预计工作量**: 1 小时

---

### 2.5 导航栏自定义重构（核心功能）

#### 2.5.1 需求概述

- 底部导航栏（移动端）/ 侧边栏（桌面端）/ 手表导航 支持用户自定义
- 默认新用户只有 **"AI对话"** 和 **"我的"** 两个项
- 用户可以从"其他"页面添加工具到导航栏
- 各端独立记录，上限不同：桌面10 / 移动5 / 手表4
- 交互方式可选：iOS 长按编辑 / 安卓抽屉（在"我的 → 导航设置"中切换）
- 插件与设置类功能只能放在"我的"页面里，不能放导航栏
- 云端同步导航配置

#### 2.5.2 数据结构

```javascript
// js/store.js DEFAULTS 中替换现有的 navSettings
navBar: {
  // 各端导航栏项
  desktop: { items: ['chat', 'profile'], max: 10 },
  mobile:  { items: ['chat', 'profile'], max: 5 },
  watch:   { items: ['chat', 'profile'], max: 4 },

  // 交互方式: 'ios' | 'drawer'
  editMode: 'ios',

  // 未添加到导航栏的工具（在"其他"中显示）
  available: ['paint', 'video', 'translate', 'voice', 'tokenStats', 'models', 'novel', 'comic', 'shortVideo', 'videoHub'],

  // 插件类（只能在"我的"中设置，不能放导航栏）
  plugins: ['apiKey', 'proxy', 'navSettings', 'dataSync', 'about']
}
```

#### 2.5.3 "其他"页面新结构

```
┌─────────────────────────────┐
│  其他                        │
├─────────────────────────────┤
│  已添加到导航栏（可移除）      │
│  ┌────┐ ┌────┐ ┌────┐      │
│  │AI对话│ │AI绘画│ │我的 │  ✕  │
│  └────┘ └────┘ └────┘      │
├─────────────────────────────┤
│  可添加到导航栏               │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐│
│  │AI视频│ │翻译 │ │语音 │ │模型 │ + │
│  └────┘ └────┘ └────┘ └────┘│
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐│
│  │小说  │ │漫画 │ │短视频│ │视频端│ + │
│  └────┘ └────┘ └────┘ └────┘│
└─────────────────────────────┘
```

**交互逻辑**:
- 点击"已添加"区域中的项：直接打开对应页面
- 点击"已添加"项上的 ✕：移除该项（回到"可添加"区域）
- 点击"可添加"区域中的项：添加到导航栏（如果未满）
- 长按底部导航项 2 秒进入编辑模式（iOS 模式）
- 或点击底部导航"其他"展开抽屉勾选（抽屉模式）

#### 2.5.4 "我的"页面结构

```
┌─────────────────────────────┐
│  我的                        │
├─────────────────────────────┤
│  用户信息...                  │
├─────────────────────────────┤
│  插件与设置                   │
│  ┌────────┐ ┌────────┐       │
│  │API Key │ │代理模式│       │
│  └────────┘ └────────┘       │
│  ┌────────┐ ┌────────┐       │
│  │导航设置│ │数据同步│       │
│  └────────┘ └────────┘       │
│  ┌────────┐                  │
│  │关于平台│                  │
│  └────────┘                  │
└─────────────────────────────┘
```

#### 2.5.5 导航设置子页面

在"我的"页面中，"导航设置"是一个子页面（`subNavSettings`），包含：

```
┌─────────────────────────────┐
│  导航设置                    │
├─────────────────────────────┤
│  编辑方式                    │
│  [iOS 长按编辑] [安卓抽屉]   │
├─────────────────────────────┤
│  桌面端导航栏（最多10个）     │
│  [拖拽排序列表]              │
├─────────────────────────────┤
│  移动端导航栏（最多5个）      │
│  [拖拽排序列表]              │
├─────────────────────────────┤
│  手表端导航栏（最多4个）      │
│  [拖拽排序列表]              │
└─────────────────────────────┘
```

#### 2.5.6 多端渲染逻辑

```javascript
// js/ui.js
function renderMobileNav() {
  const items = Store.state.navBar.mobile.items;
  const max = Store.state.navBar.mobile.max;
  // 渲染底部导航项
  // 如果还有空间，显示"其他"入口
}

function renderDesktopSidebar() {
  const items = Store.state.navBar.desktop.items;
  // 渲染侧边栏导航项
}

function renderWatchNav() {
  const items = Store.state.navBar.watch.items;
  // 渲染手表导航（极简）
}
```

#### 2.5.7 需要修改的文件

| 文件 | 修改内容 |
|------|---------|
| `js/store.js` | 替换 `navSettings` 为 `navBar`，添加默认值 |
| `js/supabase.js` | `SETTINGS_WHITELIST` 添加 `'navBar'` |
| `js/ui.js` | 底部导航/侧边栏改为动态渲染；iOS编辑模式交互；抽屉模式交互 |
| `js/pages.js` | `renderDiscover()` 重构为新的"其他"页面；`renderNavSettings()` 重构；新增 `renderNavEdit()` |
| `index.html` | 底部导航改为动态容器；侧边栏导航项改为动态容器 |
| `css/layout.css` | 编辑模式样式、抖动动画、拖拽占位符 |
| `css/pages.css` | "其他"页面网格布局、"我的"页面插件区域样式 |

**预计工作量**: 4 小时

---

### 2.6 "其他"页面新增内容入口

#### 2.6.1 小说

**需求**: 调用小说书源 API，类似开源阅读。

**技术方案**:
- 新建独立子页面 `subNovel`
- 左侧：书源列表（支持添加/删除书源）
- 中间：书架/搜索/分类
- 右侧：阅读器（章节列表 + 正文 + 设置：字体/背景/翻页模式）
- 书源格式：支持 JSON 书源（类似开源阅读的规则）
- 支持本地缓存章节内容到 IndexedDB

**书源 API 示例**:
```javascript
// 书源规则
const novelSource = {
  name: '笔趣阁',
  url: 'https://www.biquge.com',
  search: '/search.php?q={{keyword}}',
  searchList: 'div.result-item',
  searchName: 'h3>a',
  searchAuthor: '.author',
  searchCover: 'img@src',
  searchUrl: 'h3>a@href',
  chapterList: '#list>dl>dd>a',
  chapterName: 'text',
  chapterUrl: 'href',
  content: '#content@html',
  contentFilter: ['广告', '本章完']
};
```

**需要新增**:
- `js/novel.js`: 书源解析、搜索、章节获取、阅读器逻辑
- `js/pages.js`: `renderNovel()` + `bindNovelEvents()`
- `index.html`: `subNovel` DOM
- `css/pages.css`: 小说阅读器样式
- `js/store.js`: `novelSources: []`, `novelHistory: []`, `novelBookmarks: []`

**预计工作量**: 3 小时

#### 2.6.2 漫画

**需求**: 调用漫画书源 API，类似小说但展示图片。

**技术方案**:
- 新建独立子页面 `subComic`
- 左侧：书源列表
- 中间：书架/搜索/分类
- 右侧：阅读器（图片预加载、左右翻页、缩放）
- 支持本地缓存图片到 IndexedDB

**需要新增**:
- `js/comic.js`: 漫画书源解析、图片获取、阅读器
- `js/pages.js`: `renderComic()` + `bindComicEvents()`
- `index.html`: `subComic` DOM
- `css/pages.css`: 漫画阅读器样式
- `js/store.js`: `comicSources: []`, `comicHistory: []`, `comicBookmarks: []`

**预计工作量**: 2.5 小时

#### 2.6.3 短视频

**需求**: 类似抖音/TikTok 的竖屏短视频浏览。

**技术方案**:
- 新建独立子页面 `subShortVideo`
- 全屏竖屏滑动切换视频
- 数据来源：
  - 方案 A：调用第三方短视频 API（如抖音开放平台、B站API）
  - 方案 B：AI 生成短视频（调用视频生成模型）
  - 方案 C：两者结合（推荐）
- 支持点赞、收藏、分享

**需要新增**:
- `js/shortvideo.js`: 视频列表、滑动切换、播放控制
- `js/pages.js`: `renderShortVideo()` + `bindShortVideoEvents()`
- `index.html`: `subShortVideo` DOM
- `css/pages.css`: 竖屏全屏视频样式
- `js/store.js`: `shortVideoHistory: []`, `shortVideoFavorites: []`

**预计工作量**: 2 小时

#### 2.6.4 视频端

**需求**: 类似 YouTube/B站 的视频平台，支持搜索、分类、播放列表。

**技术方案**:
- 新建独立子页面 `subVideoHub`
- 顶部：搜索栏 + 分类标签
- 中间：视频网格列表（封面+标题+时长+作者）
- 点击播放：弹出播放器（支持全屏、倍速、弹幕）
- 数据来源：
  - 方案 A：调用视频平台 API（B站、YouTube Data API）
  - 方案 B：AI 生成视频展示
  - 方案 C：两者结合（推荐）

**需要新增**:
- `js/videohub.js`: 视频搜索、列表、播放器
- `js/pages.js`: `renderVideoHub()` + `bindVideoHubEvents()`
- `index.html`: `subVideoHub` DOM
- `css/pages.css`: 视频网格 + 播放器样式
- `js/store.js`: `videoHubHistory: []`, `videoHubFavorites: []`

**预计工作量**: 2 小时

---

## 三、版本号规则（绝对禁止违反）

```
① 只用 x.y 格式（如 5.4），禁止 x.y.z（如 5.4.1）
② 发版必须同步改 4 处：
   - js/providers.js: APP_VERSION
   - sw.js: VERSION
   - index.html: 所有 ?v=X.Y
   - js/changelog.js: 数组末尾追加新版本条目
③ Git 提交信息、文档、changelog 条目也禁止出现 x.y.z
```

---

## 四、开发规则（绝对禁止违反）

### 4.1 Pages IIFE 作用域

**所有 `renderXxx` 函数必须在 `Pages` IIFE 内部定义！**

```javascript
const Pages = (() => {
  function renderSomething() { ... }  // ✅ 正确
  return { renderSomething };
})();

function renderSomething() { ... }  // ❌ 错误！会导致 ReferenceError
```

### 4.2 bindSubpageEvents 必须调用

`bindSubpageEvents()` 负责监听 `[data-sub]` 点击事件。**必须在 `Pages.init()` 中调用！**

### 4.3 事件委托优于直接绑定

反复渲染的元素必须使用事件委托：

```javascript
// ✅ 正确
container.addEventListener('click', e => {
  const row = e.target.closest('.nav-opt-row');
  if (!row) return;
});
```

### 4.4 悬浮按钮规则

- 拖动阈值 8px（`Math.abs(dx) > 8`）
- `moved` 标志只在 `touchstart/mousedown` 中重置
- `touchend/mouseup/click` 中不重置 `moved`
- 点击时 `if (moved) return;`
- 松手后吸附到左右边缘

### 4.5 不要在模块加载时清理数据

清理操作只在 `create()` 或用户触发时执行。

---

## 五、文件修改清单

| 优先级 | 文件 | 修改类型 | 说明 |
|--------|------|---------|------|
| P0 | `js/pages.js` | 修改 | 修复 bindSubpageEvents 中 trash/help 绑定 |
| P0 | `js/ui.js` | 修改 | 消息编辑重发事件绑定 |
| P0 | `js/chat.js` | 修改 | 新增 editAndResend 函数 |
| P1 | `index.html` | 修改 | 添加 subPaint / subVideo / subNovel / subComic / subShortVideo / subVideoHub / subNavSettings DOM |
| P1 | `index.html` | 修改 | 引入 js/db.js、js/novel.js、js/comic.js、js/shortvideo.js、js/videohub.js |
| P1 | `js/store.js` | 修改 | 新增 navBar / paintHistory / videoHistory / novelSources / comicSources / shortVideoHistory / videoHubHistory |
| P1 | `js/supabase.js` | 修改 | SETTINGS_WHITELIST 添加 navBar / paintHistory / videoHistory / novelHistory / comicHistory |
| P1 | `js/ui.js` | 修改 | 底部导航/侧边栏动态渲染；iOS编辑模式；抽屉模式 |
| P1 | `js/pages.js` | 修改 | renderDiscover 重构；renderNavSettings 重构；renderPaint / renderVideo / renderNovel / renderComic / renderShortVideo / renderVideoHub |
| P1 | `js/api.js` | 修改 | 新增 generateVideo / pollVideoTask |
| P1 | `js/models.js` | 修改 | 新增 type: 'video' 模型 |
| P1 | `js/providers.js` | 修改 | 新增视频厂商配置 |
| P1 | `js/db.js` | 新建 | IndexedDB 封装 |
| P1 | `js/novel.js` | 新建 | 小说书源解析 + 阅读器 |
| P1 | `js/comic.js` | 新建 | 漫画书源解析 + 阅读器 |
| P1 | `js/shortvideo.js` | 新建 | 短视频滑动播放 |
| P1 | `js/videohub.js` | 新建 | 视频平台搜索播放 |
| P1 | `css/layout.css` | 修改 | 编辑模式样式、抖动动画 |
| P1 | `css/pages.css` | 修改 | 绘画/视频/小说/漫画/短视频/视频端页面样式 |
| P1 | `js/providers.js` | 修改 | APP_VERSION = '5.4' |
| P1 | `sw.js` | 修改 | VERSION = 'v5.4' |
| P1 | `js/changelog.js` | 修改 | 追加 v5.4 条目 |

---

## 六、测试验证清单

- [ ] 版本号一致（providers.js / sw.js / index.html / changelog.js）
- [ ] 回收站可正常打开
- [ ] 帮助中心可正常打开
- [ ] 消息编辑重发功能正常
- [ ] AI绘画独立页面可打开，历史记录可保存
- [ ] 图生视频可提交任务，轮询状态，完成后播放
- [ ] 导航栏自定义：添加/移除/排序正常
- [ ] iOS编辑模式：长按进入编辑，抖动动画，拖拽排序
- [ ] 安卓抽屉模式：展开抽屉，勾选/取消勾选
- [ ] 各端导航栏独立：桌面10/移动5/手表4
- [ ] 导航配置云端同步
- [ ] 小说页面：书源添加、搜索、阅读正常
- [ ] 漫画页面：书源添加、阅读、翻页正常
- [ ] 短视频页面：滑动切换、播放正常
- [ ] 视频端页面：搜索、分类、播放正常
- [ ] 虚拟滚动：长对话不卡顿
- [ ] 图片懒加载：图片延迟加载正常
- [ ] IndexedDB：缓存读写正常
- [ ] 悬浮按钮在非对话页显示，对话页隐藏
- [ ] 悬浮按钮可拖动，松手吸附边缘
- [ ] 子页面（帮助中心、回收站、代理模式等）全部可打开
- [ ] 后端同步无 "null value in column id" 报错

---

## 七、给下一个 AI 的留言

1. **先读本文档再动手** — 5.4 功能非常多，务必按优先级 P0 → P1 → P2 → P3 顺序开发
2. **Pages IIFE 是最大坑** — 所有 renderXxx 必须放在 IIFE 内部
3. **bindSubpageEvents 必须调用** — 否则子页面打不开
4. **版本号只用 x.y 格式** — 5.4，禁止 5.4.1
5. **测试服先行** — aiBeta/5.4 开发稳定后再合并到 main
6. **导航栏重构是核心** — 建议先做 P0 修复，然后做导航栏重构，再做其他功能
7. **小说/漫画书源** — 建议先用简单的 JSON 规则实现，后续再扩展复杂书源
8. **视频生成** — 先做通义万相，可灵放到后面

---

**当前时间**: 2026-07-27
**上一个 AI 完成**: v5.3（已合并到 aiBeta/main）
**你的任务**: v5.4（基于 aiBeta/5.4 分支开发）
