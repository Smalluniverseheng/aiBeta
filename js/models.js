/* ==================== MODELS · 模型目录（嵌入式数据文件） ====================
 * 【如何手动更新模型】
 * 【当前规模】共 272 个模型（2026-07 期，已合并《全球 AI 大模型 API 完整历史版本调研》103 条；其他厂商模型原样保留）。
 * 1. 直接增删改下面的条目即可，字段说明：
 *    id        厂商 API 的真实模型 ID
 *    name      显示名称
 *    provider  厂商（必须与 js/providers.js 中的厂商名一致）
 *    type      chat | tts | asr | voiceclone | voicedesign（仅 chat 可对话）
 *    ctx       上下文长度（单位 K，1024 = 100 万 tokens）
 *    vision    是否支持识图（图片输入）
 *    thinking  是否支持深度思考（推理过程输出）
 *    stream    是否支持流式输出（chat 类默认 true）
 *    status    active 在售 | new 新上线 | deprecated 已下架
 * 2. 保存后刷新页面即生效，无需改其他文件。
 * 3. 也可以在「模型」页点「同步」按钮，从已配置 Key 的厂商实时拉取最新模型列表。
 * ============================================================================= */
const MODELS = [
  // 小米 MiMo
  {id:'mimo-v2.5-pro',name:'MiMo v2.5 Pro',provider:'小米 MiMo',ctx:1024,thinking:true,desc:'小米 MiMo 旗舰推理模型，百万级上下文，数学与代码能力突出，支持深度思考。'},
  {id:'mimo-v2.5-pro-ultraspeed',name:'MiMo v2.5 Pro UltraSpeed',provider:'小米 MiMo',ctx:1024,thinking:true},
  {id:'mimo-v2.5',name:'MiMo v2.5',provider:'小米 MiMo',ctx:128},
  {id:'mimo-v2.5-tts',name:'MiMo v2.5 TTS',provider:'小米 MiMo',type:'tts',ctx:128,stream:false,note:'需内测资格'},
  {id:'mimo-v2.5-tts-voiceclone',name:'MiMo VoiceClone',provider:'小米 MiMo',type:'voiceclone',ctx:128,stream:false,note:'需内测资格'},
  {id:'mimo-v2.5-tts-voicedesign',name:'MiMo VoiceDesign',provider:'小米 MiMo',type:'voicedesign',ctx:128,stream:false,note:'需内测资格'},
  {id:'mimo-v2.5-asr',name:'MiMo ASR',provider:'小米 MiMo',type:'asr',ctx:128,stream:false,note:'需内测资格'},
  // DeepSeek
  {id:'deepseek-chat',name:'DeepSeek Chat',provider:'DeepSeek',ctx:128,status:'deprecated'},
  {id:'deepseek-reasoner',name:'DeepSeek Reasoner',provider:'DeepSeek',ctx:128,thinking:true,status:'deprecated'},
  {id:'deepseek-coder',name:'DeepSeek Coder',provider:'DeepSeek',ctx:128,status:'deprecated'},
  {id:'deepseek-v4-pro',name:'DeepSeek V4 Pro',provider:'DeepSeek',ctx:1024,vision:true,thinking:true,status:'new',desc:'DeepSeek 最新旗舰，推理、代码与Agent能力全面升级，支持识图与深度思考。'},
  {id:'deepseek-v4-flash',name:'DeepSeek V4 Flash',provider:'DeepSeek',ctx:1024,vision:true,status:'new'},
  {id:'deepseek-v3.2',name:'DeepSeek V3.2',provider:'DeepSeek',ctx:128,status:'deprecated'},
  {id:'deepseek-r1',name:'DeepSeek R1',provider:'DeepSeek',ctx:128,thinking:true,status:'deprecated'},
  // 通义千问
  {id:'qwen3.7-max',name:'Qwen3.7-Max',provider:'通义千问',ctx:1024,vision:true,thinking:true,desc:'通义千问最强旗舰，全模态理解，支持深度思考与厂商联网搜索，百万上下文。'},
  {id:'qwen3.6-max',name:'Qwen3.6-Max',provider:'通义千问',ctx:1024,vision:true,thinking:true},
  {id:'qwen3.5-plus',name:'Qwen3.5 Plus',provider:'通义千问',ctx:1024,vision:true},
  {id:'qwen3-max',name:'Qwen3-Max',provider:'通义千问',ctx:262,desc:'通义千问旗舰级超大模型，262K 长上下文，综合能力均衡。'},
  {id:'qwen-plus',name:'通义千问 Plus',provider:'通义千问',ctx:1024,thinking:true},
  {id:'qwen2.5-72b',name:'Qwen2.5-72B',provider:'通义千问',ctx:128},
  {id:'qwen-max',name:'通义千问 Max',provider:'通义千问',ctx:128,vision:true},
  {id:'qwen-turbo',name:'通义千问 Turbo',provider:'通义千问',ctx:131,thinking:true},
  {id:'qwen-long',name:'通义千问 Long',provider:'通义千问',ctx:10240},
  {id:'qwen-vl-max',name:'通义千问 VL Max',provider:'通义千问',ctx:128,vision:true},
  {id:'qwen-coder-plus',name:'通义代码专家',provider:'通义千问',ctx:128},
  {id:'qwen-vl-plus',name:'通义千问 VL Plus',provider:'通义千问',ctx:128,vision:true},
  // 智谱AI
  {id:'glm-5.2',name:'GLM-5.2',provider:'智谱AI',ctx:256,vision:true,thinking:true,desc:'智谱最新旗舰，Agent 与代码能力大幅增强，支持思考开关与联网检索。'},
  {id:'glm-5.1',name:'GLM-5.1',provider:'智谱AI',ctx:256,vision:true,thinking:true},
  {id:'glm-5',name:'GLM-5',provider:'智谱AI',ctx:128,vision:true,thinking:true},
  {id:'glm-5-turbo',name:'GLM-5-Turbo',provider:'智谱AI',ctx:128,thinking:true},
  {id:'glm-4.7',name:'GLM-4.7',provider:'智谱AI',ctx:128,vision:true,thinking:true},
  {id:'glm-4.7-flashx',name:'GLM-4.7-FlashX',provider:'智谱AI',ctx:128},
  {id:'glm-4.7-flash',name:'GLM-4.7-Flash',provider:'智谱AI',ctx:128},
  {id:'glm-4-plus',name:'GLM-4 Plus',provider:'智谱AI',ctx:128,vision:true,thinking:true},
  {id:'glm-4-air',name:'GLM-4 Air',provider:'智谱AI',ctx:128},
  {id:'glm-4-flash',name:'GLM-4 Flash',provider:'智谱AI',ctx:128},
  {id:'glm-4v-plus',name:'GLM-4V Plus',provider:'智谱AI',ctx:128,vision:true},
  {id:'glm-4-long',name:'GLM-4 Long',provider:'智谱AI',ctx:1024},
  // 文心一言
  {id:'ernie-4.5-turbo',name:'ERNIE 4.5 Turbo',provider:'文心一言',ctx:128,vision:true,thinking:true,desc:'百度文心旗舰，多模态理解，中文创作与知识问答表现出色。'},
  {id:'ernie-4.0-turbo-8k',name:'ERNIE 4.0 Turbo',provider:'文心一言',ctx:8,vision:true},
  {id:'ernie-speed',name:'ERNIE Speed',provider:'文心一言',ctx:128},
  {id:'ernie-lite',name:'ERNIE Lite',provider:'文心一言',ctx:128},
  {id:'ernie-3.5-8k',name:'文心一言 3.5',provider:'文心一言',ctx:8},
  // 火山引擎
  {id:'doubao-2.1-pro',name:'Doubao 2.1 Pro',provider:'火山引擎',ctx:256,vision:true,thinking:true,desc:'字节豆包旗舰，支持深度思考与识图，响应速度快，性价比高。'},
  {id:'doubao-seed-1.6',name:'Doubao-Seed 1.6',provider:'火山引擎',ctx:128,thinking:true,vision:true,desc:'字节 Seed 1.6，自适应思考，多模态理解。'},
  {id:'doubao-lite',name:'Doubao Lite',provider:'火山引擎',ctx:32},
  {id:'doubao-1.5-pro-256k',name:'豆包 1.5 Pro',provider:'火山引擎',ctx:256,vision:true},
  {id:'doubao-1.5-lite-32k',name:'豆包 1.5 Lite',provider:'火山引擎',ctx:32},
  {id:'doubao-pro-256k',name:'豆包 Pro',provider:'火山引擎',ctx:256,vision:true,thinking:true},
  {id:'doubao-1.5-pro-32k',name:'豆包 1.5 Pro 32K',provider:'火山引擎',ctx:32},
  {id:'doubao-vision',name:'豆包 Vision',provider:'火山引擎',ctx:128,vision:true},
  // 腾讯混元
  {id:'hunyuan-turbos',name:'HY 2.0 / 混元-TurboS',provider:'腾讯混元',ctx:256,vision:true,thinking:true,desc:'腾讯混元 TurboS，快思考+深思考双模式，响应极快。'},
  {id:'hunyuan-standard',name:'混元-Standard',provider:'腾讯混元',ctx:128},
  {id:'hunyuan-lite-v2',name:'混元-Lite',provider:'腾讯混元',ctx:128},
  {id:'hunyuan-3.0',name:'混元3.0',provider:'腾讯混元',ctx:256,vision:true,thinking:true,desc:'腾讯混元新一代旗舰，多模态+深度思考，长文档处理能力强。'},
  {id:'hunyuan-pro',name:'混元 Pro',provider:'腾讯混元',ctx:128,vision:true,thinking:true},
  {id:'hunyuan-turbo',name:'混元 Turbo',provider:'腾讯混元',ctx:128,vision:true},
  // Kimi
  {id:'kimi-k2.5',name:'Kimi K2.5',provider:'Kimi',ctx:256,vision:true,thinking:true,status:'deprecated'},
  {id:'kimi-k2',name:'Kimi K2',provider:'Kimi',ctx:256,vision:true,thinking:true,status:'deprecated'},
  {id:'kimi-k2.7-code',name:'Kimi K2.7 Code',provider:'Kimi',ctx:256,thinking:true,status:'new'},
  {id:'kimi-k2.6',name:'Kimi K2.6',provider:'Kimi',ctx:256,vision:true,thinking:true,status:'new'},
  {id:'moonshot-v1-128k',name:'Moonshot V1 128K',provider:'Kimi',ctx:128,status:'deprecated'},
  {id:'moonshot-v1-32k',name:'Moonshot V1 32K',provider:'Kimi',ctx:32,status:'deprecated'},
  {id:'moonshot-v1-8k',name:'Moonshot V1 8K',provider:'Kimi',ctx:8,status:'deprecated'},
  {id:'moonshot-v1-128k-vision-preview',name:'Moonshot V1 128K Vision',provider:'Kimi',ctx:128,vision:true,status:'deprecated'},
  {id:'moonshot-v1-32k-vision-preview',name:'Moonshot V1 32K Vision',provider:'Kimi',ctx:32,vision:true,status:'deprecated'},
  {id:'moonshot-v1-8k-vision-preview',name:'Moonshot V1 8K Vision',provider:'Kimi',ctx:8,vision:true,status:'deprecated'},
  {id:'kimi-k3',name:'Kimi K3',provider:'Kimi',ctx:256,vision:true,thinking:true,status:'new',desc:'月之暗面最新旗舰，长文本与推理能力业界领先，支持联网搜索。'},
  // MiniMax
  {id:'minimax-m3',name:'MiniMax-M3',provider:'MiniMax',ctx:1024,vision:true,thinking:true,desc:'MiniMax 旗舰，百万上下文，Agent 任务与代码能力出色。'},
  {id:'minimax-m2.7',name:'MiniMax-M2.7',provider:'MiniMax',ctx:1024,thinking:true},
  {id:'minimax-m2.5',name:'MiniMax-M2.5',provider:'MiniMax',ctx:1024,thinking:true},
  {id:'abab6.5s-chat',name:'MiniMax M1',provider:'MiniMax',ctx:1024,status:'deprecated'},
  {id:'abab6.5g-chat',name:'MiniMax M1 Pro',provider:'MiniMax',ctx:128,vision:true,status:'deprecated'},
  // 讯飞星火
  {id:'spark-max',name:'星火 Max',provider:'讯飞星火',ctx:128,vision:true,desc:'讯飞星火旗舰，中文语音与文本能力兼备，支持识图。'},
  {id:'spark-pro',name:'星火 Pro',provider:'讯飞星火',ctx:128},
  {id:'spark-lite',name:'星火 Lite',provider:'讯飞星火',ctx:128},
  // 昆仑万维
  {id:'skywork-math',name:'天工 天文',provider:'昆仑万维',ctx:128},
  {id:'skywork-13b',name:'天工 13B',provider:'昆仑万维',ctx:128},
  // 商汤
  {id:'SenseChat-5',name:'日日新 SenseChat 5',provider:'商汤',ctx:128,vision:true,thinking:true,desc:'商汤日日新 5.0，多模态理解，文科能力出色。'},
  {id:'SenseChat-32K',name:'日日新 32K',provider:'商汤',ctx:32},
  // 零一万物
  {id:'yi-large',name:'Yi Large',provider:'零一万物',ctx:128,desc:'零一万物旗舰，中英双语能力均衡。'},
  {id:'yi-vision',name:'Yi Vision',provider:'零一万物',ctx:128,vision:true},
  {id:'yi-lightning',name:'Yi Lightning',provider:'零一万物',ctx:128},
  // 阶跃星辰
  {id:'step-2-16k',name:'Step 2 16K',provider:'阶跃星辰',ctx:16,vision:true,desc:'阶跃星辰 Step 2 万亿参数 MoE 旗舰，支持识图。'},
  {id:'step-2-mini',name:'Step 2 Mini',provider:'阶跃星辰',ctx:128},
  // 百川智能
  {id:'Baichuan4',name:'百川4',provider:'百川智能',ctx:128,desc:'百川智能第四代旗舰，中文知识问答能力强。'},
  // OpenAI
  {id:'gpt-5',name:'GPT-5',provider:'OpenAI',ctx:1024,vision:true,thinking:true,desc:'OpenAI 第五代旗舰，内置深度推理，多模态理解。'},
  {id:'gpt-5-mini',name:'GPT-5 Mini',provider:'OpenAI',ctx:400,vision:true,thinking:true},
  {id:'gpt-4.1',name:'GPT-4.1',provider:'OpenAI',ctx:1024,vision:true},
  {id:'gpt-4.1-mini',name:'GPT-4.1 Mini',provider:'OpenAI',ctx:1024,vision:true},
  {id:'gpt-4.1-nano',name:'GPT-4.1 Nano',provider:'OpenAI',ctx:1024,vision:true},
  {id:'gpt-4o',name:'GPT-4o',provider:'OpenAI',ctx:128,vision:true},
  {id:'gpt-4o-mini',name:'GPT-4o Mini',provider:'OpenAI',ctx:128,vision:true},
  {id:'o3',name:'o3',provider:'OpenAI',ctx:200,vision:true,thinking:true},
  {id:'o3-mini',name:'o3-mini',provider:'OpenAI',ctx:200,thinking:true},
  {id:'o4-mini',name:'o4-mini',provider:'OpenAI',ctx:200,vision:true,thinking:true},
  {id:'o1',name:'o1',provider:'OpenAI',ctx:200,vision:true,thinking:true,status:'deprecated'},
  {id:'gpt-4-turbo',name:'GPT-4 Turbo',provider:'OpenAI',ctx:128,vision:true,status:'deprecated'},
  {id:'chatgpt-4o-latest',name:'ChatGPT-4o Latest',provider:'OpenAI',ctx:128,vision:true,status:'deprecated'},
  {id:'gpt-5.6-sol',name:'GPT-5.6 Sol',provider:'OpenAI',ctx:1024,vision:true,thinking:true,status:'new',desc:'OpenAI 最新旗舰，全能型选手，推理、创作、代码均为顶级水准。'},
  {id:'gpt-5.6-terra',name:'GPT-5.6 Terra',provider:'OpenAI',ctx:1024,vision:true,thinking:true,status:'new'},
  {id:'gpt-5.6-luna',name:'GPT-5.6 Luna',provider:'OpenAI',ctx:400,vision:true,thinking:true,status:'new'},
  {id:'gpt-3.5-turbo-0125',name:'GPT-3.5-Turbo-0125',provider:'OpenAI',ctx:16},
  {id:'gpt-4o-2024-08-06',name:'GPT-4o-2024-08-06',provider:'OpenAI',ctx:128,vision:true},
  {id:'gpt-5.1',name:'GPT-5.1',provider:'OpenAI',ctx:1024,vision:true,thinking:true},
  {id:'gpt-5.2',name:'GPT-5.2',provider:'OpenAI',ctx:1024,vision:true,thinking:true},
  {id:'gpt-5.3-instant',name:'GPT-5.3 Instant',provider:'OpenAI',ctx:1024,vision:true},
  {id:'gpt-5.4',name:'GPT-5.4',provider:'OpenAI',ctx:1024,vision:true,thinking:true},
  {id:'gpt-5.4-thinking',name:'GPT-5.4 Thinking',provider:'OpenAI',ctx:1024,vision:true,thinking:true},
  {id:'gpt-5.4-pro',name:'GPT-5.4 Pro',provider:'OpenAI',ctx:1024,vision:true,thinking:true},
  {id:'gpt-5.5',name:'GPT-5.5',provider:'OpenAI',ctx:1024,vision:true,thinking:true,status:'new'},
  {id:'gpt-5.6',name:'GPT-5.6',provider:'OpenAI',ctx:1536,vision:true,thinking:true,status:'new',note:'价格待公布'},
  {id:'o1-preview',name:'o1-preview',provider:'OpenAI',ctx:128,thinking:true},
  {id:'o1-mini',name:'o1-mini',provider:'OpenAI',ctx:128,thinking:true},
  {id:'o5',name:'o5',provider:'OpenAI',ctx:256,vision:true,thinking:true,note:'价格待公布'},
  // Anthropic
  {id:'claude-opus-4.7',name:'Claude Opus 4.7',provider:'Anthropic',ctx:1024,vision:true,thinking:true,status:'new',desc:'Anthropic 旗舰，严谨可靠，擅长复杂分析与长文档。'},
  {id:'claude-opus-4.6',name:'Claude Opus 4.6',provider:'Anthropic',ctx:1024,vision:true,thinking:true},
  {id:'claude-opus-4-20250514',name:'Claude Opus 4',provider:'Anthropic',ctx:200,vision:true,status:'deprecated'},
  {id:'claude-sonnet-4.6',name:'Claude Sonnet 4.6',provider:'Anthropic',ctx:1024,vision:true,thinking:true,desc:'Anthropic 主力模型，速度与能力平衡，代码能力一流。'},
  {id:'claude-sonnet-4-20250514',name:'Claude Sonnet 4',provider:'Anthropic',ctx:200,vision:true,status:'deprecated'},
  {id:'claude-sonnet-3.7',name:'Claude Sonnet 3.7',provider:'Anthropic',ctx:200,vision:true,thinking:true,status:'deprecated'},
  {id:'claude-haiku-4.5',name:'Claude Haiku 4.5',provider:'Anthropic',ctx:200,vision:true},
  {id:'claude-3-5-sonnet-20241022',name:'Claude 3.5 Sonnet',provider:'Anthropic',ctx:200,vision:true,status:'deprecated'},
  {id:'claude-3-5-haiku-20241022',name:'Claude 3.5 Haiku',provider:'Anthropic',ctx:200,vision:true,status:'deprecated'},
  {id:'claude-3-opus-20240229',name:'Claude 3 Opus',provider:'Anthropic',ctx:200,vision:true,status:'deprecated'},
  {id:'claude-3-haiku-20240307',name:'Claude 3 Haiku',provider:'Anthropic',ctx:200,status:'deprecated'},
  {id:'claude-fable-5',name:'Claude Fable 5',provider:'Anthropic',ctx:1024,vision:true,thinking:true,status:'new'},
  {id:'claude-sonnet-5',name:'Claude Sonnet 5',provider:'Anthropic',ctx:200,vision:true,thinking:true,status:'new'},
  {id:'claude-opus-4-8',name:'Claude Opus 4.8',provider:'Anthropic',ctx:200,vision:true,thinking:true,status:'new',desc:'Anthropic 最强模型，代码与写作能力业界标杆，超长上下文。'},
  {id:'claude-2',name:'Claude 2',provider:'Anthropic',ctx:100},
  {id:'claude-3-haiku',name:'Claude 3 Haiku',provider:'Anthropic',ctx:200},
  {id:'claude-3-sonnet',name:'Claude 3 Sonnet',provider:'Anthropic',ctx:200,vision:true},
  {id:'claude-3-opus',name:'Claude 3 Opus',provider:'Anthropic',ctx:200,vision:true},
  {id:'claude-3-5-sonnet',name:'Claude 3.5 Sonnet',provider:'Anthropic',ctx:200,vision:true},
  {id:'claude-3-5-haiku',name:'Claude 3.5 Haiku',provider:'Anthropic',ctx:200},
  {id:'claude-sonnet-4',name:'Claude Sonnet 4',provider:'Anthropic',ctx:200,vision:true},
  {id:'claude-sonnet-4-5',name:'Claude Sonnet 4.5',provider:'Anthropic',ctx:200,vision:true},
  {id:'claude-opus-4-1',name:'Claude Opus 4.1',provider:'Anthropic',ctx:200,vision:true,thinking:true},
  {id:'claude-opus-4-5',name:'Claude Opus 4.5',provider:'Anthropic',ctx:200,vision:true,thinking:true},
  {id:'claude-mythos-5',name:'Claude Mythos 5',provider:'Anthropic',ctx:1024,vision:true,thinking:true,status:'new',note:'需审核访问'},
  // Google
  {id:'gemini-3.1-pro',name:'Gemini 3.1 Pro',provider:'Google',ctx:200,vision:true,thinking:true,desc:'Google 最新旗舰，原生多模态，百万上下文，内置联网搜索。'},
  {id:'gemini-3.1-flash-lite',name:'Gemini 3.1 Flash-Lite',provider:'Google',ctx:1024,vision:true,status:'new'},
  {id:'gemini-2.5-pro',name:'Gemini 2.5 Pro',provider:'Google',ctx:1024,vision:true,thinking:true,desc:'Google 高性能模型，思考模式加持，多模态理解出色。'},
  {id:'gemini-2.5-flash',name:'Gemini 2.5 Flash',provider:'Google',ctx:1024,vision:true},
  {id:'gemini-2.5-flash-lite',name:'Gemini 2.5 Flash-Lite',provider:'Google',ctx:1024,vision:true},
  {id:'gemini-2.0-flash',name:'Gemini 2.0 Flash',provider:'Google',ctx:1024,vision:true},
  {id:'gemini-1.5-pro',name:'Gemini 1.5 Pro',provider:'Google',ctx:128,vision:true},
  {id:'gemini-1.5-flash',name:'Gemini 1.5 Flash',provider:'Google',ctx:1024,vision:true},
  {id:'gemini-3.5-flash',name:'Gemini 3.5 Flash',provider:'Google',ctx:1024,vision:true,status:'new'},
  {id:'bard',name:'Bard',provider:'Google',ctx:8},
  {id:'gemini-1.0-nano',name:'Gemini 1.0 Nano',provider:'Google',ctx:32},
  {id:'gemini-1.5-pro-002',name:'Gemini 1.5 Pro-002',provider:'Google',ctx:2048,vision:true},
  {id:'gemini-1.5-flash-002',name:'Gemini 1.5 Flash-002',provider:'Google',ctx:1024,vision:true},
  {id:'gemini-2.0-flash-exp',name:'Gemini 2.0 Flash Exp',provider:'Google',ctx:1024,vision:true},
  {id:'gemini-2.0-flash-lite',name:'Gemini 2.0 Flash-Lite',provider:'Google',ctx:1024,vision:true},
  {id:'gemini-2.0-flash-thinking-exp',name:'Gemini 2.0 Flash Thinking',provider:'Google',ctx:32,thinking:true},
  // xAI
  {id:'grok-4.5',name:'Grok 4.5',provider:'xAI',ctx:500,vision:true,thinking:true,status:'new',desc:'xAI 旗舰，实时信息获取能力强，推理与幽默感兼备。'},
  {id:'grok-4.3',name:'Grok 4.3',provider:'xAI',ctx:1024,vision:true,thinking:true,status:'new'},
  {id:'grok-4.20',name:'Grok 4.20',provider:'xAI',ctx:2048,vision:true,thinking:true,desc:'xAI 高性能版本，支持深度思考，实时联网。'},
  {id:'grok-4.1-fast',name:'Grok 4.1 Fast',provider:'xAI',ctx:128,vision:true,thinking:true},
  {id:'grok-code-fast-1',name:'Grok-code-fast-1',provider:'xAI',ctx:256,thinking:true},
  {id:'grok-2',name:'Grok 2',provider:'xAI',ctx:128,status:'deprecated'},
  {id:'grok-3',name:'Grok 3',provider:'xAI',ctx:131,vision:true,thinking:true},
  {id:'grok-3-mini',name:'Grok 3 Mini',provider:'xAI',ctx:131,vision:true,thinking:true},
  {id:'grok-2-1212',name:'Grok 2 GA',provider:'xAI',ctx:128},
  {id:'grok-2-vision-1212',name:'Grok 2 Vision',provider:'xAI',ctx:32,vision:true},
  {id:'grok-3-fast',name:'Grok 3 Fast',provider:'xAI',ctx:131,vision:true,thinking:true},
  {id:'grok-3-mini-fast',name:'Grok 3 Mini Fast',provider:'xAI',ctx:131,vision:true,thinking:true},
  {id:'grok-3-beta',name:'Grok 3 Beta',provider:'xAI',ctx:131,vision:true,thinking:true},
  {id:'grok-4',name:'Grok 4',provider:'xAI',ctx:256,vision:true,thinking:true},
  {id:'grok-4-heavy',name:'Grok 4 Heavy',provider:'xAI',ctx:256,vision:true,thinking:true},
  {id:'grok-4-fast',name:'Grok 4 Fast',provider:'xAI',ctx:2048,vision:true,thinking:true},
  {id:'grok-4.1',name:'Grok 4.1',provider:'xAI',ctx:2048,vision:true,thinking:true},
  {id:'grok-4-1-fast-reasoning',name:'Grok 4.1 Fast Reasoning',provider:'xAI',ctx:2048,vision:true,thinking:true},
  {id:'grok-4-1-fast-non-reasoning',name:'Grok 4.1 Fast Non-Reasoning',provider:'xAI',ctx:2048,vision:true},
  {id:'grok-4.20-multi-agent',name:'Grok 4.20 Multi-Agent',provider:'xAI',ctx:2048,vision:true,thinking:true},
  {id:'grok-4.20-reasoning',name:'Grok 4.20 Reasoning',provider:'xAI',ctx:2048,vision:true,thinking:true},
  {id:'grok-4.20-non-reasoning',name:'Grok 4.20 Non-Reasoning',provider:'xAI',ctx:2048,vision:true},
  {id:'grok-build-0.1',name:'Grok Build 0.1',provider:'xAI',ctx:256,thinking:true,status:'new'},
  // Mistral
  {id:'mistral-medium-3.5',name:'Mistral Medium 3.5',provider:'Mistral',ctx:128,vision:true},
  {id:'mistral-large-3',name:'Mistral Large 3',provider:'Mistral',ctx:128,vision:true,desc:'Mistral 欧洲旗舰，多语言能力出色，支持识图。'},
  {id:'mistral-small-4',name:'Mistral Small 4',provider:'Mistral',ctx:128,vision:true},
  {id:'codestral-latest',name:'Codestral',provider:'Mistral',ctx:128},
  {id:'devstral-2',name:'Devstral 2',provider:'Mistral',ctx:128},
  {id:'ministral-3b',name:'Ministral 3B',provider:'Mistral',ctx:32},
  {id:'mistral-large-latest',name:'Mistral Large',provider:'Mistral',ctx:128,vision:true},
  {id:'mistral-small-latest',name:'Mistral Small',provider:'Mistral',ctx:128,vision:true},
  {id:'pixtral-large-latest',name:'Pixtral Large',provider:'Mistral',ctx:128,vision:true},
  // Meta
  {id:'llama-4-maverick',name:'Llama 4 Maverick',provider:'Meta',ctx:128,vision:true,thinking:true,desc:'Meta 开源旗舰，原生多模态 MoE 架构，可自由部署。'},
  {id:'llama-4-scout',name:'Llama 4 Scout',provider:'Meta',ctx:128,vision:true},
  {id:'llama-3.3-70b',name:'Llama 3.3 70B',provider:'Meta',ctx:128},
  {id:'llama-3.2-90b-vision',name:'Llama 3.2 90B Vision',provider:'Meta',ctx:128,vision:true},
  {id:'llama-3.2-11b-vision',name:'Llama 3.2 11B Vision',provider:'Meta',ctx:128,vision:true},
  {id:'llama-3.1-405b',name:'Llama 3.1 405B',provider:'Meta',ctx:128,status:'deprecated'},
  {id:'llama-3.1-70b',name:'Llama 3.1 70B',provider:'Meta',ctx:128,status:'deprecated'},
  {id:'llama-3-8b',name:'Llama 3 8B',provider:'Meta',ctx:8},
  {id:'llama-3-70b',name:'Llama 3 70B',provider:'Meta',ctx:8},
  // Cohere
  {id:'command-r-plus',name:'Command R+',provider:'Cohere',ctx:128,status:'deprecated'},
  {id:'command-r',name:'Command R',provider:'Cohere',ctx:128,status:'deprecated'},
  {id:'command-a',name:'Command A',provider:'Cohere',ctx:128,vision:true,desc:'Cohere 企业级旗舰，RAG 与工具调用能力专精。'},
  {id:'command-r7b',name:'Command R7B',provider:'Cohere',ctx:128},
  // Groq
  {id:'llama-3.1-70b-versatile',name:'Llama 3.1 70B (Groq)',provider:'Groq',ctx:128,status:'deprecated'},
  {id:'mixtral-8x7b-32768',name:'Mixtral 8x7B (Groq)',provider:'Groq',ctx:32,status:'deprecated'},
  {id:'llama-3.3-70b-versatile',name:'Llama 3.3 70B (Groq)',provider:'Groq',ctx:128},
  // ---- 历史模型（已下架，仅供欣赏） ----
  // 小米 MiMo 历史
  {id:'mimo-v2',name:'MiMo v2',provider:'小米 MiMo',ctx:128,status:'deprecated'},
  {id:'mimo-v2-pro',name:'MiMo v2 Pro',provider:'小米 MiMo',ctx:256,thinking:true,status:'deprecated'},
  // OpenAI 历史
  {id:'gpt-4',name:'GPT-4',provider:'OpenAI',ctx:8,status:'deprecated',desc:'OpenAI 划时代模型，2023 年发布，奠定了大模型应用浪潮。'},
  {id:'gpt-3.5-turbo',name:'GPT-3.5 Turbo',provider:'OpenAI',ctx:4,status:'deprecated',desc:'ChatGPT 初代同款，轻快实用，曾是全球调用量最大的模型。'},
  {id:'gpt-3',name:'GPT-3',provider:'OpenAI',ctx:2,status:'deprecated'},
  {id:'gpt-3.5-turbo-16k',name:'GPT-3.5-Turbo-16K',provider:'OpenAI',ctx:16,status:'deprecated'},
  {id:'gpt-4-32k',name:'GPT-4-32K',provider:'OpenAI',ctx:32,status:'deprecated'},
  // Anthropic 历史
  {id:'claude-2.1',name:'Claude 2.1',provider:'Anthropic',ctx:200,status:'deprecated'},
  {id:'claude-2.0',name:'Claude 2.0',provider:'Anthropic',ctx:100,status:'deprecated'},
  {id:'claude-instant-1.2',name:'Claude Instant 1.2',provider:'Anthropic',ctx:100,status:'deprecated'},
  {id:'claude-1',name:'Claude 1',provider:'Anthropic',ctx:9,status:'deprecated'},
  {id:'claude-instant-1',name:'Claude Instant 1',provider:'Anthropic',ctx:9,status:'deprecated'},
  // Google 历史
  {id:'gemini-1.0-pro',name:'Gemini 1.0 Pro',provider:'Google',ctx:32,status:'deprecated'},
  {id:'gemini-1.5-flash-8b',name:'Gemini 1.5 Flash-8B',provider:'Google',ctx:1024,vision:true,status:'deprecated'},
  {id:'palm-2',name:'PaLM 2',provider:'Google',ctx:8,status:'deprecated'},
  {id:'palm-2-chat',name:'PaLM 2 Chat',provider:'Google',ctx:8,status:'deprecated'},
  {id:'gemini-1.0-ultra',name:'Gemini 1.0 Ultra',provider:'Google',ctx:32,status:'deprecated'},
  {id:'gemini-2.0-pro-exp',name:'Gemini 2.0 Pro Exp',provider:'Google',ctx:2048,vision:true,status:'deprecated'},
  // DeepSeek 历史
  {id:'deepseek-v2.5',name:'DeepSeek V2.5',provider:'DeepSeek',ctx:128,status:'deprecated'},
  {id:'deepseek-v2',name:'DeepSeek V2',provider:'DeepSeek',ctx:128,status:'deprecated'},
  {id:'deepseek-coder-v2',name:'DeepSeek Coder V2',provider:'DeepSeek',ctx:128,status:'deprecated'},
  // 通义千问历史
  {id:'qwen2.5-max',name:'Qwen2.5-Max',provider:'通义千问',ctx:128,status:'deprecated'},
  {id:'qwen2-72b-instruct',name:'Qwen2-72B',provider:'通义千问',ctx:128,status:'deprecated'},
  {id:'qwen1.5-72b-chat',name:'Qwen1.5-72B',provider:'通义千问',ctx:32,status:'deprecated'},
  // 智谱AI历史
  {id:'glm-4-0520',name:'GLM-4 0520',provider:'智谱AI',ctx:128,status:'deprecated'},
  {id:'glm-4-airx',name:'GLM-4 AirX',provider:'智谱AI',ctx:8,status:'deprecated'},
  {id:'glm-3-turbo',name:'GLM-3 Turbo',provider:'智谱AI',ctx:128,status:'deprecated'},
  // 文心一言历史
  {id:'ernie-4.0-8k',name:'ERNIE 4.0',provider:'文心一言',ctx:8,status:'deprecated'},
  {id:'ernie-bot-turbo',name:'ERNIE Bot Turbo',provider:'文心一言',ctx:8,status:'deprecated'},
  // 火山引擎历史
  {id:'doubao-pro-4k',name:'豆包 Pro 4K',provider:'火山引擎',ctx:4,status:'deprecated'},
  {id:'doubao-pro-32k',name:'豆包 Pro 32K',provider:'火山引擎',ctx:32,status:'deprecated'},
  {id:'doubao-lite-4k',name:'豆包 Lite 4K',provider:'火山引擎',ctx:4,status:'deprecated'},
  // 腾讯混元历史
  {id:'hunyuan-large',name:'混元 Large',provider:'腾讯混元',ctx:128,status:'deprecated'},
  // MiniMax 历史
  {id:'abab6-chat',name:'ABAB 6',provider:'MiniMax',ctx:8,status:'deprecated'},
  {id:'abab5.5-chat',name:'ABAB 5.5',provider:'MiniMax',ctx:16,status:'deprecated'},
  // 讯飞星火历史
  {id:'spark-v3.5',name:'星火 v3.5',provider:'讯飞星火',ctx:8,status:'deprecated'},
  {id:'spark-v3.0',name:'星火 v3.0',provider:'讯飞星火',ctx:8,status:'deprecated'},
  {id:'spark-v2.0',name:'星火 v2.0',provider:'讯飞星火',ctx:8,status:'deprecated'},
  // 商汤历史
  {id:'SenseChat-128K',name:'日日新 128K',provider:'商汤',ctx:128,status:'deprecated'},
  // 零一万物历史
  {id:'yi-34b-chat',name:'Yi-34B Chat',provider:'零一万物',ctx:4,status:'deprecated'},
  {id:'yi-medium',name:'Yi Medium',provider:'零一万物',ctx:16,status:'deprecated'},
  // 阶跃星辰历史
  {id:'step-1-32k',name:'Step 1 32K',provider:'阶跃星辰',ctx:32,status:'deprecated'},
  {id:'step-1v-32k',name:'Step 1V 32K',provider:'阶跃星辰',ctx:32,vision:true,status:'deprecated'},
  // 百川智能历史
  {id:'Baichuan3-Turbo',name:'百川3 Turbo',provider:'百川智能',ctx:32,status:'deprecated'},
  {id:'Baichuan2-53B',name:'百川2 53B',provider:'百川智能',ctx:8,status:'deprecated'},
  // Meta 历史
  {id:'llama-3-70b-instruct',name:'Llama 3 70B',provider:'Meta',ctx:8,status:'deprecated'},
  {id:'llama-3-8b-instruct',name:'Llama 3 8B',provider:'Meta',ctx:8,status:'deprecated'},
  {id:'llama-2-70b-chat',name:'Llama 2 70B',provider:'Meta',ctx:4,status:'deprecated'},
  {id:'llama-1-7b',name:'Llama 1 7B',provider:'Meta',ctx:2,status:'deprecated'},
  {id:'llama-1-13b',name:'Llama 1 13B',provider:'Meta',ctx:2,status:'deprecated'},
  {id:'llama-1-33b',name:'Llama 1 33B',provider:'Meta',ctx:2,status:'deprecated'},
  {id:'llama-1-65b',name:'Llama 1 65B',provider:'Meta',ctx:2,status:'deprecated'},
  {id:'llama-2-7b',name:'Llama 2 7B',provider:'Meta',ctx:4,status:'deprecated'},
  {id:'llama-2-13b',name:'Llama 2 13B',provider:'Meta',ctx:4,status:'deprecated'},
  {id:'llama-2-70b',name:'Llama 2 70B',provider:'Meta',ctx:4,status:'deprecated'},
  {id:'llama-2-code-*',name:'Llama 2 Code',provider:'Meta',ctx:4,status:'deprecated'},
  // Mistral 历史
  {id:'mistral-large-2407',name:'Mistral Large 2',provider:'Mistral',ctx:128,status:'deprecated'},
  {id:'mixtral-8x22b-instruct',name:'Mixtral 8x22B',provider:'Mistral',ctx:64,status:'deprecated'},
  {id:'mixtral-8x7b-instruct',name:'Mixtral 8x7B',provider:'Mistral',ctx:32,status:'deprecated'},
  {id:'mistral-7b-instruct',name:'Mistral 7B',provider:'Mistral',ctx:32,status:'deprecated'},
  // Cohere 历史
  {id:'command',name:'Command',provider:'Cohere',ctx:4,status:'deprecated'},
  {id:'command-light',name:'Command Light',provider:'Cohere',ctx:4,status:'deprecated'},
  // xAI 历史
  {id:'grok-beta',name:'Grok Beta',provider:'xAI',ctx:128,status:'deprecated'},
  {id:'grok-2-mini',name:'Grok 2 Mini',provider:'xAI',ctx:128,status:'deprecated'},
  {id:'grok-1',name:'Grok 1',provider:'xAI',ctx:8,status:'deprecated'},
  {id:'grok-1.5',name:'Grok 1.5',provider:'xAI',ctx:128,status:'deprecated'},
  // Groq 历史
  {id:'gemma2-9b-it',name:'Gemma 2 9B (Groq)',provider:'Groq',ctx:8,status:'deprecated'},
  {id:'llama-3.1-8b-instant',name:'Llama 3.1 8B (Groq)',provider:'Groq',ctx:128},
];

