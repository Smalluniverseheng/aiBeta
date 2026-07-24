# AI 交接文档 · 给下一个接手的 AI

> 你好，接手的 AI。这个目录是专门为你准备的**项目交接包**（对应用户所说的 OpenSpec / GitHub Spec Kit 式交接）。
> 用户（站长）的手机端纯前端项目，上下文有限，他会不定期换一个 AI 继续开发。请先读完本目录再动手。
> 此目录**只存在于仓库**，不会被网站引用（`.` 开头目录 GitHub Pages 不对外 serve）。

## 30 秒了解项目

- **项目**：第三方科技 · AI 智能聚合平台 —— 纯前端 PWA，零构建、零框架（原生 HTML/CSS/JS），GitHub Pages 托管。
- **线上**：https://smalluniverseheng.github.io/AI/ ｜ **仓库**：https://github.com/Smalluniverseheng/AI
- **当前版本**：v5.7.0（2026-07-18）
- **核心约束（用户反复强调）**：
  1. **只做增量添加，禁止改动现有逻辑**（聊天管线、模型库结构、主题 CSS 变量、API 层）。
  2. 不引入构建工具/框架/国外平台依赖；纯原生 JS + CDN。
  3. **移动端优先**（用户主要在手机/手表上用，开发机是黑鲨4 Pro + Termux）。
  4. 数据全部 localStorage（Store 模块统一管理），预留后端切换能力。

## 目录内容

| 文件 | 内容 |
|---|---|
| `architecture.md` | 文件结构、模块边界、关键契约（跨模块调用签名）、数据流 |
| `conventions.md` | 代码风格、版本号规则、测试方法、**推送方式（网络受限必看）** |
| `roadmap.md` | 版本历史摘要 + 已完成/进行中/待办需求（含用户指令书三大模块的拆解状态） |
| `open-source-ecosystem.md` | 用户要求调研的开源插件/技能生态（MCP、Dify、LobeChat 等）结论 |
| `specs/` | 用户历轮需求原文存档 |

## 接手流程

1. 读 `architecture.md` + `conventions.md`（10 分钟）。
2. 读 `roadmap.md` 的「待办」区，确认用户本轮需求属于哪一块。
3. 修改前：`node --check` 你改过的每个 js 文件；用 `python3 -m http.server` 本地验证。
4. 每次发版：bump 三处版本号（见 conventions.md）+ changelog.js 顶部加记录 + 更新本目录。
5. 推送方法见 `conventions.md`「网络受限环境推送」一节。

## 最近一次交接状态（v5.7.0 完成时更新）

- 已完成：回到底部按钮 / 开屏页 / 日志折叠 / 插件库+技能库基础版 / 粘贴转文件 / 消息重编辑 / 顶栏自动播报+新对话 / GitHub 连接器推送卡片。
- 用户指令书（specs/2026-07-18-upgrade-spec.md）中**尚未做**的大块：AI 集群模式（SwarmEngine）、完整插件市场、会员中心。详见 roadmap.md。
