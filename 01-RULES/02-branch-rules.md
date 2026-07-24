# 分支与推送规则（强制）

---

## 分支对应关系

| 旧名称 | 新名称 | 用途 | 保护级别 |
|--------|--------|------|----------|
| `main` | `production` | 开发主干（默认分支） | 高 |
| `gh-pages` | `preview` | 线上部署（GitHub Pages） | 高 |
| - | `backup` | 备份回滚 | 中 |
| - | `ai-context` | AI 规则/上下文 | 低 |
| - | `v2` | Next.js 重构实验 | 低 |

---

## 推送规则

### 每次发版后必须执行（4 个分支都要推）

```bash
# 1. 开发主干
git push origin production

# 2. 线上部署（GitHub Pages 实际部署的分支）
git push origin preview

# 3. 备份回滚
git push origin backup

# 4. AI 上下文
git push origin ai-context
```

### 网络受限推送（中国大陆）

```bash
git push "https://<TOKEN>@ghfast.top/https://github.com/Smalluniverseheng/AI.git" production
git push "https://<TOKEN>@ghfast.top/https://github.com/Smalluniverseheng/AI.git" preview
git push "https://<TOKEN>@ghfast.top/https://github.com/Smalluniverseheng/AI.git" backup
git push "https://<TOKEN>@ghfast.top/https://github.com/Smalluniverseheng/AI.git" ai-context
```

---

## 关键教训

**GitHub Pages 部署的是 `preview` 分支，不是 `production`。**

如果只推送到 `production`，线上看到的还是旧代码。

**已发生过的错误**：
- 修改了 `main` 分支，但 Pages 部署的是 `gh-pages` → 线上无变化
- 修改了 `production` 分支，但忘记同步到 `preview` → 线上无变化

---

## 分支同步命令

```bash
# 将 production 最新代码同步到 preview
git checkout preview
git merge production --no-edit
git push origin preview

# 将 production 同步到 backup
git checkout backup
git merge production --no-edit
git push origin backup
```

---

## GitHub Pages 配置

- **部署分支**：`preview`
- **部署路径**：`/`（根目录）
- **访问地址**：`https://smalluniverseheng.github.io/AI/`
- **构建状态**：`https://github.com/Smalluniverseheng/AI/actions`

---

## 故障排查

| 现象 | 原因 | 解决 |
|------|------|------|
| 线上还是旧界面 | 只推了 production，没推 preview | 同步到 preview |
| Pages 构建失败 | Jekyll 解析错误 | 已添加 `.nojekyll` 绕过 |
| 缓存未更新 | Service Worker 缓存 | 清除浏览器缓存或换端口测试 |
| 构建排队中 | GitHub Pages 构建队列 | 等待 1-2 分钟 |
