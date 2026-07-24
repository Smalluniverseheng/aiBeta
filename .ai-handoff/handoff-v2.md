# 🤖 AI 交接文档 v4.3 — 2026-07-24

> **给下一个接管的 AI。**
> 本文档只存在于仓库（`.ai-handoff/`），不对外 serve。
> 用户（站长）会开启新对话继续，请先读完本文档再动手。

---

## 📋 项目现状

| 项目 | 状态 |
|------|------|
| **线上测试版** | `https://smalluniverseheng.github.io/aiBeta/` |
| **线上正式版** | `https://smalluniverseheng.github.io/AI/` |
| **测试版仓库** | `https://github.com/Smalluniverseheng/aiBeta`（**你在这里**） |
| **正式版仓库** | `https://github.com/Smalluniverseheng/AI` |
| **当前版本** | **v4.3**（前端） |
| **aiBeta 默认分支** | `main` |
| **AI 默认分支** | `production` |

---

## ✅ 已完成（截至 v4.3）

### 核心功能
- [x] 四种对话模式：单模型 / 多模型并行对比 / 辩论（立论·攻辩·自由辩·总结·裁判）/ 协同（主持人→协作者→评审→汇总）
- [x] 23 家厂商 270+ 模型（`js/models.js` 嵌入式维护，支持实时同步）
- [x] 模型排行榜：综合榜 50 名 + 10 个分类榜单（代码/英文/困难提示/中文/多轮对话/创意写作/数学/指令遵循/日语/韩语），LMArena 2026-07-24 数据
- [x] 排行榜独立页面：左侧 11 分类导航，右侧雷达图/柱状图/榜单行
- [x] 语音输入（SpeechRecognition）+ AI 回复朗读（TTS，Browser/MiMo/OpenAI/Groq 多引擎）
- [x] 文件解析：图片（视觉模型）、PDF/Word/TXT/Markdown/CSV/代码文件
- [x] AI 绘画：OpenAI DALL·E / 火山引擎 Seedream / 通义万相
- [x] 联网搜索：Tavily 搜索注入，回答附带真实来源
- [x] 角色预设：30 个精品助手 + 用户自定义角色
- [x] 插件库：Tavily 联网搜索 / GitHub 连接器 / 腾讯云托管 / 开源生态导览
- [x] 技能库：15 个 Prompt 技能模板 + 自定义技能
- [x] Token 用量统计（真实 usage 优先 + 估算兜底，三种排序）
- [x] 翻译独立空间（一对多、朗读、克隆我的声音）

### 系统与体验
- [x] PWA：manifest + Service Worker，可安装到桌面/离线可用
- [x] 7 语言界面：简/繁/英/法/西/俄/阿
- [x] 主题：亮色 / 暗色 / 跟随系统
- [x] 三端适配：桌面端（≥1400px 宽屏）/ 移动端（≤860px 抽屉式）/ 手表端（≤340px 极简圆屏）
- [x] 手表端：Kimi 式抽屉侧滑（右滑开/左滑关）、长按菜单（重命名/置顶/删除/多选）、多选批量操作
- [x] 回收站：删除的对话和 API Key 移入回收站，支持恢复或彻底删除
- [x] 全局错误捕获 + 离线检测 + Toast 提示
- [x] 图片懒加载 + 消息虚拟列表（>50 条启用）
- [x] 代理模式切换：本地直连（默认）/ 服务器代理（Worker 部署后可用）
- [x] 消息重编辑、粘贴长文本自动转文件附件、回到底部按钮
- [x] 开屏页 splash（brand.jpg + 「纵横四海，引领无限」）
- [x] 编辑资料页（头像/名字/简介/账号安全：改邮箱/绑手机/改密码）

### 云端后端（v5.8 接入）
- [x] Supabase 数据库：完整 Schema + RLS 分级权限
- [x] 邮箱验证注册、管理员账号（1234/1234）
- [x] 游客纯本地、普通用户轻量同步、管理员全量数据上云
- [x] Storage 桶 user-files（文件云端存储）
- [x] 自动同步加固（cost_usd 列补齐、分步容错、失败 30s 重试）

### 后端 Worker（v2 分支，代码已写，待部署）
- [x] Cloudflare Worker 网关代码（TypeScript）：AI 对话 / 多模型并行 / 联网搜索 / AI 绘画 / RAG 向量检索 / 文件上传
- [x] Supabase 迁移 SQL：六表 Schema + pgvector
- [x] GitHub Actions 自动部署配置
- [ ] **待办**：注册 workers.dev 子域名、配置 GitHub Secrets（CF_API_TOKEN / CF_ACCOUNT_ID）、执行迁移 SQL

---

## ❌ 待完成 / 已知问题

### P0 — 阻塞
1. **Worker 未部署**
   - 前端 `api.js` 的 `CONFIG.BACKEND_URL` 仍为 `null`
   - 解决方案：部署 Worker 后填入地址，切换代理模式即可隐藏 Key

### P1 — 体验优化
2. **Mermaid 代码块渲染**
   - 中优先级，用户多次提到
3. **完整插件市场**
   - 10 个纯前端工具插件 UI 待开发

### P2 — 功能增强
4. **AI 集群模式（SwarmEngine）**
   - 最大块需求，对话模式第五种
5. **会员中心**
   - 身份卡 / 权益对比 / 配额模拟
6. **WebGPU 本地模型**
   - 低优先级，预留接口

---

## 🏗️ 架构速查

### 前端（aiBeta/main）
```
index.html        单页应用，hash 路由
css/              7 个样式文件（base/layout/components/chat/login/pages/watch）
js/
  store.js        状态管理 + localStorage（唯一持久化入口）
  api.js          API 网关（所有厂商请求经过这里）
  api-v2.js       Worker 客户端（小写 api 对象，当前为空壳）
  chat.js         四种对话模式编排
  providers.js    23 家厂商配置 + APP_VERSION
  models.js       270+ 模型 + MODEL_RANK 排行榜
  auth.js         本地 + Supabase 云端认证
  supabase.js     Supabase 客户端（SB 模块）
  ui.js           UI 渲染（含 fmtDate 全局工具）
  pages.js        页面路由 + subpage 体系
  voice.js        语音 ASR/TTS
  plugins.js      插件库
  skills.js       技能库
  error-handler.js 全局错误捕获
  lazy-load.js    懒加载 + 虚拟列表
```

**关键约束（用户反复强调）：**
1. 只做增量添加，禁止改动现有逻辑（聊天管线、模型库结构、主题 CSS 变量、API 层）
2. 不引入构建工具/框架/国外平台依赖；纯原生 JS + CDN
3. 移动端优先（黑鲨4 Pro + Termux + 苹果手表）
4. UI 改动不用特别大，以添加模块为主
5. **推送只推 aiBeta/main**

### 后端（AI/v2 分支，不在 aiBeta）
```
worker/src/
  index.ts        入口路由
  router.ts       路由封装
  routes/         chat/search/image/vector/storage/health/keys
```

---

## 📁 交接文档位置

```
.ai-handoff/
  README.md              ← 项目总览 + 仓库关系
  architecture.md        ← 架构说明 + 关键契约
  conventions.md         ← 代码风格 + 推送规范
  roadmap.md             ← 版本历史 + 待办
  handoff-v2.md          ← 本文件（最新交接状态）
  specs/                 ← 用户指令书原文存档
    2026-07-18-upgrade-spec.md
    2026-07-19-supabase-spec.md
```

---

**架构已明，待办已列。下一个 AI，请继续。**
