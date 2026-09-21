export default async function ({ pptx, research }) {
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Aha';
  pptx.subject = research.question;
  pptx.title = '降噪耳机：飞机轰鸣变轻了，为什么人声还在？';
  pptx.company = '科普说明';
  pptx.lang = 'zh-CN';
  pptx.theme = {
    headFontFace: 'Microsoft YaHei',
    bodyFontFace: 'Microsoft YaHei',
    lang: 'zh-CN',
  };

  // 内容设计：面向无声学背景的成人，以局部叠加→时间容差→残余语音建立解释。
  // 全部核心内容用原生文字、形状、连接线和表格；不使用外部图片或测量曲线。
  // 深墨色、暖白和青绿色分别承担背景、正文与控制声身份；橙色标记残余及条件。
  // 本轮仅写源文件，字体可用性、排版和实际编辑体验均留待获批后的宿主审阅。
  const C = {
    ink: '172D33', paper: 'F7F5EF', white: 'FFFFFF', muted: '49616A',
    teal: '006D77', mint: 'DDEFEA', orange: '9C440F', sand: 'F5E5D3',
    border: 'BBCAC9',
  };
  const source = {
    mechanism: '来源：RWTH IKS「主动噪声控制」；Hilgemann 等，原作者稿 §2.1–2.2。',
    timing: '来源：冻结材料中的单频解析推论；RWTH IKS 的路径与延迟讨论。',
    passive: '来源：Hilgemann 等，原作者稿 §2.1、§2.3。',
    speech: '来源：Sony WH-1000XM5 使用指南；RWTH IKS「自身语音闭塞效应」。',
    real: '来源：Apple 聆听模式说明；Sony 使用指南；Hilgemann 等 §2.2、§6.3。',
  };
  function text(slide, value, x, y, w, h, size = 21, options = {}) {
    slide.addText(value, {
      x, y, w, h, fontFace: 'Microsoft YaHei', fontSize: size,
      color: C.ink, margin: 0, breakLine: false, valign: 'mid',
      lang: 'zh-CN', ...options,
    });
  }
  function box(slide, x, y, w, h, fill, line = fill) {
    slide.addShape('rect', {
      x, y, w, h, fill: { color: fill }, line: { color: line, width: 1 },
    });
  }
  function arrow(slide, x1, y1, x2, y2, color = C.teal, dashed = false) {
    slide.addShape('line', {
      x: Math.min(x1, x2), y: Math.min(y1, y2),
      w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
      flipH: x2 < x1, flipV: y2 < y1,
      line: { color, width: 2.2, beginArrowType: 'none', endArrowType: 'triangle',
        ...(dashed ? { dashType: 'dash' } : {}) },
    });
  }
  function page(n, title, citation, dark = false) {
    const s = pptx.addSlide();
    s.background = { color: dark ? C.ink : C.paper };
    text(s, '听懂降噪耳机', 0.65, 0.25, 10.7, 0.25, 11,
      { color: dark ? 'B9D3D1' : C.muted, charSpacing: 1.1 });
    if (title) text(s, title, 0.65, 0.77, 12.05, 0.64, 29,
      { bold: true, color: dark ? C.white : C.ink });
    text(s, citation, 0.65, 7.04, 11.5, 0.25, 10.5,
      { color: dark ? 'B9D3D1' : C.muted });
    text(s, String(n).padStart(2, '0'), 12.13, 7.02, 0.55, 0.28, 12,
      { align: 'right', color: dark ? 'B9D3D1' : C.muted });
    return s;
  }
  function note(slide, paragraphs) {
    slide.addNotes(paragraphs.join('\n\n'));
  }

  // 第1页：先解答体验反差；两个并列结果不是定量衰减图，备注解释“仍可听”。
  {
    const s = page(1, '', source.speech, true);
    text(s, '降噪耳机：飞机轰鸣变轻了，\n为什么人声还在？',
      0.65, 1.0, 12, 1.4, 34, { color: C.white, bold: true });
    text(s, '主动降噪不是声音分类器。\n它控制耳边的声压；不同声音成分，留下的残余不同。',
      0.65, 2.7, 11.8, 0.94, 24, { color: C.white });
    box(s, 0.65, 4.12, 5.75, 1.4, C.mint);
    box(s, 6.7, 4.12, 5.98, 1.4, C.sand);
    text(s, '飞机的持续轰鸣', 0.9, 4.32, 5.2, 0.35, 23, { bold: true });
    text(s, '低频成分通常较易控制 → 变轻', 0.9, 4.91, 5.2, 0.34, 19);
    text(s, '附近的人声', 6.95, 4.32, 5.45, 0.35, 23, { bold: true });
    text(s, '部分成分仍然残留 → 仍可听见', 6.95, 4.91, 5.45, 0.34, 19);
    text(s, '仍听得见 ≠ 完全没减弱，也不代表人声天生不能抵消。',
      0.65, 6.0, 11.9, 0.57, 23, { color: C.white, bold: true });
    note(s, [
      '开场先问：戴上降噪耳机后，发动机声音小了，旁边的人却还在说话，这是否说明耳机在识别人声并放行？答案是否定的。主动降噪的物理对象是声压，不是语义标签。',
      '这里用的是材料支持的常见体验与有限推论，而不是本轮测试。Sony 的概括针对其列出的产品，不能推广为所有耳机的统一性能。后面先解释什么叫抵消，再解释为什么残余不一样。',
      '本页两个区域只比较解释路径，没有用面积或长度编码衰减量。冻结材料没有个人场景的分贝或语音可懂度数据。',
    ]);
  }

  // 第2页：让两条声学路径在同一目标处会合，虚线仅表示电信号处理。
  {
    const s = page(2, '抵消发生在耳边，不在声音标签里', source.mechanism);
    text(s, '声压就是空气压力的起伏；同一位置、同一时刻的起伏会叠加。',
      0.65, 1.62, 12, 0.55, 22);
    box(s, 0.75, 2.65, 2.55, 0.87, C.sand);
    text(s, '传入噪声', 0.95, 2.83, 2.15, 0.43, 23, { bold: true });
    text(s, '经过耳罩／耳道的路径', 3.62, 2.45, 4.55, 0.35, 17);
    arrow(s, 3.4, 3.09, 8.48, 3.09, C.orange);
    box(s, 0.75, 4.05, 2.55, 0.9, C.white, C.border);
    text(s, '麦克风信号', 0.95, 4.25, 2.15, 0.43, 21);
    box(s, 4.0, 4.05, 3.5, 0.9, C.mint);
    text(s, '控制器 → 扬声器', 4.22, 4.25, 3.06, 0.43, 21, { bold: true });
    arrow(s, 3.38, 4.5, 3.88, 4.5, C.muted, true);
    text(s, '处理', 3.35, 4.94, 0.66, 0.3, 12, { color: C.muted });
    arrow(s, 7.58, 4.5, 8.66, 4.5);
    text(s, '控制声也经过声学路径', 4.03, 5.07, 4.8, 0.32, 16, { color: C.teal });
    box(s, 8.8, 2.65, 3.77, 2.3, C.ink);
    text(s, '耳边目标位置', 9.04, 2.9, 3.29, 0.45, 24,
      { color: C.white, bold: true });
    text(s, '传入声压 ＋ 控制声压\n＝ 剩下的声压起伏', 9.04, 3.63, 3.29, 0.91, 20,
      { color: C.white });
    text(s, '理想单频：在耳边同频、等幅、反相，才可完全抵消。\n“反相”：噪声使压力增加时，控制声恰好使它等量减少。',
      0.65, 5.55, 12, 0.78, 22, { bold: true });
    text(s, '小信号线性近似；麦克风处有效，不代表耳内每一点或整个机舱都安静。',
      0.65, 6.49, 12, 0.36, 17, { color: C.muted });
    note(s, [
      '沿橙色箭头讲噪声到耳边的路径，再沿青色箭头讲扬声器声音到耳边的路径。实线表示声传播，虚线表示麦克风信号的处理。图不是某一产品的硬件布置或完整控制框图。',
      '反相可理解为：噪声使压力增加时，控制声恰好使压力减少，幅度也匹配，才能在该位置相互抵消。仅把外部麦克风电信号的正负翻转并不够，因为两条声学路径会改变幅度与相位。',
      '前馈使用外部参考信号，反馈使用内部误差信号，混合结构可以结合两者。本页不展开这三类结构，以免掩盖共同的局部叠加原理。',
      'Hilgemann 等 §2.1–2.2 的内部麦克风与鼓膜近似有低频条件；不要把一个传声器的读数直接当成所有位置的静音。过渡：即使幅度匹配，时间没对上也会留下声音。',
    ]);
  }

  // 第3页：原生表格承载材料中已有的假设值，不把计算例子画成产品性能。
  {
    const s = page(3, '振动越快，同样的时间误差越难容忍', source.timing);
    text(s, '相位：一次振动进行到哪里。\n同样晚到一点，在更快的振动中会错开更大一段。',
      0.65, 1.63, 12, 0.98, 23);
    box(s, 0.65, 2.93, 12.03, 0.61, C.sand);
    text(s, '教学假设：未补偿的到达时间误差为 0.10 毫秒（不是实测耳机延迟）',
      0.85, 3.08, 11.65, 0.29, 18, { color: C.orange, bold: true });
    s.addTable([
      [
        { text: '声音分量', options: { bold: true, color: C.white, fill: C.ink } },
        { text: '每秒振动次数', options: { bold: true, color: C.white, fill: C.ink } },
        { text: '错开的相位角', options: { bold: true, color: C.white, fill: C.ink } },
      ],
      ['100 赫兹', '100 次', '3.6°'],
      ['1000 赫兹', '1000 次', '36°'],
    ], {
      x: 0.65, y: 3.74, w: 12.03, colW: [4.01, 4.01, 4.01],
      rowH: 0.63, fontFace: 'Microsoft YaHei', fontSize: 21, color: C.ink,
      fill: C.white, border: { type: 'solid', color: C.border, pt: 1 },
      margin: 10, valign: 'middle', autoPage: false,
    });
    text(s, '等幅还不够：错相会留下残余，严重时甚至可能比原噪声更大。',
      0.65, 5.94, 12, 0.42, 21, { bold: true });
    text(s, '这是同一位置、稳态单频的线性模型；不是声速变快，也没有给 ANC 划定统一截止频率。',
      0.65, 6.49, 12, 0.3, 15.5, { color: C.muted });
    note(s, [
      '先解释赫兹就是每秒振动次数，再解释角度表示在一个周期中错开多少。这里比较的不是两款耳机，而是完全相同的假设时间误差作用于两个不同频率。',
      '数字来自冻结材料对正弦周期定义的解析推导：相位误差等于 360° 乘以频率，再乘以时间误差的秒数。0.10 毫秒等于 0.00010 秒，由此得到 3.6° 和 36°。这是教学计算，不是声学测试。',
      '这个模型只说明时间容差如何收紧。前馈还取决于参考麦克风的提前量与传播路径，反馈还要保持稳定。规律信号可预测；复杂信号在参考信息、带宽和路径合适时也可能受控，因此不能说变化快就绝对无法降噪。',
      '没有把解析残余公式扩展成衰减曲线，因为这不是完整宽带控制器，更不能预测用户的耳机效果。过渡：耳机减噪也不全靠主动控制。',
    ]);
  }

  // 第4页：比较两种作用方式，用真实表格保留可编辑的行列关系。
  {
    const s = page(4, '耳机有两种减噪方式，不是一个开关', source.passive);
    text(s, '被动隔音改变声音传入的路径；主动降噪再加入控制声。两者共同影响残余。',
      0.65, 1.62, 12, 0.8, 22);
    s.addTable([
      [
        { text: '比较', options: { bold: true, fill: C.ink, color: C.white } },
        { text: '被动隔音', options: { bold: true, fill: C.ink, color: C.white } },
        { text: '主动降噪（ANC）', options: { bold: true, fill: C.ink, color: C.white } },
      ],
      ['怎么做', '耳塞、耳罩和密封\n阻碍声音传入', '扬声器加入控制声压\n力求在耳边抵消'],
      ['通常擅长', '较高频率的衰减', '低到中频的控制'],
      ['关掉 ANC 后', '物理屏障仍在', '不再靠主动控制减噪'],
    ], {
      x: 0.65, y: 2.6, w: 12.03, colW: [2.08, 4.97, 4.98],
      rowH: 0.76, fontFace: 'Microsoft YaHei', fontSize: 20, color: C.ink,
      fill: C.white, border: { type: 'solid', color: C.border, pt: 1 },
      margin: 11, valign: 'middle', autoPage: false,
    });
    text(s, '关 ANC ≠ 摘下耳机', 0.65, 6.25, 6.3, 0.52, 29,
      { bold: true, color: C.teal });
    text(s, '“通常”不是硬分界；结构、泄漏和佩戴都会改变结果。',
      7.15, 6.17, 5.5, 0.66, 18, { color: C.muted });
    note(s, [
      '不要把被动与主动理解成两道完全独立、互不影响的墙。它们共同决定传入与控制声学路径，以及耳边最终留下的声音。',
      '强调“通常”：这些是实现相关的频率倾向，不是某条频率以下只能主动、以上只能被动的定律。',
      '若比较 ANC 开关，应保持相同声源和佩戴。关闭 ANC 时耳罩仍在，因此这个比较与摘下耳机相比不是同一个基准。这个方法建议来自冻结材料的路径与模式证据，不是本轮实际实施的实验。',
      '过渡：把这两种方式合起来看，就能解释为什么一段语音可能变弱，却仍然听得出来有人在说话。',
    ]);
  }

  // 第5页：分支表达“同一语音有不同残余”，不画虚构频谱或等比例衰减柱。
  {
    const s = page(5, '人声可以变弱，却仍然听得见', source.speech);
    text(s, '一段语音不是一个高频纯音。不同频率成分经过耳机后，削弱程度可能不同。',
      0.65, 1.61, 12, 0.85, 23);
    box(s, 0.65, 3.22, 2.45, 1.05, C.ink);
    text(s, '同一段语音', 0.83, 3.55, 2.09, 0.39, 22,
      { color: C.white, bold: true });
    arrow(s, 3.19, 3.56, 4.0, 3.0);
    arrow(s, 3.19, 3.93, 4.0, 4.57, C.orange);
    box(s, 4.13, 2.59, 4.02, 0.89, C.mint);
    text(s, '部分成分被削弱', 4.37, 2.81, 3.54, 0.4, 23, { color: C.teal });
    box(s, 4.13, 4.12, 4.02, 0.89, C.sand);
    text(s, '其他成分仍有残余', 4.37, 4.34, 3.54, 0.4, 23, { color: C.orange });
    arrow(s, 8.28, 4.57, 8.89, 4.57, C.orange);
    text(s, '残余若仍足够可听，\n就仍能听见人声。', 9.13, 3.89, 3.42, 1.04, 22,
      { bold: true });
    text(s, '反例：耳道封闭时，自己的低频说话声可能增强；主动控制可减轻这种增强。\n这说明语音并非不能抵消，但不等于能完全消除外部说话声。',
      0.65, 5.56, 12, 0.9, 20);
    text(s, '轰鸣减得更多时，人声可能更突出；“更突出”不等于语音声压被放大。',
      0.65, 6.56, 12, 0.27, 15.5, { color: C.muted });
    note(s, [
      '从同一段语音沿两条分支讲解：不是耳机给“人声”整体贴了免降噪标签，而是不同成分在主动与被动响应下有不同程度的残留。分支为概念示意，不表示语音能量各占一半。',
      'Sony 的特定产品说明对低频环境声与人声相关高频成分作了体验对比；不要把它转写成“所有人声都是高频”。RWTH 自身语音闭塞效应讨论中包含 100–1000 赫兹成分，也描述了主动控制对这些成分增强的降低。',
      '自身语音闭塞控制只是推翻“语音不可能抵消”的反例，不能用来证明旁人的说话声可完全消除。',
      '轰鸣下降更多、语音下降较少时，语音主观上可能更突出；材料没有语音可懂度或相对显著性实验，所以不承诺一定更容易听清，更不把它说成语音被物理放大。',
    ]);
  }

  // 第6页：把模式与佩戴放在推断性能之前，并在页面上显式限定历史测量。
  {
    const s = page(6, '真实佩戴：先分清模式，再解释效果', source.real);
    text(s, '以下模式以 Apple／Sony 所列设备为例；名称和可用功能因产品而异。',
      0.65, 1.49, 12.03, 0.29, 16, { color: C.muted });
    const steps = [
      ['01', '确认模式', 'ANC 加入控制声。\n通透模式让外界声音进入。\n自适应模式会随环境调整。'],
      ['02', '留意佩戴', '耳形、松紧与泄漏\n都会改变声学路径；\n同一耳机也可能表现不同。'],
      ['03', '保持比较条件', '比较 ANC 开关时，\n保持同一声源与佩戴，\n别同时改变环境音模式。'],
    ];
    steps.forEach(([num, heading, body], i) => {
      const x = 0.65 + i * 4.13;
      text(s, num, x, 1.9, 0.82, 0.67, 35, { color: C.teal, bold: true });
      text(s, heading, x, 2.82, 3.55, 0.47, 24, { bold: true });
      text(s, body, x, 3.56, 3.6, 1.66, 20, { valign: 'top' });
      if (i < 2) arrow(s, x + 1.21, 2.23, x + 3.46, 2.23, C.muted);
    });
    box(s, 0.65, 5.43, 12.03, 1.25, C.sand);
    text(s, '已有测量支持“佩戴会影响结果”，却不能替你预测分贝数。',
      0.88, 5.62, 11.55, 0.38, 21, { bold: true });
    text(s, '材料只选读了作者既有原型研究的部分章节；不是本轮测试，也不是市售耳机排名。',
      0.88, 6.18, 11.55, 0.28, 16, { color: C.orange });
    note(s, [
      '这些是排查解释的顺序，不是承诺改善的操作教程。Apple 区分 ANC、通透与自适应音频，Sony 也说明自适应设置可能切换到环境声模式；不同产品可用的名称和模式不完全相同。',
      '已发表原型研究的 §6.3 报告人和假头在不同佩戴下的频率响应变化。冻结研究只选读稿首、摘要、引言、§2.1–2.3，以及提取器返回的 §6.3 和图8说明；没有阅读全文、审计完整方法或下载原始测量。',
      '这些都是作者既有测量，不是本轮观察，也不能当成出厂 QC45 的完整性能评测。内部麦克风读数和鼓膜听感不能直接混用。',
      '材料未提供用户的耳机型号、密封状态、模式和声场。若要给出个人场景衰减量，需要另行获准、在明确基准和安全声级下做真实测量，并单独评估听感；本轮没有做这些工作。',
    ]);
  }

  // 第7页：结论回到用户问题；来源身份可追溯，资源与研究边界不藏在备注里。
  {
    const s = page(7, '记住：耳边残余，不是声音类别', '事实仅据 2026-09-16 冻结研究材料；本轮未新增检索或声学测试。', true);
    const lines = [
      ['相加', 'ANC 让控制声与传入声在耳边叠加，力求留下更小起伏。'],
      ['路径', '控制声需补偿路径造成的幅度、相位变化；被动隔音也参与减噪。'],
      ['残余', '轰鸣可减轻、人声可部分削弱，但残余仍可能足够可听。'],
    ];
    lines.forEach(([label, body], i) => {
      const y = 1.88 + i * 0.91;
      box(s, 0.65, y, 1.3, 0.58, C.mint);
      text(s, label, 0.75, y + 0.1, 1.1, 0.37, 22, { bold: true, align: 'center' });
      text(s, body, 2.2, y + 0.01, 10.44, 0.57, 21, { color: C.white });
    });
    text(s, '机制解释不是个人性能预测：本材料不能回答你这次航班各减少了多少分贝。',
      0.65, 4.74, 12, 0.56, 21, { color: 'F1C699', bold: true });
    text(s, '材料来源与边界', 0.65, 5.59, 3.08, 0.34, 16,
      { color: 'B9D3D1', bold: true });
    text(s, 'RWTH IKS：主动控制原理与自身语音\nSony：WH-1000XM5 使用指南（特定产品）',
      0.65, 6.1, 5.93, 0.57, 13, { color: C.white });
    text(s, 'Hilgemann 等：arXiv:2509.15864v1（选读）\nApple：聆听模式说明（所列设备）',
      6.87, 6.1, 5.78, 0.57, 13, { color: C.white });
    note(s, [
      '请听众用自己的话复述：耳机没有把声音分成“飞机可消、人声不可消”，而是多种频率成分经过特定路径与控制后有不同残余。关 ANC 也没有拿走耳罩的物理隔音。',
      '参考资料均来自冻结 Research Dossier，本轮没有重新访问这些链接：',
      'RWTH IKS，Active Noise Control；原理、自适应算法、自身语音闭塞效应等选定段落。https://www.iks.rwth-aachen.de/forschung/audio/active-noise-control/',
      'Hilgemann、Chatzimoustafa、Jax，耳机鲁棒反馈主动降噪的数据驱动不确定性建模。arXiv v1 标记 2025-09-19，稿首标注 JAES 2024 发表信息。只选读冻结材料记录的章节。https://arxiv.org/html/2509.15864v1',
      'Sony，WH-1000XM5 / WH-1000XM5SA 降噪效果不足使用指南，手册 5-035-396-11(6)。https://helpguide.sony.net/mdr/wh1000xm5/v1/en/contents/TP1000534745.html',
      'Apple，AirPods 聆听模式说明，冻结材料记录页面发布日期为 2026-09-14。https://support.apple.com/en-us/108918',
      '研究材料中的来源访问发生于 2026-09-16，不是本轮新观察。没有用户场景的衰减量、可懂度数据或声学实验。呈现的时间误差示例是解析教学模型，不是产品测试。',
    ]);
  }
}