/* ==================== MODEL_RANK · 模型排行榜 ====================
 * 数据锚定公开榜单 2026-07 期：LMArena（lmarena.ai，原 Chatbot Arena）文本总榜
 * （2026-07-17 快照，Elo 评分）与代码榜，并交叉校准 Artificial Analysis 智能/代码指数、
 * SWE-bench Verified / Pro 公开成绩。综合榜 15 名带六维评分，代码榜 10 名。
 * dims 六维（0-100）：综合能力 / 推理 / 代码 / 长文本 / 多模态 / 速度，用于雷达图。
 * ================================================================ */
const MODEL_RANK = {
  /* 综合榜：LMArena Overall（2026-07-24 更新，50名） */
  overall: [
    {id:'claude-fable-5', name:'Anthropic claude-fable-5', provider:'Anthropic', score:1500, dims:[100,100,99,100,85,95]},
    {id:'claude-opus-4-6-thinking', name:'Anthropic claude-opus-4-6-thinking', provider:'Anthropic', score:1498, dims:[99,98,100,99,85,95]},
    {id:'claude-opus-4-7-thinking', name:'Anthropic claude-opus-4-7-thinking', provider:'Anthropic', score:1496, dims:[98,99,97,98,85,94]},
    {id:'claude-opus-4-6', name:'Anthropic claude-opus-4-6', provider:'Anthropic', score:1494, dims:[98,97,98,95,85,94]},
    {id:'muse-spark-1.1', name:'Meta muse-spark-1.1', provider:'Meta', score:1492, dims:[97,96,91,85,85,94]},
    {id:'claude-opus-4-7', name:'Anthropic claude-opus-4-7', provider:'Anthropic', score:1490, dims:[96,98,98,97,85,94]},
    {id:'muse-spark', name:'Meta muse-spark', provider:'Meta', score:1488, dims:[95,90,71,89,85,93]},
    {id:'gemini-3.1-pro-preview', name:'gemini-3.1-pro-preview', provider:'Google', score:1486, dims:[94,86,90,96,85,93]},
    {id:'gemini-3-pro', name:'gemini-3-pro', provider:'Google', score:1484, dims:[94,81,82,98,85,93]},
    {id:'kimi-k3', name:'kimi-k3', provider:'月之暗面', score:1482, dims:[93,94,85,93,85,92]},
    {id:'gpt-5.6-sol-xhigh', name:'gpt-5.6-sol-xhigh', provider:'OpenAI', score:1480, dims:[92,91,95,94,85,92]},
    {id:'gemini-3.6-flash', name:'gemini-3.6-flash', provider:'Google', score:1478, dims:[91,88,90,94,85,92]},
    {id:'claude-opus-4-8-thinking', name:'Anthropic claude-opus-4-8-thinking', provider:'Anthropic', score:1476, dims:[90,95,96,90,85,91]},
    {id:'gpt-5.5-high', name:'gpt-5.5-high', provider:'OpenAI', score:1474, dims:[90,84,94,79,85,91]},
    {id:'gpt-5.4-high', name:'gpt-5.4-high', provider:'OpenAI', score:1472, dims:[89,86,94,70,85,91]},
    {id:'gpt-5.5', name:'gpt-5.5', provider:'OpenAI', score:1470, dims:[88,66,86,78,85,90]},
    {id:'gemini-3.5-flash-high', name:'gemini-3.5-flash-high', provider:'Google', score:1468, dims:[87,65,86,90,85,90]},
    {id:'gpt-5.2-chat-latest-20260210', name:'gpt-5.2-chat-latest-20260210', provider:'OpenAI', score:1466, dims:[86,80,75,62,85,90]},
    {id:'qwen3.7-max-preview', name:'qwen3.7-max-preview', provider:'通义千问', score:1464, dims:[86,90,88,75,85,90]},
    {id:'grok-4.20-beta1', name:'grok-4.20-beta1', provider:'xAI', score:1462, dims:[85,68,60,87,85,89]},
    {id:'gemini-3.5-flash-medium', name:'gemini-3.5-flash-medium', provider:'Google', score:1460, dims:[84,71,70,91,85,89]},
    {id:'claude-opus-4-8', name:'Anthropic claude-opus-4-8', provider:'Anthropic', score:1458, dims:[83,93,93,86,85,89]},
    {id:'gpt-5.5-instant', name:'gpt-5.5-instant', provider:'OpenAI', score:1456, dims:[82,77,60,84,85,88]},
    {id:'grok-4.20-beta-0309-reasoning', name:'grok-4.20-beta-0309-reasoning', provider:'xAI', score:1454, dims:[82,74,60,76,85,88]},
    {id:'gemini-3-flash', name:'gemini-3-flash', provider:'Google', score:1452, dims:[81,69,77,86,85,88]},
    {id:'claude-opus-4-5-20251101-thinking-32k', name:'Anthropic claude-opus-4-5-20251101-thinking-32k', provider:'Anthropic', score:1450, dims:[80,94,84,92,85,88]},
    {id:'claude-sonnet-4-6', name:'Anthropic claude-sonnet-4-6', provider:'Anthropic', score:1448, dims:[79,92,87,82,85,87]},
    {id:'grok-4.20-multi-agent-beta-0309', name:'grok-4.20-multi-agent-beta-0309', provider:'xAI', score:1446, dims:[78,70,61,81,85,87]},
    {id:'glm-5.1', name:'glm-5.1', provider:'智谱AI', score:1444, dims:[78,83,80,82,85,87]},
    {id:'glm-5.2', name:'glm-5.2', provider:'智谱AI', score:1442, dims:[77,70,73,74,85,86]},
    {id:'claude-opus-4-5-20251101', name:'Anthropic claude-opus-4-5-20251101', provider:'Anthropic', score:1440, dims:[76,87,82,88,85,86]},
    {id:'ernie-5.1', name:'ernie-5.1', provider:'百度', score:1438, dims:[75,78,72,60,85,86]},
    {id:'grok-4.5', name:'grok-4.5', provider:'xAI', score:1436, dims:[74,85,78,68,85,85]},
    {id:'mimo-v2.5-pro', name:'mimo-v2.5-pro', provider:'小米 MiMo', score:1434, dims:[74,82,89,63,85,85]},
    {id:'gpt-5.4', name:'gpt-5.4', provider:'OpenAI', score:1432, dims:[73,78,76,64,85,85]},
    {id:'grok-4.1-thinking', name:'grok-4.1-thinking', provider:'xAI', score:1430, dims:[72,60,60,60,85,84]},
    {id:'qwen3.5-max-preview', name:'qwen3.5-max-preview', provider:'通义千问', score:1428, dims:[71,74,79,80,85,84]},
    {id:'claude-sonnet-5-high', name:'Anthropic claude-sonnet-5-high', provider:'Anthropic', score:1426, dims:[70,89,92,60,85,84]},
    {id:'kimi-k2.6', name:'kimi-k2.6', provider:'月之暗面', score:1424, dims:[70,79,83,60,85,84]},
    {id:'qwen3.6-max-preview', name:'qwen3.6-max-preview', provider:'通义千问', score:1422, dims:[69,67,78,65,85,83]},
    {id:'qwen3.7-plus', name:'qwen3.7-plus', provider:'通义千问', score:1420, dims:[68,72,69,67,85,83]},
    {id:'grok-4.1', name:'grok-4.1', provider:'xAI', score:1418, dims:[67,60,60,62,85,83]},
    {id:'gemini-3.5-flash-lite', name:'gemini-3.5-flash-lite', provider:'Google', score:1416, dims:[66,66,67,66,85,82]},
    {id:'gemini-3-flash-thinking-minimal', name:'gemini-3-flash-thinking-minimal', provider:'Google', score:1414, dims:[66,60,60,77,85,82]},
    {id:'glm-5', name:'glm-5', provider:'智谱AI', score:1412, dims:[65,60,68,74,85,82]},
    {id:'deepseek-v4-pro', name:'deepseek-v4-pro', provider:'DeepSeek', score:1410, dims:[64,60,65,70,85,82]},
    {id:'claude-sonnet-4-5-20250929-thinking-32k', name:'Anthropic claude-sonnet-4-5-20250929-thinking-32k', provider:'Anthropic', score:1408, dims:[63,82,81,78,85,81]},
    {id:'dola-seed-2.0-pro', name:'Bytedance dola-seed-2.0-pro', provider:'字节跳动', score:1406, dims:[62,73,60,60,85,81]},
    {id:'deepseek-v4-pro-thinking', name:'deepseek-v4-pro-thinking', provider:'DeepSeek', score:1404, dims:[62,60,60,71,85,81]},
    {id:'claude-sonnet-4-5-20250929', name:'Anthropic claude-sonnet-4-5-20250929', provider:'Anthropic', score:1402, dims:[61,76,70,83,85,80]}
  ],

  /* 代码榜：LMArena Coding（2026-07-24 更新，10名） */
  coding: [
    {id:'claude-opus-4-6-thinking', name:'Anthropic claude-opus-4-6-thinking', provider:'Anthropic', score:1500},
    {id:'claude-fable-5', name:'Anthropic claude-fable-5', provider:'Anthropic', score:1498},
    {id:'claude-opus-4-7', name:'Anthropic claude-opus-4-7', provider:'Anthropic', score:1496},
    {id:'claude-opus-4-6', name:'Anthropic claude-opus-4-6', provider:'Anthropic', score:1494},
    {id:'claude-opus-4-8-thinking', name:'Anthropic claude-opus-4-8-thinking', provider:'Anthropic', score:1492},
    {id:'claude-opus-4-8', name:'Anthropic claude-opus-4-8', provider:'Anthropic', score:1490},
    {id:'gpt-5.6-sol-xhigh', name:'gpt-5.6-sol-xhigh', provider:'OpenAI', score:1488},
    {id:'gpt-5.5-high', name:'gpt-5.5-high', provider:'OpenAI', score:1486},
    {id:'gpt-5.4-high', name:'gpt-5.4-high', provider:'OpenAI', score:1484},
    {id:'claude-opus-4-5-20251101-thinking-32k', name:'Anthropic claude-opus-4-5-20251101-thinking-32k', provider:'Anthropic', score:1482}
  ],

  /* 英文榜：LMArena English（2026-07-24 更新，10名） */
  english: [
    {id:'claude-fable-5', name:'Anthropic claude-fable-5', provider:'Anthropic', score:1500},
    {id:'claude-opus-4-6-thinking', name:'Anthropic claude-opus-4-6-thinking', provider:'Anthropic', score:1498},
    {id:'claude-opus-4-6', name:'Anthropic claude-opus-4-6', provider:'Anthropic', score:1496},
    {id:'claude-opus-4-7-thinking', name:'Anthropic claude-opus-4-7-thinking', provider:'Anthropic', score:1494},
    {id:'claude-opus-4-7', name:'Anthropic claude-opus-4-7', provider:'Anthropic', score:1492},
    {id:'muse-spark-1.1', name:'Meta muse-spark-1.1', provider:'Meta', score:1490},
    {id:'claude-opus-4-8-thinking', name:'Anthropic claude-opus-4-8-thinking', provider:'Anthropic', score:1488},
    {id:'gemini-3.1-pro-preview', name:'gemini-3.1-pro-preview', provider:'Google', score:1486},
    {id:'gpt-5.6-sol-xhigh', name:'gpt-5.6-sol-xhigh', provider:'OpenAI', score:1484},
    {id:'kimi-k3', name:'kimi-k3', provider:'月之暗面', score:1482}
  ],

  /* 困难提示榜：LMArena Hard Prompts（2026-07-24 更新，10名） */
  hard: [
    {id:'claude-fable-5', name:'Anthropic claude-fable-5', provider:'Anthropic', score:1500},
    {id:'claude-opus-4-7-thinking', name:'Anthropic claude-opus-4-7-thinking', provider:'Anthropic', score:1498},
    {id:'claude-opus-4-6-thinking', name:'Anthropic claude-opus-4-6-thinking', provider:'Anthropic', score:1496},
    {id:'claude-opus-4-7', name:'Anthropic claude-opus-4-7', provider:'Anthropic', score:1494},
    {id:'claude-opus-4-6', name:'Anthropic claude-opus-4-6', provider:'Anthropic', score:1492},
    {id:'muse-spark-1.1', name:'Meta muse-spark-1.1', provider:'Meta', score:1490},
    {id:'claude-opus-4-8-thinking', name:'Anthropic claude-opus-4-8-thinking', provider:'Anthropic', score:1488},
    {id:'kimi-k3', name:'kimi-k3', provider:'月之暗面', score:1486},
    {id:'claude-opus-4-5-20251101-thinking-32k', name:'Anthropic claude-opus-4-5-20251101-thinking-32k', provider:'Anthropic', score:1484},
    {id:'claude-sonnet-4-6', name:'Anthropic claude-sonnet-4-6', provider:'Anthropic', score:1482}
  ],

  /* 中文榜：LMArena Chinese（2026-07-24 更新，10名） */
  chinese: [
    {id:'claude-fable-5', name:'Anthropic claude-fable-5', provider:'Anthropic', score:1500},
    {id:'gemini-3.6-flash', name:'gemini-3.6-flash', provider:'Google', score:1498},
    {id:'claude-opus-4-6-thinking', name:'Anthropic claude-opus-4-6-thinking', provider:'Anthropic', score:1496},
    {id:'gemini-3.5-flash-high', name:'gemini-3.5-flash-high', provider:'Google', score:1494},
    {id:'claude-opus-4-7-thinking', name:'Anthropic claude-opus-4-7-thinking', provider:'Anthropic', score:1492},
    {id:'claude-opus-4-6', name:'Anthropic claude-opus-4-6', provider:'Anthropic', score:1490},
    {id:'grok-4.5', name:'grok-4.5', provider:'xAI', score:1488},
    {id:'gpt-5.5', name:'gpt-5.5', provider:'OpenAI', score:1486},
    {id:'claude-opus-4-8-thinking', name:'Anthropic claude-opus-4-8-thinking', provider:'Anthropic', score:1484},
    {id:'gpt-5.4-high', name:'gpt-5.4-high', provider:'OpenAI', score:1482}
  ],

  /* 多轮对话榜：LMArena Multi-Turn（2026-07-24 更新，10名） */
  multiturn: [
    {id:'claude-fable-5', name:'Anthropic claude-fable-5', provider:'Anthropic', score:1500},
    {id:'claude-opus-4-6-thinking', name:'Anthropic claude-opus-4-6-thinking', provider:'Anthropic', score:1498},
    {id:'claude-opus-4-7-thinking', name:'Anthropic claude-opus-4-7-thinking', provider:'Anthropic', score:1496},
    {id:'gemini-3-pro', name:'gemini-3-pro', provider:'Google', score:1494},
    {id:'claude-opus-4-7', name:'Anthropic claude-opus-4-7', provider:'Anthropic', score:1492},
    {id:'gemini-3.1-pro-preview', name:'gemini-3.1-pro-preview', provider:'Google', score:1490},
    {id:'claude-opus-4-6', name:'Anthropic claude-opus-4-6', provider:'Anthropic', score:1488},
    {id:'gemini-3.5-flash-high', name:'gemini-3.5-flash-high', provider:'Google', score:1486},
    {id:'gpt-5.6-sol-xhigh', name:'gpt-5.6-sol-xhigh', provider:'OpenAI', score:1484},
    {id:'kimi-k3', name:'kimi-k3', provider:'月之暗面', score:1482}
  ],

  /* 创意写作榜：LMArena Creative Writing（2026-07-24 更新，10名） */
  creative: [
    {id:'claude-fable-5', name:'Anthropic claude-fable-5', provider:'Anthropic', score:1500},
    {id:'claude-opus-4-6-thinking', name:'Anthropic claude-opus-4-6-thinking', provider:'Anthropic', score:1498},
    {id:'claude-opus-4-7-thinking', name:'Anthropic claude-opus-4-7-thinking', provider:'Anthropic', score:1496},
    {id:'claude-opus-4-6', name:'Anthropic claude-opus-4-6', provider:'Anthropic', score:1494},
    {id:'claude-opus-4-8-thinking', name:'Anthropic claude-opus-4-8-thinking', provider:'Anthropic', score:1492},
    {id:'claude-opus-4-7', name:'Anthropic claude-opus-4-7', provider:'Anthropic', score:1490},
    {id:'gpt-5.6-sol-xhigh', name:'gpt-5.6-sol-xhigh', provider:'OpenAI', score:1488},
    {id:'claude-opus-4-5-20251101-thinking-32k', name:'Anthropic claude-opus-4-5-20251101-thinking-32k', provider:'Anthropic', score:1486},
    {id:'gemini-3.1-pro-preview', name:'gemini-3.1-pro-preview', provider:'Google', score:1484},
    {id:'gemini-3.6-flash', name:'gemini-3.6-flash', provider:'Google', score:1482}
  ],

  /* 数学榜：LMArena Math（2026-07-24 更新，10名） */
  math: [
    {id:'claude-opus-4-6-thinking', name:'Anthropic claude-opus-4-6-thinking', provider:'Anthropic', score:1500},
    {id:'claude-fable-5', name:'Anthropic claude-fable-5', provider:'Anthropic', score:1498},
    {id:'claude-opus-4-6', name:'Anthropic claude-opus-4-6', provider:'Anthropic', score:1496},
    {id:'claude-opus-4-7-thinking', name:'Anthropic claude-opus-4-7-thinking', provider:'Anthropic', score:1494},
    {id:'claude-opus-4-7', name:'Anthropic claude-opus-4-7', provider:'Anthropic', score:1492},
    {id:'claude-opus-4-8-thinking', name:'Anthropic claude-opus-4-8-thinking', provider:'Anthropic', score:1490},
    {id:'kimi-k3', name:'kimi-k3', provider:'月之暗面', score:1488},
    {id:'claude-sonnet-4-6', name:'Anthropic claude-sonnet-4-6', provider:'Anthropic', score:1486},
    {id:'gemini-3.1-pro-preview', name:'gemini-3.1-pro-preview', provider:'Google', score:1484},
    {id:'qwen3.7-max-preview', name:'qwen3.7-max-preview', provider:'通义千问', score:1482}
  ],

  /* 指令遵循榜：LMArena Instruction Following（2026-07-24 更新，10名） */
  instruct: [
    {id:'claude-fable-5', name:'Anthropic claude-fable-5', provider:'Anthropic', score:1500},
    {id:'claude-opus-4-6-thinking', name:'Anthropic claude-opus-4-6-thinking', provider:'Anthropic', score:1498},
    {id:'claude-opus-4-7-thinking', name:'Anthropic claude-opus-4-7-thinking', provider:'Anthropic', score:1496},
    {id:'claude-opus-4-6', name:'Anthropic claude-opus-4-6', provider:'Anthropic', score:1494},
    {id:'muse-spark-1.1', name:'Meta muse-spark-1.1', provider:'Meta', score:1492},
    {id:'claude-opus-4-7', name:'Anthropic claude-opus-4-7', provider:'Anthropic', score:1490},
    {id:'muse-spark', name:'Meta muse-spark', provider:'Meta', score:1488},
    {id:'gemini-3.1-pro-preview', name:'gemini-3.1-pro-preview', provider:'Google', score:1486},
    {id:'gemini-3-pro', name:'gemini-3-pro', provider:'Google', score:1484},
    {id:'kimi-k3', name:'kimi-k3', provider:'月之暗面', score:1482}
  ],

  /* 日语榜：LMArena Japanese（2026-07-24 更新，10名） */
  japanese: [
    {id:'gpt-5.5-high', name:'gpt-5.5-high', provider:'OpenAI', score:1500},
    {id:'gpt-5.4-high', name:'gpt-5.4-high', provider:'OpenAI', score:1498},
    {id:'gpt-5.5', name:'gpt-5.5', provider:'OpenAI', score:1496},
    {id:'gemini-3.5-flash-high', name:'gemini-3.5-flash-high', provider:'Google', score:1494},
    {id:'claude-fable-5', name:'Anthropic claude-fable-5', provider:'Anthropic', score:1492},
    {id:'claude-opus-4-8-thinking', name:'Anthropic claude-opus-4-8-thinking', provider:'Anthropic', score:1490},
    {id:'claude-opus-4-7-thinking', name:'Anthropic claude-opus-4-7-thinking', provider:'Anthropic', score:1488},
    {id:'claude-opus-4-7', name:'Anthropic claude-opus-4-7', provider:'Anthropic', score:1486},
    {id:'claude-opus-4-6', name:'Anthropic claude-opus-4-6', provider:'Anthropic', score:1484},
    {id:'claude-opus-4-6-thinking', name:'Anthropic claude-opus-4-6-thinking', provider:'Anthropic', score:1482}
  ],

  /* 韩语榜：LMArena Korean（2026-07-24 更新，10名） */
  korean: [
    {id:'gpt-5.5-high', name:'gpt-5.5-high', provider:'OpenAI', score:1500},
    {id:'gpt-5.4-high', name:'gpt-5.4-high', provider:'OpenAI', score:1498},
    {id:'gpt-5.5', name:'gpt-5.5', provider:'OpenAI', score:1496},
    {id:'gemini-3.5-flash-high', name:'gemini-3.5-flash-high', provider:'Google', score:1494},
    {id:'claude-fable-5', name:'Anthropic claude-fable-5', provider:'Anthropic', score:1492},
    {id:'claude-opus-4-6-thinking', name:'Anthropic claude-opus-4-6-thinking', provider:'Anthropic', score:1490},
    {id:'claude-opus-4-8-thinking', name:'Anthropic claude-opus-4-8-thinking', provider:'Anthropic', score:1488},
    {id:'claude-opus-4-7-thinking', name:'Anthropic claude-opus-4-7-thinking', provider:'Anthropic', score:1486},
    {id:'claude-opus-4-7', name:'Anthropic claude-opus-4-7', provider:'Anthropic', score:1484},
    {id:'claude-opus-4-6', name:'Anthropic claude-opus-4-6', provider:'Anthropic', score:1482}
  ],

  /* 维度标签（六维雷达图用） */
  axes: ['综合','推理','代码','长文本','多模态','速度'],

  /* 更新日期 */
  updated: '2026-07-24',
};