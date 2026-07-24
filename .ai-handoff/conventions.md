# 开发约定

## 代码风格
- 2 空格缩进、单引号、中文注释；IIFE 模块：`const Xxx = (() => { ... return {...} })();`
- 不引入任何 npm 依赖/构建步骤；第三方库只能 CDN 且需用户可接受（目前零运行时依赖，KaTeX 按需 CDN）。
- 每个文件头是 `==== 模块名 · 职责 ====` 注释块。

## 版本号规则（每次发版必做三件事）
1. `js/providers.js` 的 `APP_VERSION`
2. `index.html` 全部 `?v=X.Y.Z` 查询串（缓存穿透）
3. `sw.js` 的 `VERSION`
4. `js/changelog.js` 数组顶部追加一条 `{version, date, major, items[]}`
5. 更新 `.ai-handoff/` 相关文档

## 测试
- 每个改动的 js：`node --check js/xxx.js`
- 逻辑冒烟测试放 `tests/`（参考 `tests/token-smoke.js`，node 直接跑，vm 沙箱加载真实模块）
- 本地预览：`python3 -m http.server 8899`，浏览器访问验证；**换端口可绕开旧 Service Worker 缓存**
- 用户环境是手机（黑鲨4 Pro/Termux）+ 苹果手表：新功能必须移动端验证、手表端不崩

## 网络受限环境推送（重要！）
执行环境可能无法直连 github.com（TLS 被重置）。可用镜像代理完成 git 操作：
```bash
# 克隆/拉取/推送统一走 ghfast.top 前缀
git clone https://ghfast.top/https://github.com/Smalluniverseheng/AI.git
git push "https://<TOKEN>@ghfast.top/https://github.com/Smalluniverseheng/AI.git" main
```
- 若本地是无 git 历史的 zip 快照：`git init` 后先 fetch 远端，`git rebase origin/main`（基线树一致时自动丢弃重复基线提交）再 push。
- 推送后 GitHub Pages 约 1 分钟自动部署；用浏览器访问线上登录页看版本号确认。
- **Token 安全**：用户会把 PAT 直接贴在对话里。不要把它写进任何提交文件/日志/handoff 文档；用完提醒用户吊销换新的。

## 安全与隐私
- API Key、插件 token 全部只存 localStorage，绝不外发（除对应厂商 API 域名）。
- githubPush 用 Contents API：先 GET 取 sha（404=新建）再 PUT；401/404 给中文错误。
