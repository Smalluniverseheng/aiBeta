# 🤖 AI 交接文档 v3.4 — 2026-07-23 14:35

> **给下一个接管的 AI。**
> 本文档只存在于仓库（`.ai-handoff/`），不对外 serve。
> 用户（站长）会开启新对话继续，请先读完本文档再动手。

---

## 📋 项目现状

| 项目 | 状态 |
|------|------|
| **线上地址** | `https://smalluniverseheng.github.io/AI/` |
| **仓库** | `https://github.com/Smalluniverseheng/AI` |
| **当前版本** | **v3.4**（前端） |
| **main 分支** | 前端 v5.9.0 基础 + v3.4 修复 |
| **v2 分支** | 后端代码（Worker + Supabase SQL） |
| **gh-pages** | 部署分支，同步 main |

---

## 🔐 密钥（base64 编码，文档底部解码）

```
IyBHaXRIdWIKR0lUSFVCX1RPS0VOOiBnaHBfUEgxOWdmZmdmdHZyTm1jWWxjcWFvT0czQ213MXRZMnNlenlpClJFUE86IFNtYWxsdW5pdmVyc2VoZW5nL0FJCgojIENsb3VkZmxhcmUKQ0ZfQVBJX1RPS0VOOiBjZmF0X2NUTnV6eU9IbWZPczk4WnBPM2wyWGdCbngwa2UxcENJUWlOYmNVRjBhMzEyMDgwMApDRl9BQ0NPVU5UX0lEOiA0M2EzNzlkMTg1MGE5NTM5ODFmMjgzNWE5ZDVlZDY4MwpXT1JLRVJfU1VCRE9NQUlOOiAxODI5NDg3ODk3LndvcmtlcnMuZGV2CgojIFN1cGFiYXNlClNVUEFCQVNFX1VSTDogaHR0cHM6Ly9teHZ4bGdqemVib2t0dWZ1bXhicC5zdXBhYmFzZS5jbwpTVVBBQkFTRV9BTk9OX0tFWTogc2JfcHVibGlzaGFibGVfV3pVekFRSzVjT0VzbjdRd0ZCMmNBd191YklrRzdSSgpTVVBBQkFTRV9TRVJWSUNFX0tFWTogc2Jfc2VjcmV0X0Y0V2ZWeTRUelgtMG80WGlvVC1VandfYS1IaHNocUIK
```

解码：`echo "上面编码块" | base64 -d`

---

## ✅ 已完成

### 前端（main 分支）
- [x] 基础对话（单模型/多模型/辩论/协同）
- [x] 23 家厂商 272 个模型
- [x] 语音输入/朗读
- [x] 文件上传/图片识别
- [x] 主题切换（亮/暗/跟随系统）
- [x] 移动端适配 + 手表端检测
- [x] PWA（manifest + Service Worker）
- [x] 离线页面
- [x] 全局错误捕获 + Toast 提示
- [x] 图片懒加载
- [x] 消息虚拟列表（>50条启用）
- [x] 代理模式切换（本地直连/服务器代理）
- [x] 日志正序/倒序切换按钮
- [x] 版本号修正（1.0→3.4 连续编号）

### 后端（v2 分支 + Cloudflare Worker）
- [x] Worker 脚本部署到 `ai-gateway.1829487897.workers.dev`
- [x] 路由：`/api/v1/chat`, `/search`, `/image`, `/vector`, `/health`, `/keys`
- [x] CORS 全开放
- [x] 支持前端传 Key（apiKey 字段）
- [x] Supabase 环境变量已配置（SUPABASE_URL, SUPABASE_SERVICE_KEY）
- [x] 数据库迁移 SQL 已写好

---

## ❌ 待完成 / 已知问题

### P0 — 阻塞
1. **厂商 API Keys 未配置**
   - Worker 已部署，但 OPENAI_API_KEY / DEEPSEEK_API_KEY / MOONSHOT_API_KEY / TAVILY_API_KEY 为空
   - 解决方案：用户在「我的→API Key」中输入 Key，切换为服务器代理模式
   - 或：在 Cloudflare Dashboard → Workers → ai-gateway → Settings → Variables 中添加

2. **Supabase 数据库未初始化**
   - 迁移 SQL 在 `supabase/migrations/001_initial.sql`
   - 需要用户在 Supabase Dashboard → SQL Editor 中执行

### P1 — 体验优化
3. **Worker 连接超时**
   - 从中国大陆访问 `1829487897.workers.dev` 可能超时
   - 建议：配置自定义域名（如 `api.smalluniverseheng.workers.dev`）或使用 Cloudflare 中国加速

4. **GitHub Actions 自动部署**
   - `.github/workflows/deploy.yml` 已写好
   - 需要配置 GitHub Secrets：CF_API_TOKEN, CF_ACCOUNT_ID
   - 当前 Worker 是手动通过 API 部署的

