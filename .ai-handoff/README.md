# AI 交接文档 · 给下一个接手的 AI

> 你好，接手的 AI。这个目录是专门为你准备的**项目交接包**。
> 用户（站长）的手机端纯前端项目，上下文有限，他会不定期换一个 AI 继续开发。请先读完本目录再动手。
> 此目录**只存在于仓库**，不会被网站引用（`.` 开头目录 GitHub Pages 不对外 serve）。

## 30 秒了解项目

- **项目**：第三方科技 · AI 智能聚合平台 —— 纯前端 PWA，零构建、零框架（原生 HTML/CSS/JS），GitHub Pages 托管。
- **线上正式版**：https://smalluniverseheng.github.io/AI/
- **线上测试版**：https://smalluniverseheng.github.io/aiBeta/
- **正式版仓库**：https://github.com/Smalluniverseheng/AI（默认分支 `production`）
- **测试版仓库**：https://github.com/Smalluniverseheng/aiBeta（默认分支 `main`，**你当前就在这个仓库**）
- **当前版本**：**v4.3**（2026-07-24）
- **核心约束（用户反复强调）**：
  1. **只做增量添加，禁止改动现有逻辑**（聊天管线、模型库结构、主题 CSS 变量、API 层）。
  2. 不引入构建工具/框架/国外平台依赖；纯原生 JS + CDN。
  3. **移动端优先**（用户主要在手机/手表上用，开发机是黑鲨4 Pro + Termux）。
  4. 数据全部 localStorage（Store 模块统一管理），预留后端切换能力。
  5. **推送代码只推 aiBeta（本仓库）**，正式版 AI 仓库由用户手动同步。

## 仓库关系

| 仓库 | 分支 | 用途 | Pages 部署 |
|------|------|------|-----------|
| `AI` | `production` | 正式版稳定代码 | 绑定 `production` |
| `AI` | `preview` | 正式版预览 | 备用 |
| `aiBeta` | `main` | **测试版（你在这里）** | 绑定 `main` |

**你的工作流程**：在 aiBeta 仓库修改 → 推送到 `main` → 用户验证后手动合并到正式版 `AI/production`。

## 目录内容

| 文件 | 内容 |
|---|---|
| `architecture.md` | 文件结构、模块边界、关键契约、数据流 |
| `conventions.md` | 代码风格、版本号规则、测试方法、推送方式 |
| `roadmap.md` | 版本历史摘要 + 已完成/进行中/待办需求 |
| `handoff-v2.md` | 最近一次完整交接状态（密钥、已完成、待办、经验教训） |
| `specs/` | 用户历轮需求原文存档 |

## 接手流程

1. 读 `architecture.md` + `conventions.md`（10 分钟）。
2. 读 `roadmap.md` 的「待办」区，确认用户本轮需求属于哪一块。
3. 修改前：`node --check` 你改过的每个 js 文件；用 `python3 -m http.server` 本地验证。
4. 每次发版：bump 三处版本号 + changelog.js 追加记录 + 更新本目录。
5. **推送只推 aiBeta 的 `main` 分支**（见 conventions.md）。

## 最近一次交接状态（v4.3 完成时更新）

- **已完成（v4.0~v4.3）**：
  - 排行榜扩展到 50 名 + 10 个分类榜单（代码/英文/困难提示/中文/多轮对话/创意写作/数学/指令遵循/日语/韩语）
  - 排行榜独立页面（发现页入口跳转，左侧 11 分类导航 + 右侧图表/榜单）
  - 雷达图/柱状图实时渲染
  - 手表端 Kimi 式抽屉侧滑、长按菜单、多选管理
  - 回收站功能（对话/API Key 删除后移入回收站，支持恢复/彻底删除）
  - 代理模式入口 UI 重构
  - 版本号统一对齐（providers.js / index.html / sw.js / changelog.js）
- **更早已完成**：单模型/多模型/辩论/协同四种对话模式、270+ 模型、语音 ASR/TTS、文件解析、AI 绘画、联网搜索、PWA、7 语言、Supabase 云端同步、插件库/技能库基础版、Token 统计、翻译空间、编辑资料页。
- **尚未做的大块**：AI 集群模式（SwarmEngine）、完整插件市场（10 个纯前端工具插件）、会员中心、Mermaid 渲染、WebGPU 本地模型。详见 roadmap.md。
