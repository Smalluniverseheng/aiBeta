/* ==================== SKILLS · 技能库 ====================
 * Prompt 技能模板管理：
 * - BUILTIN_SKILLS：内置三工具（润色/摘要/代码解释），id 与 toolsEnabled 键一致，
 *   enabled 与 Store.state.toolsEnabled 双向同步，保证发现页旧开关行为零变化
 * - SKILL_LIBRARY：可一键添加的技能模板库
 * - custom：用户自建技能（存 Store.state.skills.custom）
 * 启用的技能会同步出现在发现页工具区。
 */
const Skills = (() => {

  /* 内置技能（name/desc/icon 与发现页工具一致，promptTemplate 即原 TOOLS 的 sys） */
  const BUILTIN_SKILLS = [
    {
      id: 'polish', name: '文本润色', icon: 'wand', desc: '病句修改 · 表达升级', btn: '开始润色', ph: '粘贴需要润色的文字…',
      promptTemplate: '你是一位文字润色专家。1）在保留原意与个人风格的前提下修改病句、优化表达；2）先给出润色后的全文；3）再用列表说明每处重要修改的理由。不要过度改写。'
    },
    {
      id: 'summary', name: '文章摘要', icon: 'fileText', desc: '长文提炼 · 要点罗列', btn: '生成摘要', ph: '粘贴长文（文章/报告/论文…）…',
      promptTemplate: '你是一位摘要专家。输出格式：1）「一句话总结」；2）「核心要点」3-7 条（每条一行，附关键数据）；3）「值得注意的细节」（可选）。忠实原文，不添加原文没有的观点。'
    },
    {
      id: 'codeExplain', name: '代码解释', icon: 'code', desc: '逐行讲解 · 原理分析', btn: '开始解释', ph: '粘贴代码片段…',
      promptTemplate: '你是一位代码讲解专家。1）先用一两句话概括这段代码的作用；2）分块逐行讲解关键逻辑；3）指出潜在问题与优化建议；4）涉及的概念简要科普。使用 Markdown 排版。'
    }
  ];

  /* 技能模板库（点击「添加」加入我的技能并出现在发现页） */
  const SKILL_LIBRARY = [
    {
      id: 'lib-paper', name: '论文阅读助手', icon: 'graduation', desc: '论文拆解 · 方法结论速览',
      promptTemplate: '你是论文阅读助手。用户粘贴论文段落或摘要后，输出：1）「研究问题」一句话；2）「方法与数据」要点列表；3）「核心结论」3 条以内；4）「局限与可复现性」简评；5）「延伸阅读关键词」5 个。术语首次出现附中文解释，不臆造原文没有的内容。'
    },
    {
      id: 'lib-resume', name: '简历优化师', icon: 'briefcase', desc: '逐段改写 · 量化成果',
      promptTemplate: '你是资深简历优化师。根据用户粘贴的简历与目标岗位，输出：1）「总体评价」两句以内；2）「逐段改写」按模块给出修改前后对照；3）「量化建议」把职责改写为含数据的成果；4）「关键词匹配」列出岗位 JD 高频词。语气专业直接，突出竞争力。'
    },
    {
      id: 'lib-email', name: '邮件撰写', icon: 'edit', desc: '商务邮件 · 语气可控',
      promptTemplate: '你是商务邮件撰写专家。根据用户给出的场景、对象与目的，输出：1）「主题行」2 个备选；2）「正文」称呼-背景-诉求-行动四段式，语气可选正式/友好；3）「发送前检查」3 条提示。篇幅不超过 300 字，重点前置，礼貌且边界清晰。'
    },
    {
      id: 'lib-xhs', name: '小红书文案', icon: 'heart', desc: '种草文案 · 标题标签',
      promptTemplate: '你是小红书爆款文案策划。根据主题输出：1）「标题」3 个（含 emoji 与数字钩子，20 字内）；2）「正文」口语化分段，埋 3-5 个互动点；3）「话题标签」8-10 个；4）「首图建议」一句话。风格真实种草感，避免硬广腔。'
    },
    {
      id: 'lib-sql', name: 'SQL 生成器', icon: 'database', desc: '需求转 SQL · 逐行解释',
      promptTemplate: '你是 SQL 生成专家。根据用户描述的表结构与查询需求，输出：1）「建表假设」推断的表结构；2）「SQL 语句」代码块，兼容 MySQL；3）「逐行解释」关键子句；4）「优化建议」索引提示。需求不清时先列 2 个澄清问题。'
    },
    {
      id: 'lib-regex', name: '正则生成器', icon: 'terminal', desc: '正则编写 · 用例验证',
      promptTemplate: '你是正则表达式专家。根据匹配需求与样例文本，输出：1）「正则表达式」代码块并标注 flavor（JS/Python）；2）「逐段拆解」各 token 含义；3）「测试用例」3 正 3 反；4）「常见陷阱」提示。优先可读性高的写法。'
    },
    {
      id: 'lib-bugreport', name: 'Bug 报告生成', icon: 'flask', desc: '口头描述转标准报告',
      promptTemplate: '你是 QA 工程师。把用户描述的异常整理为标准 Bug 报告：1）「标题」一句话概括；2）「环境」版本/设备占位；3）「复现步骤」编号列表；4）「预期 vs 实际」对照；5）「严重级别」P0-P3 及理由。信息不足标【待补充】。'
    },
    {
      id: 'lib-minutes', name: '会议纪要整理', icon: 'users', desc: '散乱记录转决议行动项',
      promptTemplate: '你是会议纪要整理专家。把用户粘贴的散乱记录整理为：1）「会议主题与时间」；2）「决议事项」编号列表，每条含负责人与截止时间（未提及标【待定】）；3）「讨论要点」按议题分组；4）「行动项清单」表格。客观中立，不添加未出现的结论。'
    },
    {
      id: 'lib-prd', name: '产品 PRD 生成', icon: 'file', desc: '一句话需求转 PRD',
      promptTemplate: '你是资深产品经理。根据一句话需求输出精简 PRD：1）「背景与目标」；2）「用户故事」3 条；3）「功能清单」P0/P1 分级表格；4）「验收标准」Given/When/Then；5）「风险与依赖」。务实克制，拒绝功能堆砌。'
    },
    {
      id: 'lib-interview', name: '面试模拟', icon: 'messages', desc: '岗位模拟面试 · 逐轮点评',
      promptTemplate: '你是面试官。按目标岗位进行模拟面试：先给第一个问题；每轮根据回答给「点评」（亮点/不足/建议）再追问下一题；覆盖专业、项目、行为三类问题；结束时输出「综合评估」与「准备清单」。由浅入深，点评具体可操作。'
    },
    {
      id: 'lib-brainstorm', name: '头脑风暴', icon: 'lightbulb', desc: '多视角发散 · 可行性速评',
      promptTemplate: '你是头脑风暴引导师。围绕用户主题输出：1）「常规思路」5 条；2）「反向思考」3 条（从对立面切入）；3）「跨界联想」3 条（借用其他行业做法）；4）「可行性速评」给每个方向标 ★；5）「下一步建议」2 条。追求数量与多样性，不急于评判。'
    },
    {
      id: 'lib-recipe', name: '菜谱生成', icon: 'book', desc: '食材转菜谱 · 失败预警',
      promptTemplate: '你是家常菜主厨。根据食材或想吃的菜，输出：1）「菜品信息」份量/时长/难度；2）「食材清单」含用量；3）「步骤」编号列表并标关键点；4）「失败预警」2-3 条；5）「替换建议」。家常可操作，避免专业设备。'
    },
    {
      id: 'lib-travel', name: '旅行规划', icon: 'compass', desc: '分日行程 · 预算贴士',
      promptTemplate: '你是旅行规划师。按目的地、天数与偏好输出：1）「行程总览」按天分块；2）「每日路线」景点+交通+用餐，动线顺路；3）「预算表」分项估算；4）「实用贴士」预约/避坑；5）「备选方案」。节奏松紧适度，不排特种兵行程。'
    },
    {
      id: 'lib-codereview', name: '代码审查', icon: 'scale', desc: '问题分级 · 重构示例',
      promptTemplate: '你是严格的代码审查员。审查用户代码，输出：1）「总体评价」两句以内；2）「问题清单」按严重度分级（阻塞/建议/可选），含原因与改法；3）「重构示例」前后对照；4）「优点」。关注正确性、安全与可维护性。'
    },
    {
      id: 'lib-ppt', name: 'PPT 大纲生成', icon: 'layers', desc: '逐页大纲 · 演讲备注',
      promptTemplate: '你是演示文稿策划专家。按主题与受众输出 PPT 大纲：1）「标题页」主副标题；2）「目录」3-5 章；3）「逐页大纲」标题+3-5 要点+视觉建议；4）「演讲备注」开场结尾话术；5）「时长分配」。金字塔原理，结论先行。'
    }
  ];

  /* ---- 存储 ---- */
  function ensure() {
    const st = Store.state;
    if (!st.skills || typeof st.skills !== 'object') st.skills = { enabled: ['polish', 'summary', 'codeExplain'], custom: [] };
    if (!Array.isArray(st.skills.enabled)) st.skills.enabled = ['polish', 'summary', 'codeExplain'];
    if (!Array.isArray(st.skills.custom)) st.skills.custom = [];
    return st.skills;
  }

  /* 内置技能常驻 enabled 列表（它们同时挂在 toolsEnabled 上，active 状态实时读取） */
  function reconcile() {
    const s = ensure();
    BUILTIN_SKILLS.forEach(b => { if (s.enabled.indexOf(b.id) < 0) s.enabled.push(b.id); });
  }

  /* 启用状态：内置技能读 toolsEnabled（与旧开关双向同步），库/自定义技能读 enabled 成员关系 */
  function isEnabled(id) {
    if (BUILTIN_SKILLS.some(b => b.id === id)) return (Store.state.toolsEnabled || {})[id] !== false;
    return ensure().enabled.indexOf(id) >= 0;
  }

  function find(id) {
    const b = BUILTIN_SKILLS.find(x => x.id === id);
    if (b) return Object.assign({ builtin: true }, b);
    const lib = SKILL_LIBRARY.find(x => x.id === id);
    if (lib) return Object.assign({ fromLibrary: true, btn: '开始生成', ph: '输入内容…' }, lib);
    const c = ensure().custom.find(x => x.id === id);
    if (c) return Object.assign({ custom: true, icon: 'sparkles', btn: '开始生成', ph: '输入内容…' }, c);
    return null;
  }

  function get(id) { return find(id); }

  function listEnabled() {
    reconcile();
    return ensure().enabled.map(id => {
      const s = find(id);
      if (!s) return null;
      s.active = isEnabled(id);
      return s;
    }).filter(Boolean);
  }

  function listLibrary() { return SKILL_LIBRARY.slice(); }

  /* 开关：内置技能写 toolsEnabled（旧逻辑零改动），库/自定义技能改 enabled 成员关系 */
  function toggle(id, on) {
    const s = ensure();
    if (BUILTIN_SKILLS.some(b => b.id === id)) {
      Store.state.toolsEnabled = Store.state.toolsEnabled || {};
      Store.state.toolsEnabled[id] = !!on;
      if (s.enabled.indexOf(id) < 0) s.enabled.push(id);
    } else {
      const idx = s.enabled.indexOf(id);
      if (on && idx < 0) s.enabled.push(id);
      if (!on && idx >= 0) s.enabled.splice(idx, 1);
    }
    Store.save();
  }

  function addFromLibrary(libId) {
    const lib = SKILL_LIBRARY.find(x => x.id === libId);
    if (!lib) return null;
    if (!isEnabled(libId)) {
      ensure().enabled.push(libId);
      Store.save();
    }
    return find(libId);
  }

  function addCustom(opt) {
    const id = 'custom-' + Date.now();
    const item = {
      id,
      name: (opt.name || '').trim(),
      desc: (opt.desc || '').trim() || '自定义技能',
      promptTemplate: (opt.promptTemplate || '').trim(),
      custom: true
    };
    ensure().custom.push(item);
    ensure().enabled.push(id);
    Store.save();
    return find(id);
  }

  function removeCustom(id) {
    const s = ensure();
    s.custom = s.custom.filter(x => x.id !== id);
    s.enabled = s.enabled.filter(x => x !== id);
    Store.save();
  }

  function getPrompt(id) {
    const s = find(id);
    return s ? s.promptTemplate : null;
  }

  return { BUILTIN_SKILLS, SKILL_LIBRARY, listEnabled, listLibrary, get, isEnabled, toggle, addFromLibrary, addCustom, removeCustom, getPrompt };
})();
