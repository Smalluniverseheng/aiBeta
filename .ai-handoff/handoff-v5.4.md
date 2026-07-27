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


---

## 八、补充需求（2026-07-27 追加）

### 8.1 懒加载/按需加载架构

**目标**：防止网页初始加载过大，小说、漫画、AI绘画、视频等模块点击后才下载加载。

**方案**：

```javascript
// js/lazy-loader.js（已存在，需要扩展）
const LazyModules = {
  // 模块定义：点击对应入口后才加载
  novel:      { js: ['js/novel.js'],      css: ['css/novel.css'],      size: '~80KB' },
  comic:      { js: ['js/comic.js'],      css: ['css/comic.css'],      size: '~60KB' },
  paint:      { js: ['js/paint.js'],      css: ['css/paint.css'],      size: '~40KB' },
  video:      { js: ['js/video.js'],      css: ['css/video.css'],      size: '~50KB' },
  shortVideo: { js: ['js/shortvideo.js'], css: ['css/shortvideo.css'], size: '~70KB' },
  videoHub:   { js: ['js/videohub.js'],   css: ['css/videohub.css'],   size: '~45KB' },
};

async function loadModule(name) {
  if (window.__loadedModules?.[name]) return;
  const mod = LazyModules[name];
  if (!mod) return;

  // 并行加载 CSS
  mod.css.forEach(href => {
    if (!document.querySelector(`link[href="${href}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
  });

  // 串行加载 JS（有依赖关系时）
  for (const src of mod.js) {
    await new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  window.__loadedModules = window.__loadedModules || {};
  window.__loadedModules[name] = true;
}
```

**入口触发**：
```javascript
// 点击"小说"入口时
navItem.addEventListener('click', async () => {
  await loadModule('novel');
  Pages.open('novel');
});
```

**预加载策略**（可选）：
- 用户打开"其他"页面时，预加载所有模块的 CSS（只加载 CSS，不加载 JS）
- 鼠标 hover 模块入口 500ms 后预加载该模块

---

### 8.2 书源系统详细设计

#### 8.2.1 书源格式（参考开源阅读，简化版）

```json
{
  "name": "笔趣阁",
  "url": "https://www.biquge.com",
  "type": "novel",

  "search": {
    "url": "/search.php?q={{keyword}}",
    "list": "div.result-item",
    "name": "h3 > a",
    "author": ".author",
    "cover": "img@src",
    "detailUrl": "h3 > a@href"
  },

  "detail": {
    "name": "h1",
    "author": "#author",
    "cover": "#cover img@src",
    "intro": "#intro",
    "chapterList": "#list dl dd a",
    "chapterName": "text",
    "chapterUrl": "href"
  },

  "content": {
    "url": "{{chapterUrl}}",
    "text": "#content",
    "filter": ["广告", "本章完", "笔趣阁", "www.", "http"],
    "nextPage": "#nextChapter@href"
  }
}
```

**规则说明**：
- 选择器：支持 CSS 选择器（`h3 > a`）
- 属性提取：`@src`、`@href`、`@text`、`@html`
- 变量替换：`{{keyword}}`、`{{chapterUrl}}`
- 过滤：支持字符串数组过滤正文中的广告

#### 8.2.2 书源来源

**三层来源**：

| 层级 | 说明 | 管理 |
|------|------|------|
| **内置书源** | 预装 15-20 个热门正规书源（起点、纵横、晋江等正版源 + 笔趣阁等聚合源） | 随版本更新 |
| **书源市场** | 服务器维护书源列表，用户一键订阅/更新 | 服务器端管理 |
| **用户自定义** | 用户手动添加/编辑 JSON 书源 | 本地存储 |

**书源市场 API**：
```javascript
// 获取书源市场列表
GET https://api.smalluniverseheng.com/v1/novel/sources

// 订阅书源
POST https://api.smalluniverseheng.com/v1/novel/sources/subscribe
{ "sourceIds": ["biquge", "qidian"] }

