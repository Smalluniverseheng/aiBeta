# 架构说明

## 技术形态
纯静态多文件 PWA：一个 `index.html` + `css/` + `js/` 若干原生 ES6 模块（IIFE 全局单例，非 ES Module），无构建步骤。所有 js 通过 `<script src="js/xxx.js?v=版本">` 顺序加载，靠全局对象互相调用（`Store` `UI` `Chat` `API` `Pages` `Voice` `Plugins` `Skills` `TokenStats` `MD` `I18n` `Toast` 等）。

## 文件与职责

```
index.html        全部页面/弹窗/subpage 的 DOM（单页应用，hash 路由 pageChat/pageModels/pageDiscover/pageProfile）
manifest.json     PWA 配置
sw.js             Service Worker（network-first，VERSION 常量控制缓存桶）
assets/brand.jpg  品牌 logo（开屏页用）
css/
  base.css        主题 CSS 变量（--bg/--card/--text-1/2/3/--border/--accent 等，明暗双主题）★禁止改变量名
  layout.css      整体布局/侧栏/移动端断点(≤860px)/手表适配入口
  login.css       登录页 + 开屏页 splash
  chat.css        对话页/消息气泡/工具卡片/思考面板
  pages.css       模型页/排行榜/发现页/我的页/各 subpage
  watch.css       手表端（小屏）适配 ★别破坏
js/
  store.js        Store：state + localStorage 持久化（DEFAULTS 扩展须做老数据兼容）
  token.js        TokenStats：usage 记账/估算/聚合查询
  api.js          API：三家格式（OpenAI 兼容/Anthropic/Google）流式+非流式、usage 捕获、30s 熔断
  api-v2.js       Worker 客户端（服务器代理模式，BACKEND_URL 未配置时为空壳）
  models.js       MODELS 目录（270+）+ MODEL_RANK 排行榜数据
  modelsync.js    模型目录辅助（实时同步 + 目录合并）
  providers.js    PROVIDERS 厂商配置（23 家）+ APP_VERSION
  plugins.js      Plugins：插件定义与配置（tavily-search/github-connector/tencent-cloud/opensource-ecosystem）
  skills.js       Skills：内置技能(润色/摘要/代码解释) + 模板库 + 自定义技能，与 toolsEnabled 双向同步
  chat.js         Chat：会话 CRUD、发送管线（单模型/多模型/辩论/协同）、中止、重生成
  ui.js           UI：消息渲染(msgHtml/thinkingHtml/工具卡片)、侧栏、顶栏、手势、播报按钮
  pages.js        Pages：模型页/排行榜/发现页/工具弹窗/我的页/subpage 体系/语音工坊/翻译空间
  voice.js        Voice：ASR/TTS 多引擎（browser/MiMo/OpenAI/Groq）、speakMimo/speakClone
  markdown.js     MD：markdown 渲染 + 代码块复制 + KaTeX
  i18n.js         I18n：7 语言词条（新增词条至少补 zh-CN/zh-TW/en）
  changelog.js    CHANGELOG：更新日志数据（数组末尾追加，render 时 reverse）
  auth.js         Auth：本地账号 + Supabase 云端认证（邮箱验证注册，管理员 1234/1234）
  supabase.js     Supabase 云端同步客户端（RLS 分级权限）
  icons.js        icon() SVG 图标库（新增图标加这里）
  app.js          启动入口：Store.load → 登录 → showApp → splash
  error-handler.js 全局错误捕获 + 离线检测 + Toast 提示
  lazy-load.js    图片懒加载 + 消息虚拟列表（>50 条启用）
  device.js       设备检测（UA + 视口 → html data-device 标记）
  files.js        文件上传/解析（图片/PDF/Word/TXT/Markdown/CSV/代码）
  presets.js      30 个精品预设角色 + 用户自定义角色
  util.js         工具函数（esc/genId/debounce 等）
tests/            冒烟测试（token-smoke.js / sync-fault-smoke.js / sb-smoke.js）
```

## 关键契约（跨模块调用，改签名前全文搜索调用方）

- `API.chat({modelId, messages, onChunk, onThinking, onToolCall, signal}) → {content, thinking, toolCalls, usage}`
- `TokenStats.estimate/record/byProvider/grand/fmt/reset`
- `Plugins.getGithub() → {enabled, token, repo, branch}|null`；`Plugins.githubPush(path, content, message) → Promise<html_url>`
- `Skills.listEnabled()/toggle/addFromLibrary/addCustom/removeCustom/getPrompt`
- `Pages.openSub(id)/closeSubs()` —— subpage 机制：`.subpage` DOM + `data-sub` 条目
- 消息对象：`{id, role, content, thinking, toolCalls, image, file, model, ts, error}`（老数据缺字段必须可渲染）

## 数据流
用户输入 → chat.js 组装 messages（注入系统提示/语言提示/角色/联网）→ api.js 按厂商格式 fetch SSE → 回调流式更新 ui.js → 完成时记账 TokenStats、存 Store。全部状态在 `Store.state`（key: `ai_chat_state_v5`），`Store.save()` 400ms 防抖落盘。

## 云端后端（v5.8 接入，Supabase）
- 项目：`mxvxlgjzeboktufumxbp`（ap-south-1，Free Tier：DB 500MB / Storage 1GB / 60 并发）
- 前端只用 **publishable key**；secret key 永不入库/入前端
- 表与权限（RLS 强制）：
  - 管理员专属（`is_admin()` 才可读写）：conversations、messages、token_usage、cloud_backups
  - 全用户本人表：profiles(display_name,is_admin)、user_settings(jsonb)、encrypted_api_keys(AES-GCM)、custom_roles
- 管理员账号：email `admin@thirdparty.ai`（默认密码 1234）；登录页账号 `1234`/`admin` 映射到该邮箱
- js/supabase.js 是唯一云访问层（SB 模块：Auth/Profile/Sync）
- 分级同步：游客=零云同步；普通用户=轻量（设置/加密Key/昵称/角色）；管理员=轻量+全量（会话/消息/用量/云备份）

## Cloudflare Worker（v2 分支，待部署）
- 代码在 `AI` 仓库的 `v2` 分支，**不在 aiBeta**
- 路由：`/api/v1/chat`, `/multi`, `/search`, `/image`, `/vector`, `/health`, `/keys`
- 状态：代码已写，Worker 子域名未注册，前端 `api.js` 的 `CONFIG.BACKEND_URL` 仍为 `null`
- 部署后前端只需改 `CONFIG.BACKEND_URL` 即可切换代理模式

## 设计约定
- 增量开发：新功能优先加新文件/新 subpage/新 CSS 追加，不重构旧代码。
- 样式一律用现有 CSS 变量，明暗主题自动适配；新 CSS 追加到对应文件末尾。
- 文案全中文走 i18n（大量历史文案是硬编码中文，新功能要求至少三语言）。
- 移动端(≤860px)与桌面双布局已存在；手表端有独立简化 UI，新功能默认手表端隐藏或降级。