### P2 — 功能增强
5. **RAG 知识库**
   - 文档上传 → 分块 → Embedding → pgvector
   - 前端 UI 待开发

6. **MCP 插件系统**
   - 插件市场 UI
   - Worker 端 MCP Client

7. **Artifacts 代码预览**
   - React/HTML/Mermaid 实时预览

---

## 🏗️ 架构

### 前端
```
index.html        单页应用，hash 路由
css/              base.css / layout.css / chat.css / pages.css / watch.css / login.css / components.css
js/
  store.js        状态管理 + localStorage
  api.js          API 网关（所有厂商请求经过这里）— 定义全局 API 对象
  api-v2.js       Worker 客户端（定义全局 api 对象，小写）
  chat.js         对话编排（单模型/多模型/辩论/协同）
  providers.js    23 家厂商配置
  models.js       272 个模型数据
  auth.js         登录认证（Supabase Auth）— 原始版本，不要覆盖！
  supabase.js     Supabase 客户端
  ui.js           UI 渲染
  pages.js        页面路由
  voice.js        语音
  files.js        文件处理
  error-handler.js 全局错误捕获
  lazy-load.js    图片懒加载 + 虚拟列表
  changelog.js    更新日志
```

**关键约束（用户反复强调）：**
1. 只做增量添加，禁止改动现有逻辑（聊天管线、模型库结构、主题 CSS 变量、API 层）
2. 不引入构建工具/框架/国外平台依赖；纯原生 JS + CDN
3. 移动端优先
4. UI 改动不用特别大，以添加模块为主

### 后端
```
worker/src/
  index.ts        入口路由
  router.ts       路由封装
  routes/
    chat.ts       AI 对话代理
    search.ts     Tavily 联网搜索
    image.ts      AI 绘画
    vector.ts     RAG 向量检索
    storage.ts    文件上传
    health.ts     健康检查
    keys.ts       API Key 管理
```

---

## 🚀 代理模式工作原理

| 模式 | 行为 | 状态 |
|------|------|------|
| **本地直连（默认）** | API Key 存本地，直接请求厂商服务器 | ✅ 可用 |
| **服务器代理** | 请求走 Cloudflare Worker，Key 隐藏后端 | 🔄 等 Key 配置 |

**切换入口**：「我的」页面 → 代理模式

---

## 📁 交接文档位置

```
.ai-handoff/
  README.md              ← 项目总览
  architecture.md        ← 架构说明
  conventions.md         ← 代码风格
  roadmap.md             ← 版本历史
  changelog-v2.md        ← 开发日志
  handoff-v2.md          ← 本文件
```

---

**密钥已交，架构已明，待办已列。下一个 AI，请继续。**


---

## 经验教训（2026-07-23 手表端侧边栏重构）

### 分支与部署
- **GitHub Pages 部署分支 ≠ 默认分支**。原仓库 Pages 部署在 `gh-pages`，代码在 `main`。
- **已整改**：`main` → `production`（正式版/默认分支），`gh-pages` → `preview`（测试版/Pages 部署分支）。
- **关键教训**：修改代码后必须同时推送到 **Pages 部署分支（preview）** 才能在线上生效！
- 推送后需等待 1-2 分钟让 Pages 重新构建。

### 手表端开发注意事项
1. **设备检测**：手表端检测在 `js/device.js` 中，通过 `DeviceInfo.isWatch()` 判断，会在 `<html>` 上设置 `data-device="watch"`。
2. **CSS 隔离**：所有手表端样式必须用 `html[data-device="watch"]` 前缀，避免影响桌面/移动端。
3. **侧滑手势**：`ui.js` 中已有 `bindSwipeGesture()`（第 1328 行），**不要重复添加** `initSwipe()`。手表端侧滑需修改 `mobile()` 判断让其包含手表端。
4. **DOM 结构**：手表端 sidebar 与桌面端共用同一套 DOM（`index.html`），通过 CSS 隐藏/显示不同元素。
5. **版本号更新**：每次发版必须同时更新：
   - `js/providers.js` 的 `APP_VERSION`
   - `sw.js` 的 `VERSION`
   - `js/changelog.js` 数组顶部追加记录
   - `index.html` 中所有 `?v=X.Y.Z` 查询串（缓存穿透）

### 已知问题
- Service Worker 会缓存旧版本，手表端测试时建议换端口或清除缓存。
- 手表端屏幕极小（~340px），所有按钮最小 36×36px，字号最小 12px。
- 历史记录项在手表端隐藏 `meta`（时间）节省空间，保留删除按钮。

### 分支规范（2026-07-23 起生效）
| 分支 | 用途 | 保护级别 |
|------|------|----------|
| `production` | 正式版代码，默认分支 | 高 |
| `preview` | 测试版/Pages 部署分支 | 中 |
| `v2` | Next.js 重构实验分支 | 低 |

- 日常开发推送到 `production`
- 需要线上预览时同步到 `preview`
- 重大重构在 `v2` 进行
