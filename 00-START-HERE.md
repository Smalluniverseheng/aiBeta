# 🚀 AI 接手指南（START HERE）

> **每次对话开始时，按顺序读取以下文件恢复上下文。**
> **不要跳过任何步骤。**

---

## 📋 必做清单（每次对话）

1. ✅ 读取 `01-RULES/00-index.md` → 了解所有规则
2. ✅ 读取 `02-CURRENT-STATE.md` → 了解当前项目状态
3. ✅ 读取 `05-CREDENTIALS.md` → 获取必要凭证
4. ✅ 读取 `production` 分支的 `.ai-handoff/handoff-v2.md` → 完整交接信息

**以上 4 步完成后，才能开始执行用户指令。**

---

## 📁 目录结构

```
ai-context/
├── 00-START-HERE.md          ← 你在这里（入口）
├── 01-RULES/                 ← 【每次必看】规则目录
│   ├── 00-index.md           ← 规则总览
│   ├── 01-version-rules.md   ← 版本号规则（强制）
│   ├── 02-branch-rules.md    ← 分支与推送规则（强制）
│   ├── 03-dev-constraints.md ← 开发约束（强制）
│   └── 04-watch-rules.md     ← 手表端开发规范
├── 02-CURRENT-STATE.md       ← 【每次必看】当前状态快照
├── 03-HISTORY/               ← 【详细过程】版本历史
│   ├── v3.6.md
│   └── v3.5.md
├── 04-ARCHIVE/               ← 【详细过程】完整交接文档
│   ├── handoff-v2.md
│   ├── architecture.md
│   ├── conventions.md
│   ├── roadmap.md
│   └── specs/
└── 05-CREDENTIALS.md         ← 【每次必看】凭证（安全）
```

---

## ⚡ 快速判断

| 场景 | 读取文件 |
|------|----------|
| 第一次接手 | 全部读一遍 |
| 日常开发 | `01-RULES/00-index.md` + `02-CURRENT-STATE.md` |
| 发版时 | `01-RULES/01-version-rules.md` |
| 出 Bug 时 | `03-HISTORY/` + `04-ARCHIVE/handoff-v2.md` |
| 手表端问题 | `01-RULES/04-watch-rules.md` |

---

## 🔔 重要提醒

- **上下文有限制**：超过限制时必须让用户说"继续"重置工具调用
- **工具调用耗尽时**：告诉用户"回复继续即可重置工具调用"
- **不要暴露凭证**：Secret Key 只存 Worker 环境变量
- **只做增量添加**：禁止改动现有逻辑（聊天管线、模型库、主题 CSS、API 层）

---

*最后更新：2026-07-23 | 版本：v3.6*
