# 开发日志 · v6.0 后端架构升级（2026-07-22）

> 本文档记录 v6.0 版本的全部开发过程、决策和遗留问题。
> 只存在于仓库，不对外 serve。

---

## 版本信息

- **版本号**：v6.0
- **日期**：2026-07-22
- **类型**：major（里程碑版本）
- **负责人**：AI 编程助手（k3）

---

## 本次更新内容

### 后端基础设施

1. **Cloudflare Worker 网关**
   - 文件：`worker/src/index.ts`, `worker/src/router.ts`
   - 路由：`/api/v1/chat`, `/api/v1/chat/multi`, `/api/v1/search`, `/api/v1/image`, `/api/v1/vector/search`, `/api/v1/storage/upload`, `/api/v1/health`
   - CORS 全开放（生产环境建议限制为特定域名）

2. **厂商适配（23 家）**
   - 文件：`worker/src/routes/chat.ts`
   - 已适配：OpenAI, Anthropic, Google, DeepSeek, Moonshot, Alibaba
   - 待扩展：Baichuan, Zhipu, MiniMax, Spark, Ernie, Hunyuan, Doubao, Qwen, Coze, Groq, Cohere, Mistral, Perplexity, Together, Fireworks, Novita, SiliconFlow
   - 统一请求格式：OpenAI-compatible

3. **多模型并行**
   - 文件：`worker/src/routes/multi.ts`
   - SSE 流式，按 model_id 前缀分发 chunk

4. **联网搜索代理**
   - 文件：`worker/src/routes/search.ts`
   - Tavily API 代理，返回 answer + sources

5. **AI 绘画代理**
   - 文件：`worker/src/routes/image.ts`
   - OpenAI DALL-E 代理

6. **RAG 向量检索**
   - 文件：`worker/src/routes/vector.ts`
   - OpenAI text-embedding-3-small → Supabase pgvector
   - RPC 函数：`match_document_chunks`

7. **文件上传代理**
   - 文件：`worker/src/routes/storage.ts`
   - Cloudflare R2（可选）

8. **API Key 管理**
   - 文件：`worker/src/routes/keys.ts`
   - 支持本地存储或云端同步（Supabase）

### 数据库 Schema

- 文件：`supabase/migrations/001_initial.sql`
- 六表：profiles, chats, messages, documents, document_chunks, user_settings
- RLS 策略：用户只能访问自己的数据
- 向量索引：ivfflat on embedding vector_cosine_ops

### 前端对接

- 文件：`js/api-v2.js`（前端 API 客户端）
- 文件：`js/api-keys.js`（API Key 管理面板）
- 接入点：`js/api.js` 的 `CONFIG.BACKEND_URL`

### 自动部署

- 文件：`.github/workflows/deploy.yml`
- 触发：push 到 v2 分支
- 工具：wrangler CLI

---

## 开发过程记录

### 2026-07-22 17:48 — 开始
- 用户上传《AI_重构指导文件_v1.md》
- 目标：基于 Next.js 15 重构 → 用户纠正：保留 main 前端，只加后端

### 2026-07-22 18:00 — 前端修复
- 发现 gh-pages 被错误修改导致空白
- 重置 gh-pages 为 main 精确副本
- 前端恢复正常

### 2026-07-22 19:00 — 后端代码编写
- 编写 Cloudflare Worker 网关（TypeScript）
- 编写 Supabase 数据库迁移 SQL
- 编写 GitHub Actions 部署配置

### 2026-07-22 20:00 — 部署尝试
- GitHub Actions 失败：R2 bucket 不存在
- 修复：去掉 wrangler.toml 中的 R2 配置
- 再次失败：workers.dev 子域名未注册
- 结论：需要用户在 Cloudflare 控制台手动注册

### 2026-07-22 21:00 — 前端对接
- 编写 `js/api-v2.js`（前端调用 Worker）
- 编写 `js/api-keys.js`（API Key 管理）
- 推送到 v2 分支

### 2026-07-22 22:00 — 交接文档
- 编写本文档
- 更新 `js/changelog.js` 添加 v6.0
- 更新 `.ai-handoff/` 目录

---

## 遗留问题

1. **Worker 未部署** — 需要用户在 Cloudflare 控制台注册 workers.dev 子域名
2. **GitHub Secrets 未配置** — 需要添加厂商 API Keys
3. **Supabase 数据库未初始化** — 需要执行迁移 SQL
4. **前端未接入后端** — `js/api.js` 的 `CONFIG.BACKEND_URL` 仍为 null
5. **R2 文件存储未启用** — 可选功能，当前已去掉配置

