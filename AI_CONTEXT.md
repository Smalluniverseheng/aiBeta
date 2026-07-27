# AI_CONTEXT — 第三方科技 · AI 智能聚合平台

> **当前版本**: v5.2
> **最后更新**: 2026-07-27
> **仓库**: `Smalluniverseheng/aiBeta` (测试服) / `Smalluniverseheng/AI` (生产服)

---

## 快速开始

1. 读取 `00-START-HERE.md` 了解项目概览
2. 读取 `AI_README.md` 了解详细功能与交互逻辑
3. 读取 `01-RULES/` 目录下的规则文档
4. 读取 `.ai-handoff/handoff-v2.md` 了解经验教训

---

## 当前状态

### 已完成功能

- **v5.0**: 多厂商模型聚合、语音、文件、联网、绘画
- **v5.1**: 悬浮按钮、三端导航设置、侧边栏页面控制、子页面修复、同步修复
- **v5.2**: 悬浮按钮返回修复、帮助中心/回收站修复、对话页滑动手势

### 待开发功能

见 `.ai-handoff/roadmap.md`

### 已知问题

无阻塞性问题。

---

## 关键规则

### 版本号
- 只用 `x.y` 格式，禁止 `x.y.z`
- 发版改 4 处：providers.js、sw.js、index.html、changelog.js

### 分支
- `aiBeta/5.2`: 当前开发分支
- `AI/production`: 生产端
- `ai-context`: 本文档所在分支

### 代码规范
- Pages IIFE 内定义 renderXxx
- 事件委托优于直接绑定
- 不要在模块加载时清理数据

---

## 后端配置

### Supabase
- URL: 见 js/supabase.js
- 表: messages, usage, configs
- 约束: messages.id 非空

### API
- 模型请求通过 providers.js 中 baseURL 路由
- 支持 SSE 流式响应

---

## 部署

- 测试服: GitHub Pages (aiBeta 仓库)
- 生产服: GitHub Pages (AI 仓库)
- 缓存: 1-2 分钟生效，测试加 `?nocache=1`