// 检查书源更新
GET https://api.smalluniverseheng.com/v1/novel/sources/check-update
```

**书源更新机制**：
- 每次打开小说页面时，检查已订阅书源是否有更新（版本号对比）
- 有更新时提示用户"书源有更新，是否同步？"
- 用户自定义书源不受市场更新影响

#### 8.2.3 书源编辑器

```
┌─────────────────────────────┐
│  添加书源                    │
├─────────────────────────────┤
│  [书源名称]                  │
│  [书源URL]                   │
│  [书源规则 JSON]            │
│  ┌──────────────────────┐   │
│  │ {                    │   │
│  │   "search": {        │   │
│  │     "list": "..."    │   │
│  │   }                  │   │
│  │ }                    │   │
│  └──────────────────────┘   │
│  [验证书源] [保存]          │
│  验证结果: ✅ 可正常解析    │
└─────────────────────────────┘
```

**验证功能**：
- 输入书源规则后，点击"验证"
- 自动搜索测试关键词（如"斗破苍穹"），检查是否能正确解析书名/作者/章节列表
- 显示验证结果：成功/失败 + 具体错误信息

---

### 8.3 小说阅读器翻页架构（参考开源阅读）

#### 8.3.1 三种翻页模式

| 模式 | 说明 | 实现方式 |
------|------|---------|
| **覆盖** | 新页面从右向左覆盖旧页面 | CSS transform translateX |
| **仿真** | 模拟真实书籍翻页，有弯曲效果 | CSS 3D transform + perspective |
| **滚动** | 上下连续滚动，无分页 | overflow-y: scroll |

**默认模式**：覆盖（移动端）/ 滚动（桌面端）

#### 8.3.2 仿真翻页实现

```css
/* 仿真翻页核心 CSS */
.book-page {
  position: absolute;
  width: 100%;
  height: 100%;
  transform-origin: left center;
  transition: transform 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
  backface-visibility: hidden;
}

.book-page.flipping {
  transform: rotateY(-140deg);
  box-shadow: -5px 0 15px rgba(0,0,0,0.15);
}
```

```javascript
// 仿真翻页逻辑
class PageFlip {
  constructor(container) {
    this.container = container;
    this.currentPage = 0;
    this.pages = [];
  }

  flipNext() {
    const current = this.pages[this.currentPage];
    const next = this.pages[this.currentPage + 1];
    if (!next) return; // 加载下一章

    current.classList.add('flipping');
    setTimeout(() => {
      current.style.zIndex = 0;
      next.style.zIndex = 1;
      current.classList.remove('flipping');
      this.currentPage++;
    }, 400);
  }

  flipPrev() {
    if (this.currentPage <= 0) return; // 上一章
    const prev = this.pages[this.currentPage - 1];
    const current = this.pages[this.currentPage];

    prev.style.zIndex = 2;
    prev.classList.add('flipping-back');
    setTimeout(() => {
      current.style.zIndex = 0;
      prev.classList.remove('flipping-back');
      this.currentPage--;
    }, 400);
  }
}
```

#### 8.3.3 阅读器设置

```javascript
const ReaderSettings = {
  fontSize: 18,        // 14-32
  lineHeight: 1.8,     // 1.2-2.5
  fontFamily: 'system', // system / serif / sans-serif / custom
  theme: 'light',      // light / dark / sepia / eye-care
  pageMode: 'cover',   // cover / simulation / scroll
  turnPageArea: 0.3,   // 点击屏幕左右 30% 区域翻页
  keepScreenOn: true,  // 阅读时保持屏幕常亮
  autoScroll: false,   // 自动滚动
  scrollSpeed: 2,      // 自动滚动速度
};
```

#### 8.3.4 阅读器手势

| 手势 | 动作 |
|------|------|
| 点击左侧 30% | 上一页 |
| 点击右侧 30% | 下一页 |
| 点击中间 40% | 显示/隐藏菜单（设置/目录/进度） |
| 左滑 | 下一页 |
| 右滑 | 上一页 |
| 双指捏合 | 缩放字体（滚动模式下） |
| 长按 | 选择文字（复制/朗读/笔记） |

---

### 8.4 朗读功能（TTS）

#### 8.4.1 双引擎设计

| 引擎 | 优先级 | 说明 | 限制 |
|------|--------|------|------|
| **浏览器 SpeechSynthesis** | 降级方案 | 免费，无需 API Key | 音质一般，中文支持因浏览器而异 |
| **AI 厂商 TTS** | 优先方案 | 小米 MiMo、百度、讯飞等 | 需要 API Key，有额度限制 |

#### 8.4.2 朗读设置

```javascript
const TTSSettings = {
  engine: 'auto',      // auto / browser / xiaomi / baidu / xunfei
  speed: 1.0,          // 0.5-2.0
  pitch: 1.0,          // 0.5-2.0
  volume: 1.0,         // 0-1
  voice: 'default',    // 音色选择（厂商提供）
  paragraphPause: 500, // 段落间停顿 ms
n  sentencePause: 200,  // 句子间停顿 ms
};
```

#### 8.4.3 浏览器 TTS 实现

```javascript
function speakBrowser(text, opts) {
  return new Promise((resolve, reject) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = opts.speed;
    utter.pitch = opts.pitch;
    utter.volume = opts.volume;

    // 选择中文语音
    const voices = speechSynthesis.getVoices();
    const zhVoice = voices.find(v => v.lang.startsWith('zh'));
    if (zhVoice) utter.voice = zhVoice;

    utter.onend = resolve;
    utter.onerror = reject;
    speechSynthesis.speak(utter);
  });
}
```

#### 8.4.4 AI 厂商 TTS 实现（以小米 MiMo 为例）

```javascript
async function speakXiaomi(text, opts) {
  const key = Store.state.apiKeys['xiaomi'];
  if (!key) {
    Toast.warning('请先配置小米 API Key');
    return speakBrowser(text, opts); // 降级
  }

  const resp = await fetch('https://api.mimo.ai/v1/tts', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      speed: opts.speed,
      pitch: opts.pitch,
      voice: opts.voice
    })
  });

  const data = await resp.json();
  const audio = new Audio(data.audio_url);
  audio.playbackRate = 1;
  await audio.play();
}
```

#### 8.4.5 朗读控制条

阅读器底部显示朗读控制条：

```
┌─────────────────────────────────────┐
│  [⏪] [⏯] [⏩]  语速: [1.0x]  引擎: [小米] │
│  ████████████░░░░  朗读进度          │
└─────────────────────────────────────┘
```

**功能**：
- 播放/暂停
- 快进 30 秒 / 快退 30 秒
- 语速调节
- 引擎切换（浏览器 / 小米 / 百度 / 讯飞）
- 朗读进度显示
- 后台播放（使用 Web Audio API + Service Worker）

---

### 8.5 漫画阅读器详细设计

#### 8.5.1 阅读模式

| 模式 | 说明 |
|------|------|
| **左右翻页** | 日漫模式，从右向左翻页 |
| **上下滚动** | 条漫/韩漫模式，连续滚动 |
| **双页模式** | 桌面端，左右两页并排 |

#### 8.5.2 图片加载策略

```javascript
class ComicImageLoader {
  constructor() {
    this.cache = new Map(); // 内存缓存
    this.db = null; // IndexedDB 缓存
  }

