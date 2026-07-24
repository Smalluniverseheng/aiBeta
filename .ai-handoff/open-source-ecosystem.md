# 开源插件/技能生态调研（2026-07-18）

> 用户要求：找相关的开源智能库平台、开源代码、API 代理。结论如下，供后续版本对接参考。

## 插件/工具生态

| 生态 | 地址 | 说明 | 对本项目的价值 |
|---|---|---|---|
| MCP 官方 servers + Registry | github.com/modelcontextprotocol/servers | Anthropic 主导的 Model Context Protocol，数百个 server（GitHub/Playwright/Context7/文件系统…），多语言 SDK | 插件架构的事实标准；本站「github-connector」就是其 Contents API 能力的精简前端版。后端上线后可整体接入 MCP |
| awesome-mcp-servers | github.com/punkpeye/awesome-mcp-servers | 社区精选 MCP server 清单（含中文 README） | 选品参考 |
| Cline MCP Marketplace | github.com/cline/mcp-marketplace | VSCode Cline 的一键安装 MCP 市场 | 「插件市场」交互参考 |
| Dify 插件市场 | marketplace.dify.ai | 120+ 插件（模型+工具），插件包本地安装 | 插件包格式与审核分发参考 |
| LobeChat 插件 | github.com/lobehub/lobe-chat-plugins | index.json 索引的插件市场，已支持 MCP 一键安装 | 前端插件索引格式（index.json）可直接借鉴 |
| Open WebUI Tools | openwebui.com | 社区分享的 Tools/Functions（Python 函数式插件） | 技能/插件 UGC 模式参考 |

## 技能（Prompt 模板）生态
- LobeChat assistants 市场、Open WebUI 的 Prompts、各大 Prompt 集合站（LangGPT 结构化提示词社区）——技能库模板可持续从这些开源社区精选翻译。

## 开源 API 代理/网关（用户提到"API 代理"）
| 项目 | 地址 | 说明 |
|---|---|---|
| One API | github.com/songquanpeng/one-api | 开源 LLM API 网关：统一 OpenAI 格式分发各家 Key、额度管理、渠道负载 |
| New API | github.com/QuantumNous/new-api | One API 的活跃分支，UI 更现代，功能更全 |
| one-hub | github.com/MartialBE/one-hub | 另一活跃分支 |
- 价值：后端（Termux/服务器）上线时，可用 New API 做统一网关，前端只对接一个 base_url 即可管所有厂商 Key 与额度——与现有 PROVIDERS 架构兼容。

## 结论
- 纯前端阶段：插件继续做「配置型 + CDN 工具型」；技能库模板从开源社区扩充。
- 后端阶段：优先接 MCP（工具调用标准化）+ New API（Key 网关），避免自造协议。
