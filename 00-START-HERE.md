# 00-START-HERE — AI 开发者入口

> 如果你是接手这个项目的 AI，请从这里开始阅读。

---

## 1. 项目是什么？

**第三方科技 · AI 智能聚合平台** — 一个纯前端实现的第三方 AI 对话聚合平台。

- 支持多厂商模型（OpenAI、Anthropic、Google、阿里云等）
- 语音输入/输出、文件上传、联网搜索、绘画
- PWA 架构，无后端服务器（除 Supabase 同步外）
- 部署在 GitHub Pages

---

## 2. 当前版本

**v5.2** — 已部署到生产服

最新功能：
- 可拖动悬浮返回按钮
- 三端导航设置（桌面/移动/手表）
- 对话页左右滑动手势展开/收起侧边栏
- 帮助中心、回收站等子页面修复

---

## 3. 必读文档（按顺序）

| 顺序 | 文档 | 内容 |
|------|------|------|
| 1 | `AI_README.md` | **最全面的指南** — 功能、交互逻辑、数据结构、API |
| 2 | `.ai-handoff/handoff-v2.md` | **经验教训** — 坑点、解决方案、测试清单 |
| 3 | `.ai-handoff/roadmap.md` | **版本规划** — 已完成和待开发功能 |
| 4 | `01-RULES/00-index.md` | **规则索引** — 版本号、分支、开发约束 |
| 5 | `AI_CONTEXT.md` | **快速参考** — 当前状态、关键规则 |

---

## 4. 关键规则（速查）

### 版本号
- 只用 `x.y` 格式，禁止 `x.y.z`
- 发版改 4 处：providers.js、sw.js、index.html、changelog.js

### 代码规范
- `renderXxx` 必须在 Pages IIFE 内部
- 事件委托优于直接绑定
- 不要在模块加载时清理数据

### 部署流程
1. `aiBeta/5.x` 开发 → 测试
2. 稳定后同步到 `AI/production`
3. GitHub Pages 1-2 分钟生效

---

## 5. 仓库地址

- 测试服: `https://github.com/Smalluniverseheng/aiBeta`
- 生产服: `https://github.com/Smalluniverseheng/AI`
- 测试地址: `https://smalluniverseheng.github.io/aiBeta/`
- 生产地址: `https://smalluniverseheng.github.io/AI/`

---

## 6. 给下一个 AI 的留言

**先读文档再动手！**

本项目有完整的文档体系，修改前先读 `AI_README.md` 和 `handoff-v2.md`。

最大的坑是 **Pages IIFE 作用域** — 所有 `renderXxx` 必须在 IIFE 内部。

版本号严格 **x.y** 格式，绝对禁止 x.y.z。

测试服先行，稳定后再推生产服。

---

最后更新: 2026-07-27 | v5.2
