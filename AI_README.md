# AI 上下文恢复指南

> **每次对话开始时，AI 必须先读取本分支所有文件恢复上下文。**

## 快速恢复步骤

1. 读取 `RULES.md` → 了解版本号规则、分支规范、开发约束
2. 读取 `HISTORY.md` → 了解修改历史（按时间倒序）
3. 读取 `AI_CONTEXT.md` → 了解当前项目状态、已知问题、待办
4. 读取 `production` 分支的 `.ai-handoff/handoff-v2.md` → 了解完整交接信息

## 分支对应关系

| 旧名称 | 新名称 | 用途 |
|--------|--------|------|
| `main` | `production` | 开发主干（默认分支） |
| `gh-pages` | `preview` | 线上部署（GitHub Pages） |
| - | `backup` | 备份回滚 |
| - | `ai-context` | 本分支，存 AI 规则 |

## 每次发版后必须做的事

1. 更新 4 处版本号（providers.js / sw.js / changelog.js / index.html）
2. 推送到 `production`
3. 同步到 `preview`（线上生效）
4. 同步到 `backup`（备份）
5. 在 `ai-context` 分支更新 `HISTORY.md` 和 `AI_CONTEXT.md`

## 网络受限推送

```bash
git push "https://<TOKEN>@ghfast.top/https://github.com/Smalluniverseheng/AI.git" production
git push "https://<TOKEN>@ghfast.top/https://github.com/Smalluniverseheng/AI.git" preview
git push "https://<TOKEN>@ghfast.top/https://github.com/Smalluniverseheng/AI.git" backup
git push "https://<TOKEN>@ghfast.top/https://github.com/Smalluniverseheng/AI.git" ai-context
```

---

*本分支由 AI 维护，人类请勿直接修改。*