  async load(url, index) {
    // 1. 检查内存缓存
    if (this.cache.has(url)) return this.cache.get(url);

    // 2. 检查 IndexedDB
    const blob = await DB.get('comic_image_' + url);
    if (blob) {
      const objectUrl = URL.createObjectURL(blob);
      this.cache.set(url, objectUrl);
      return objectUrl;
    }

    // 3. 网络加载
    const resp = await fetch(url);
    const data = await resp.blob();

    // 4. 保存到 IndexedDB
    await DB.set('comic_image_' + url, data);

    const objectUrl = URL.createObjectURL(data);
    this.cache.set(url, objectUrl);
    return objectUrl;
  }

  // 预加载下一页
  preload(urls, currentIndex) {
    for (let i = currentIndex + 1; i <= currentIndex + 3 && i < urls.length; i++) {
      this.load(urls[i], i); // 预加载接下来3页
    }
  }
}
```

#### 8.5.3 手势

| 手势 | 动作 |
|------|------|
| 点击左侧 | 上一页（日漫模式）/ 下一页（条漫模式） |
| 点击右侧 | 下一页（日漫模式）/ 上一页（条漫模式） |
| 双指捏合 | 缩放 |
| 双击 | 放大/还原 |
| 长按 | 保存图片 / 分享 |

---

### 8.6 缓存策略（IndexedDB）

#### 8.6.1 数据库结构

```javascript
const DB_SCHEMA = {
  name: 'AIPlatformDB',
  version: 1,
  stores: {
    // 小说章节缓存
    novel_chapters: { keyPath: 'id', indexes: ['bookId', 'chapterIndex'] },
    // 漫画图片缓存
    comic_images: { keyPath: 'url' },
    // 生成的图片缓存
    paint_images: { keyPath: 'id', indexes: ['ts'] },
    // 生成的视频缓存
    video_files: { keyPath: 'id', indexes: ['ts'] },
    // 模型列表缓存
    models_cache: { keyPath: 'key' },
    // 用户头像/图片
    user_images: { keyPath: 'url' }
  }
};
```

#### 8.6.2 缓存清理策略

```javascript
const CachePolicy = {
  // 小说章节：保留最近阅读的 10 本书，每本保留最近 50 章
  novel_chapters: { maxBooks: 10, maxChaptersPerBook: 50 },
  // 漫画图片：保留最近阅读的 5 本，每本保留最近 100 页
  comic_images: { maxBooks: 5, maxPagesPerBook: 100 },
  // 生成的图片：保留最近 100 张
  paint_images: { maxCount: 100 },
  // 生成的视频：保留最近 20 个
  video_files: { maxCount: 20 },
  // 模型列表：保留 7 天
  models_cache: { maxAge: 7 * 24 * 60 * 60 * 1000 }
};
```

**自动清理**：
- 每次启动应用时，检查缓存大小
- 超过 500MB 时，按 LRU 策略清理最久未使用的缓存
- 用户可在"我的 → 存储管理"中手动清理

---

### 8.7 文件修改清单（补充）

| 优先级 | 文件 | 修改类型 | 说明 |
|--------|------|---------|------|
| P1 | `js/lazy-loader.js` | 修改 | 扩展模块懒加载定义 |
| P1 | `js/novel.js` | 新建 | 书源解析 + 搜索 + 阅读器 + 朗读 |
| P1 | `js/comic.js` | 新建 | 书源解析 + 图片加载 + 阅读器 |
| P1 | `js/db.js` | 新建 | IndexedDB 封装 + 缓存策略 |
| P1 | `css/novel.css` | 新建 | 小说阅读器样式（翻页/主题/设置） |
| P1 | `css/comic.css` | 新建 | 漫画阅读器样式 |
| P1 | `index.html` | 修改 | 按需加载模块入口（不直接引入 novel.js/comic.js） |
| P1 | `js/pages.js` | 修改 | renderNovel 中调用 loadModule('novel') |
| P1 | `js/store.js` | 修改 | 新增 novelSources / novelBookmarks / novelHistory / ttsSettings |
| P1 | `js/supabase.js` | 修改 | SETTINGS_WHITELIST 追加 novelSources / novelBookmarks / ttsSettings |

---

## 九、给下一个 AI 的留言（补充）

1. **懒加载是核心架构要求** — 小说/漫画/绘画/视频模块必须点击后才加载 JS/CSS，index.html 中不要直接引入这些模块的脚本
2. **书源格式参考开源阅读** — 但只实现 CSS 选择器版本，XPath/正则可以后续扩展
3. **朗读功能先做浏览器 TTS** — AI 厂商 TTS 作为高级功能后续添加
4. **仿真翻页用 CSS 3D transform** — 不要过度复杂，覆盖模式优先实现
5. **缓存策略必须实现** — 否则漫画图片会撑爆内存
6. **书源市场需要后端配合** — 如果后端还没 ready，先用内置书源 + 用户自定义


---

## 十、补充需求（2026-07-27 最终追加）

### 10.1 内置书源列表（30个，规避法律风险）

**原则**：优先内置正版/官方 API 书源，聚合源标注来源，避免直接爬取付费内容。

#### 正版/官方 API 书源（15个）

| # | 书源名称 | 类型 | 性质 | 说明 |
|---|---------|------|------|------|
| 1 | 起点读书 | 小说 | 正版 API | 阅文集团官方 API，需用户自有 Key |
| 2 | 纵横中文网 | 小说 | 正版 API | 纵横官方 API |
| 3 | 晋江文学城 | 小说 | 正版 API | 晋江官方 API |
| 4 | 番茄小说 | 小说 | 正版 API | 字节跳动官方 API |
| 5 | 七猫小说 | 小说 | 正版 API | 七猫官方 API |
| 6 | 书旗小说 | 小说 | 正版 API | 阿里文学官方 API |
| 7 | QQ阅读 | 小说 | 正版 API | 阅文集团官方 API |
| 8 | 咪咕阅读 | 小说 | 正版 API | 中国移动官方 API |
| 9 | 掌阅 | 小说 | 正版 API | 掌阅官方 API |
| 10 | 豆瓣阅读 | 小说 | 正版 API | 豆瓣官方 API |
| 11 | 微信读书 | 小说 | 正版 API | 腾讯官方 API |
| 12 | 网易蜗牛读书 | 小说 | 正版 API | 网易官方 API |
| 13 | 知乎盐选 | 小说/专栏 | 正版 API | 知乎官方 API |
| 14 | 哔哩哔哩漫画 | 漫画 | 正版 API | B站官方漫画 API |
| 15 | 腾讯动漫 | 漫画 | 正版 API | 腾讯官方漫画 API |

#### 聚合/开源书源（15个，标注来源）

| # | 书源名称 | 类型 | 性质 | 说明 |
|---|---------|------|------|------|
| 16 | 笔趣阁 | 小说 | 聚合 | 公开聚合源，仅索引不存储内容 |
| 17 | 顶点小说 | 小说 | 聚合 | 公开聚合源 |
| 18 | 八一中文网 | 小说 | 聚合 | 公开聚合源 |
| 19 | 新笔趣阁 | 小说 | 聚合 | 公开聚合源 |
| 20 | 棉花糖小说 | 小说 | 聚合 | 公开聚合源 |
| 21 | 爱下电子书 | 小说 | 聚合 | 公开聚合源 |
| 22 | 小说巴士 | 小说 | 聚合 | 公开聚合源 |
| 23 | 追书网 | 小说 | 聚合 | 公开聚合源 |
| 24 | 全本小说网 | 小说 | 聚合 | 公开聚合源 |
| 25 | 漫画柜 | 漫画 | 聚合 | 公开聚合源 |
| 26 | 漫画人 | 漫画 | 聚合 | 公开聚合源 |
| 27 | 快看漫画 | 漫画 | 正版 API | 快看官方 API |
| 28 | 有妖气 | 漫画 | 正版 API | 有妖气官方 API |
| 29 | 动漫之家 | 漫画 | 聚合 | 公开聚合源 |
| 30 | 汗汗漫画 | 漫画 | 聚合 | 公开聚合源 |

#### 法律风险规避策略

1. **免责声明**：应用内明确标注"书源内容由第三方提供，本平台仅提供索引服务"
2. **不存储内容**：只存储书源规则和章节索引，不缓存正文内容到服务器
3. **用户责任**：用户添加自定义书源时，提示"请确保书源合法，本平台不对第三方内容负责"
4. **正版优先**：默认展示正版书源，聚合源折叠在"更多"中
5. **投诉机制**：提供"举报书源"入口，收到投诉后 24 小时内下架问题书源
6. **DMCA 响应**：遵守数字千年版权法，权利人可通过指定邮箱要求下架

---

### 10.2 短视频 / 视频端数据来源

#### 数据来源分层

| 层级 | 来源 | 说明 |
|------|------|------|
| **第一层** | AI 生成历史 | 用户通过本平台生成的视频（绘画/视频生成记录） |
| **第二层** | 厂商视频 API | 调用各厂商的视频生成/搜索 API |
| **第三层** | 用户上传 | 用户自行上传的视频（后续扩展） |

#### 短视频页面（subShortVideo）

```
┌─────────────────────────────┐
│  [顶部标签: 我的生成 | 厂商API] │
├─────────────────────────────┤
│                              │
│  [竖屏视频播放器 - 全屏]      │
│                              │
│  [点赞] [收藏] [分享] [下载]  │
│  [作者: AI生成 / 厂商名称]    │
│  [标题/提示词]               │
│                              │
│  [上滑查看下一个]            │
│                              │
└─────────────────────────────┘
```

**"我的生成"标签**：展示用户通过本平台 AI 生成的所有视频历史（`Store.state.videoHistory`）

**"厂商API"标签**：调用厂商视频 API 获取内容

#### 视频端页面（subVideoHub）

```
┌─────────────────────────────┐
│  [搜索栏]                    │
│  [标签: 我的生成 | 通义万相 | 可灵 | ...] │
├─────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐       │
│  │封面│ │封面│ │封面│       │
│  │标题│ │标题│ │标题│       │
│  │作者│ │作者│ │作者│       │
│  └────┘ └────┘ └────┘       │
│  ...                         │
└─────────────────────────────┘
```

**"我的生成"标签**：网格展示用户 AI 生成的视频历史

**厂商标签**：每个厂商一个标签，调用对应 API 获取视频内容

---

### 10.3 国外厂商视频 API 路由提示

#### 需要路由的厂商列表

| 厂商 | 国家/地区 | 是否需要代理 | 提示文案 |
|------|----------|-------------|---------|
| OpenAI (Sora) | 美国 | 是 | "该厂商位于海外，需要开启代理模式才能访问" |
| Runway | 美国 | 是 | "该厂商位于海外，需要开启代理模式才能访问" |
| Pika Labs | 美国 | 是 | "该厂商位于海外，需要开启代理模式才能访问" |
| Stable Video | 美国/欧洲 | 是 | "该厂商位于海外，需要开启代理模式才能访问" |
| Kling (可灵) | 中国 | 否 | 无需提示 |
| 通义万相 | 中国 | 否 | 无需提示 |
| 海螺 AI | 中国 | 否 | 无需提示 |

#### 路由检测与提示机制

```javascript
// js/api.js 中新增
const OVERSEAS_PROVIDERS = ['openai', 'runway', 'pika', 'stable-video'];