---

## 版本号规则

- 从 1.0 开始，每次更新 +0.1
- major: true 标记里程碑版本（如 3.0, 5.0, 6.0）
- 日志格式：`{ version: 'X.Y', date: 'YYYY-MM-DD', major: bool, items: ['...'] }`
- 每次发版必做：更新 `js/changelog.js` + `sw.js` VERSION + `index.html` ?v= 缓存穿透 + `.ai-handoff/` 文档


---

## v6.1 前端优化（2026-07-23）

### PWA 完善
- 新增 `offline.html` 离线页面
- `manifest.json` 添加 screenshots 和 shortcuts
- `sw.js` 版本升级至 v6.1，缓存策略优化

### 错误处理
- 新增 `js/error-handler.js`：全局错误捕获、离线检测、Toast 提示
- 新增 `js/lazy-load.js`：图片懒加载、消息虚拟列表

### 性能优化
- 图片懒加载：Intersection Observer，200px rootMargin
- 虚拟列表：超过 50 条消息时启用
- 性能监控：LCP/FID 和长任务监控

### 版本号
- 所有资源缓存穿透标记：`?v=5.9.0` → `?v=6.1`
- `js/changelog.js` 添加 v6.1 记录


---

## 版本号修正（2026-07-23）

### 问题
- 原日志存在跳版本：1.0 → 1.4（缺少 1.1/1.2/1.3）
- 版本号不连续：2.0 后直接 2.2（缺少 2.1）
- 日期混乱：多个版本共用同一日期，里程碑标记不一致
- 最新版本错误标记为 6.1（实际应为 3.3）

### 修正规则
1. **从 1.0 开始，每次 +0.1，连续编号**
2. **里程碑（major=true）**：x.0 版本 + 创立(1.0) + 首次部署(1.1)
3. **日期**：1.0 = 2026-06-10（创立），1.1 = 2026-07-10（部署），后续顺延
4. **共 24 个版本**，最新为 **v3.3**

### 修正后版本对照
| 旧版本 | 旧日期 | → | 新版本 | 新日期 | 里程碑 |
|--------|--------|---|--------|--------|--------|
| 1.0 | 2026-06-10 | → | **1.0** | 2026-06-10 | ★ 创立 |
| 1.4 | 2026-07-10 | → | **1.1** | 2026-07-10 | ★ 首次部署 |
| 1.5 | 2026-07-10 | → | **1.2** | 2026-07-10 | |
| 1.6 | 2026-07-10 | → | **1.3** | 2026-07-10 | |
| 1.7 | 2026-07-10 | → | **1.4** | 2026-07-10 | |
| 1.8 | 2026-07-10 | → | **1.5** | 2026-07-10 | |
| 1.9 | 2026-07-10 | → | **1.6** | 2026-07-10 | |
| 2.0 | 2026-07-10 | → | **1.7** | 2026-07-10 | |
| 2.1 | 2026-07-10 | → | **1.8** | 2026-07-10 | |
| 2.2 | 2026-07-10 | → | **1.9** | 2026-07-10 | |
| 3.0 | 2026-07-10 | → | **2.0** | 2026-07-10 | ★ |
| 3.1 | 2026-07-10 | → | **2.1** | 2026-07-10 | |
| 3.2 | 2026-07-10 | → | **2.2** | 2026-07-10 | |
| 3.3 | 2026-07-10 | → | **2.3** | 2026-07-10 | |
| 3.4 | 2026-07-10 | → | **2.4** | 2026-07-10 | |
| 3.5 | 2026-07-10 | → | **2.5** | 2026-07-10 | |
| 3.6 | 2026-07-10 | → | **2.6** | 2026-07-10 | |
| 3.7 | 2026-07-10 | → | **2.7** | 2026-07-10 | |
| 3.8 | 2026-07-10 | → | **2.8** | 2026-07-10 | |
| 3.9 | 2026-07-10 | → | **2.9** | 2026-07-10 | |
| 4.0 | 2026-07-10 | → | **3.0** | 2026-07-10 | ★ |
| 5.0 | 2026-07-18 | → | **3.1** | 2026-07-18 | ★ |
| 6.0 | 2026-07-22 | → | **3.2** | 2026-07-22 | ★ |
| 6.1 | 2026-07-23 | → | **3.3** | 2026-07-23 | |

### 当前版本
- **前端版本**：v3.3
- **后端版本**：v2（开发中，Worker 待部署）