function checkProxyRequired(provider) {
  if (!OVERSEAS_PROVIDERS.includes(provider)) return false;

  const proxyEnabled = Store.state.proxy?.enabled;
  if (!proxyEnabled) {
    Modal.confirm({
      title: '需要代理',
      content: '该厂商位于海外，需要开启代理模式才能访问。是否前往代理设置？',
      onOk: () => Pages.open('proxy')
    });
    return true;
  }
  return false;
}

// 在 generateVideo 调用前检查
async function generateVideo(opts) {
  if (checkProxyRequired(opts.provider)) return;
  // ... 正常逻辑
}
```

#### 代理设置页面增强

在代理设置页面（`subProxy`）中，针对视频生成增加专门配置：

```
┌─────────────────────────────┐
│  代理模式                    │
├─────────────────────────────┤
│  [全局代理开关]              │
│                              │
│  视频生成厂商代理（单独配置）  │
│  ┌──────────────────────┐   │
│  │ OpenAI Sora          │   │
│  │ [代理地址] [端口]    │   │
│  │ [测试连接]           │   │
│  └──────────────────────┘   │
│  ┌──────────────────────┐   │
│  │ Runway               │   │
│  │ [代理地址] [端口]    │   │
│  │ [测试连接]           │   │
│  └──────────────────────┘   │
│  ...                         │
└─────────────────────────────┘
```

**功能**：
- 每个海外厂商可单独配置代理（不强制使用全局代理）
- "测试连接"按钮：检测代理是否可连通该厂商 API
- 连通性状态显示：绿色（通畅）/ 红色（不通）

---

### 10.4 视频生成厂商配置（providers.js 扩展）

```javascript
// js/providers.js 中新增视频厂商
VIDEO_PROVIDERS: {
  'tongyi-wanxiang-video': {
    name: '通义万相视频',
    region: 'cn',
    base: () => 'https://dashscope.aliyuncs.com',
    videoEndpoint: '/api/v1/services/aigc/video-generation/generation',
    headers: (key) => ({ 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' }),
    needProxy: false,
    maxDuration: 5,
    supportedFormats: ['mp4']
  },
  'kling': {
    name: '可灵',
    region: 'cn',
    base: () => 'https://api.klingai.com',
    videoEndpoint: '/v1/videos',
    headers: (key) => ({ 'Authorization': 'Bearer ' + key }),
    needProxy: false,
    maxDuration: 10,
    supportedFormats: ['mp4']
  },
  'openai-sora': {
    name: 'OpenAI Sora',
    region: 'us',
    base: () => 'https://api.openai.com',
    videoEndpoint: '/v1/video/generations',
    headers: (key) => ({ 'Authorization': 'Bearer ' + key }),
    needProxy: true,
    proxyHint: '该厂商位于海外，需要开启代理模式才能访问',
    maxDuration: 60,
    supportedFormats: ['mp4']
  },
  'runway': {
    name: 'Runway',
    region: 'us',
    base: () => 'https://api.runwayml.com',
    videoEndpoint: '/v1/generations',
    headers: (key) => ({ 'Authorization': 'Bearer ' + key }),
    needProxy: true,
    proxyHint: '该厂商位于海外，需要开启代理模式才能访问',
    maxDuration: 16,
    supportedFormats: ['mp4']
  }
}
```

---

## 十一、最终留言

1. **内置书源至少30个** — 15个正版API + 15个聚合源，全部写入 `js/novel.js` 的默认书源数组
2. **法律风险规避** — 免责声明 + 不存储内容 + 投诉机制 + DMCA响应，缺一不可
3. **视频端优先展示"我的生成"** — 用户AI生成的视频是第一优先级，厂商API是补充
4. **国外厂商必须提示代理** — `needProxy: true` 的厂商在调用前自动检测代理状态，未开启时弹窗引导
5. **懒加载是硬性要求** — novel.js / comic.js / paint.js / video.js 等模块绝对不能在 index.html 中直接引入
6. **先做国内厂商** — 通义万相和可灵优先，Sora/Runway放到后面
