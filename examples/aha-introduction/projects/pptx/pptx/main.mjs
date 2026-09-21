export default async function ({ pptx, research }) {
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Aha';
  pptx.subject = research.question;
  pptx.title = 'Aha 是什么：让有依据的解释变得可见';
  pptx.company = 'Aha';
  pptx.theme = {
    headFontFace: 'Microsoft YaHei',
    bodyFontFace: 'Microsoft YaHei',
    lang: 'zh-CN',
  };

  const C = {
    paper: 'F7F3ED', ink: '292629', rose: '873E55', pale: 'EADCE0',
    muted: '655B5D', rule: 'CEC2BD', white: 'FFFFFF', darkMuted: 'DED2CF',
  };
  const S = pptx.ShapeType;
  const font = 'Microsoft YaHei';
  const txt = (slide, text, x, y, w, h, size = 21, extra = {}) => {
    slide.addText(text, {
      x, y, w, h, fontFace: font, fontSize: size, lang: 'zh-CN',
      color: C.ink, margin: 0, breakLine: false, valign: 'middle',
      paraSpaceAfter: 0, ...extra,
    });
  };
  const rect = (slide, x, y, w, h, fill, stroke = fill, extra = {}) => {
    slide.addShape(S.rect, {
      x, y, w, h, fill: { color: fill },
      line: { color: stroke, width: 1 }, ...extra,
    });
  };
  const ellipse = (slide, x, y, w, h, fill, stroke = fill, extra = {}) => {
    slide.addShape(S.ellipse, {
      x, y, w, h, fill: { color: fill },
      line: { color: stroke, width: 1.5 }, ...extra,
    });
  };
  const line = (slide, x1, y1, x2, y2, color = C.rule, arrow = false, dash = false) => {
    slide.addShape(S.line, {
      x: Math.min(x1, x2), y: Math.min(y1, y2),
      w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
      flipH: x2 < x1, flipV: y2 < y1,
      line: {
        color, width: arrow ? 1.7 : 1,
        ...(arrow ? { endArrowType: 'triangle' } : {}),
        ...(dash ? { dashType: 'dash' } : {}),
      },
    });
  };
  const base = (number, section, source, dark = false) => {
    const slide = pptx.addSlide();
    slide.background = { color: dark ? C.ink : C.paper };
    txt(slide, `Aha  /  ${section}`, 0.65, 0.35, 11.2, 0.3, 12.5, {
      color: dark ? C.darkMuted : C.muted,
    });
    txt(slide, source, 0.65, 6.96, 11.35, 0.26, 11.5, {
      color: dark ? C.darkMuted : C.muted,
    });
    txt(slide, String(number).padStart(2, '0'), 12.0, 6.91, 0.65, 0.35, 13, {
      align: 'right', color: dark ? C.darkMuted : C.muted,
    });
    return slide;
  };
  const heading = (slide, text, subtitle) => {
    txt(slide, text, 0.65, 0.94, 12.0, 0.66, 32, { bold: true });
    if (subtitle) txt(slide, subtitle, 0.65, 1.68, 12.0, 0.5, 19, { color: C.muted });
  };

  // s01-orientation
  {
    const slide = base(1, '认识 Aha', '依据：Aha 简介 Dossier · 2026-09-17；两项技能的职责与边界', true);
    txt(slide, 'Aha 是什么？', 0.65, 1.25, 8.2, 0.9, 45, { color: C.paper, bold: true });
    txt(slide, '让有依据的解释\n变得可见', 0.65, 2.48, 7.4, 1.6, 37, {
      color: C.paper, bold: true, breakLine: false,
    });
    txt(slide, '两项可移植技能：一项把问题查清，\n一项为阅读目的设计表达。', 0.65, 4.58, 7.3, 1.05, 23, {
      color: C.darkMuted,
    });
    rect(slide, 8.9, 1.45, 3.75, 1.65, C.paper);
    txt(slide, 'aha-research', 9.18, 1.74, 3.2, 0.43, 25, { color: C.rose, bold: true });
    txt(slide, '研究：结论、证据、限制', 9.18, 2.36, 3.2, 0.4, 17.5);
    rect(slide, 8.9, 3.5, 3.75, 1.65, C.rose);
    txt(slide, 'aha-explain', 9.18, 3.79, 3.2, 0.43, 25, { color: C.white, bold: true });
    txt(slide, '解释：按所需媒介创作', 9.18, 4.41, 3.2, 0.4, 17.5, { color: C.white });
    txt(slide, '由宿主协调，不是自动分发流水线。', 0.65, 6.11, 12, 0.45, 22, { color: C.paper });
    slide.addNotes('先让第一次接触 Aha 的听众知道它是什么，而不是先展示案例。这里的“宿主”指承载技能、协调调用与交付的助手或工具环境。两项技能分别承担研究与表达职责，不意味着它们会自动互相调用。接下来解释研究怎样成为可复用的依据，再看三个具体机制。');
  }

  // s02-two-skills
  {
    const slide = base(2, '两项技能如何配合', '依据：简介 Dossier 的技能职责；当前 Aha 作者指南');
    heading(slide, '研究保留依据，解释建立看得懂的关系', '同一份研究可以被复用；换媒介时，要重新设计表达。');
    rect(slide, 0.65, 2.53, 5.55, 2.62, C.white, C.rule);
    txt(slide, 'aha-research', 0.95, 2.82, 4.9, 0.5, 28, { bold: true, color: C.rose });
    txt(slide, '围绕问题调查与核对，\n保存结论、证据和限制。', 0.95, 3.55, 4.75, 1.02, 24);
    rect(slide, 7.12, 2.53, 5.55, 2.62, C.pale);
    txt(slide, 'aha-explain', 7.42, 2.82, 4.9, 0.5, 28, { bold: true, color: C.rose });
    txt(slide, '把支持得住的结论，\n写成适合所需媒介的解释。', 7.42, 3.55, 4.75, 1.02, 24);
    line(slide, 6.3, 3.73, 7.0, 3.73, C.rose, true);
    txt(slide, 'Dossier：可复用的研究档案', 0.95, 5.44, 5.5, 0.45, 20, { bold: true });
    txt(slide, '文字、图解、比较与变化，\n共同说明“为什么”。', 7.42, 5.38, 4.9, 0.74, 18);
    txt(slide, '箭头表示依据被复用；何时研究、何时解释，由宿主协调。', 0.95, 6.28, 11.45, 0.38, 18, { color: C.muted });
    slide.addNotes('研究档案不仅保存最终答案，还保留答案的支持来源和不能外推的边界。解释工作不是把报告原样塞进幻灯片，而是把读者需要理解的对象、变化和后果组织起来。箭头仅表示研究依据进入解释，不表示自动调用。已有档案也要先检查范围、日期和覆盖是否适合当前问题。');
  }

  // s03-medium-choices
  {
    const slide = base(3, '按目的选媒介', '选择建议：依据当前 Aha 的媒介职责作编辑归纳；不是案例完成清单');
    heading(slide, '先问读者要做什么，再选交付形式', '支持一种媒介，不等于每个案例都已经交付了这种媒介。');
    const rows = [
      ['媒介', '读者主要想做什么', '适合怎样组织解释'],
      ['HTML', '自主阅读、操作与探索', '让读者控制阅读路径'],
      ['PNG 信息图', '快速回顾、转发要点', '一张图保留关键关系'],
      ['原生 PPTX', '逐页讲解、讨论与修改', '分步推理，保留可编辑对象'],
      ['视频', '跟随时间理解变化', '把状态变化与讲解配合'],
    ].map((row, ri) => row.map((text) => ({
      text,
      options: {
        bold: ri === 0,
        color: ri === 0 ? C.white : C.ink,
        fill: ri === 0 ? C.rose : (ri % 2 === 0 ? C.pale : C.white),
      },
    })));
    slide.addTable(rows, {
      x: 0.65, y: 2.48, w: 12.02, h: 3.35,
      colW: [2.3, 4.5, 5.22], rowH: [0.67, 0.67, 0.67, 0.67, 0.67],
      fontFace: font, fontSize: 19, color: C.ink, lang: 'zh-CN',
      margin: [8, 12, 8, 12], valign: 'middle',
      border: { type: 'solid', pt: 0.65, color: C.paper },
      autoPage: false,
    });
    txt(slide, '同一依据，不是四次复制；表达方式跟着使用目的改变。', 0.85, 6.24, 11.7, 0.42, 22, {
      color: C.rose, bold: true,
    });
    slide.addNotes('这是一张选型建议表，不是“所有案例都有四种文件”的库存表。网页的自主操作、信息图的快速概览、幻灯片的逐页讨论和视频的时间过程各有用途。本页先解释媒介选择，后面的三个例子再说明如何把依据变成可见的机制。');
  }

  // s04-greenland
  {
    const slide = base(4, '案例一 · 格陵兰', '继承来源：Greenland Dossier；PROJ 球面 Mercator；Natural Earth 5.1.2 概化边界');
    heading(slide, '格陵兰在图上变小，球面面积却没变', '固定球面墨卡托投影：高纬放大更强；移向低纬，图上占幅随之改变。');
    ellipse(slide, 0.88, 2.65, 3.0, 3.0, C.paper, C.ink);
    ellipse(slide, 1.68, 2.65, 1.4, 3.0, C.paper, C.rule, {
      fill: { color: C.paper, transparency: 100 },
    });
    line(slide, 0.98, 4.15, 3.78, 4.15, C.rule);
    ellipse(slide, 2.12, 2.94, 0.35, 0.35, C.rose);
    ellipse(slide, 2.97, 4.18, 0.35, 0.35, C.rose);
    line(slide, 2.48, 3.29, 2.96, 4.04, C.rose, true);
    txt(slide, '球面刚性旋转', 0.78, 5.84, 3.45, 0.46, 23, { bold: true, align: 'center' });
    txt(slide, '每个边界点用同一变换', 0.78, 6.35, 3.45, 0.3, 16.5, { align: 'center', color: C.muted });
    line(slide, 4.24, 4.13, 5.03, 4.13, C.rose, true);
    txt(slide, '再投影', 4.19, 3.58, 0.95, 0.37, 16, { align: 'center', color: C.rose });
    const frames = [
      { x: 5.32, label: '高纬位置', w: 1.35, h: 1.28 },
      { x: 9.18, label: '反事实移向低纬', w: 0.8, h: 0.7 },
    ];
    frames.forEach(({ x, label, w, h }) => {
      txt(slide, label, x, 2.5, 3.46, 0.46, 22, { bold: true, align: 'center' });
      rect(slide, x, 3.12, 3.46, 2.32, C.white, C.rule);
      [0.5, 1.16, 1.83].forEach(dy => line(slide, x + 0.1, 3.12 + dy, x + 3.36, 3.12 + dy, C.rule));
      [0.86, 1.73, 2.60].forEach(dx => line(slide, x + dx, 3.22, x + dx, 5.34, C.rule));
      ellipse(slide, x + (3.46 - w) / 2, 3.12 + (2.32 - h) / 2, w, h, C.rose, C.rose);
    });
    txt(slide, '同一固定投影；比例与平移不变', 5.32, 5.7, 7.32, 0.4, 21, { bold: true, color: C.rose });
    txt(slide, '示意符号，不是地理轮廓或面积测量；不是二维缩图。', 5.32, 6.22, 7.32, 0.38, 16.5);
    txt(slide, '球面模型、极区裁切、概化边界；不是大陆真的移动。', 5.32, 6.59, 7.32, 0.3, 15, { color: C.muted });
    slide.addNotes('左侧圆球上的两个等大标记表示同一边界的两个球面位置，不是格陵兰的实际形状。右侧两个框表示前后使用同一投影设置；玫红符号只编码图上占幅的定性差异，没有面积比值。球面刚性旋转保存面积，投影对不同纬度的放大不同，所以纸上轮廓会变。墨卡托让经线保持等距，而球面经线向两极会聚；为保持局部角度，南北方向也要相应放大。本例只谈固定球面墨卡托、极区裁切和概化边界，不是所有地图的普遍结论。');
  }

  // s05-cpython
  {
    const slide = base(5, '案例二 · CPython 字符串', '继承来源：CPython Dossier；PEP 393；CPython 3.11.15（2340a037…）；数值为既有本地记录');
    heading(slide, '为何一个字符让新 str 占用大增？', '特定例子：100000 个 ASCII 字符后追加 U+1F600，生成新的 str。');
    txt(slide, '原 str：每槽 1 字节，保持不变', 0.65, 2.47, 5.45, 0.5, 21, { bold: true });
    for (let i = 0; i < 4; i += 1) {
      rect(slide, 0.68 + i * 0.56, 3.14, 0.45, 0.53, C.white, C.rule);
      txt(slide, 'A', 0.68 + i * 0.56, 3.18, 0.45, 0.38, 18, { align: 'center' });
    }
    txt(slide, '…', 2.98, 3.19, 0.4, 0.4, 22);
    txt(slide, '新 str：统一改用 4 字节槽位', 0.65, 3.97, 5.45, 0.5, 21, { bold: true, color: C.rose });
    for (let i = 0; i < 3; i += 1) {
      rect(slide, 0.68 + i * 1.45, 4.64, 1.28, 0.53, C.pale, C.rose);
      txt(slide, i === 2 ? 'U+1F600' : 'A', 0.68 + i * 1.45, 4.68, 1.28, 0.38, i === 2 ? 14 : 18, {
        align: 'center', color: C.rose,
      });
    }
    txt(slide, '该码点超出 U+FFFF，\n新对象连 ASCII 前缀也用宽槽位。', 0.65, 5.41, 5.37, 0.85, 19);
    txt(slide, '槽位为示意；并非画出全部字符。', 0.65, 6.43, 5.35, 0.35, 15, { color: C.muted });
    txt(slide, 'str 对象大小（字节）', 6.64, 2.43, 6.03, 0.45, 22, { bold: true });
    slide.addChart(pptx.ChartType.bar, [{
      name: 'str 对象大小（字节）',
      labels: ['原 ASCII str', '加 U+1F600 后'],
      values: [100049, 400080],
    }], {
      x: 6.5, y: 3.0, w: 6.18, h: 2.46,
      barDir: 'bar', catAxisLabelPos: 'low',
      chartColors: [C.rose], showLegend: false, showTitle: false,
      showValue: true, dataLabelPosition: 'outEnd',
      dataLabelFormatCode: '#,##0', dataLabelBkgrdColors: false,
      dataLabelColor: C.ink, dataLabelFontSize: 15, dataLabelFontFace: font,
      fontFace: font, lang: 'zh-CN',
      catAxisLabelFontFace: font, catAxisLabelFontSize: 13,
      catAxisLabelColor: C.ink, catAxisLineShow: false,
      valAxisLabelFontFace: font, valAxisLabelFontSize: 11,
      valAxisLabelColor: C.muted, valAxisLineShow: false,
      valAxisMinVal: 0, valAxisMaxVal: 500000, valAxisMajorUnit: 100000,
      valAxisLabelFormatCode: '#,##0',
      chartArea: { fill: { color: C.paper }, border: { color: C.paper, pt: 0 } },
      plotArea: { fill: { color: C.paper }, border: { color: C.paper, pt: 0 } },
      catGridLine: { style: 'none' },
      valGridLine: { color: C.rule, size: 0.5 },
    });
    rect(slide, 6.64, 5.66, 6.03, 0.62, C.pale);
    txt(slide, 'UTF-8 载荷：100000 → 100004 字节', 6.82, 5.78, 5.65, 0.35, 18.5, {
      bold: true, color: C.rose,
    });
    txt(slide, '不是新测量、进程内存或文件大小；\n不能推广到每个 emoji 或所有 Python 实现。', 6.64, 6.35, 6.03, 0.56, 16, {
      color: C.muted,
    });
    slide.addNotes('这里比较的是两个不同的 str 对象，不是在原对象上把槽位改宽。原字符串不可变且仍然保持原样。U+1F600 超出 U+FFFF，结果对象需要四字节槽位；不要把这句话改成“任何非 ASCII 字符都会四字节”。图中 100049 和 400080 是档案继承的对象大小记录，包含对象开销，不是恰好四倍总量。UTF-8 编码是另一种表示：ASCII 前缀仍然每个码点一字节，增加的 U+1F600 占四字节，所以载荷只多四字节。拼接逻辑结合操作数的表示范围，这里没有断言每次拼接都会扫描所有码点。');
  }

  // s06-docker
  {
    const slide = base(6, '案例三 · Docker 镜像层', '继承来源：Docker Dossier；OCI layer/whiteout；Moby 27.5.1 的选定路径；未运行 Docker 构建');
    heading(slide, '删除路径，不等于删除旧层字节', '普通、未压平的镜像：后来的层改变合并视图，不会重写早期层。');
    txt(slide, '跨两个 RUN', 0.65, 2.43, 5.7, 0.48, 24, { bold: true });
    rect(slide, 0.65, 3.09, 5.7, 0.62, C.paper, C.ink);
    txt(slide, '合并视图：该路径不可见', 0.87, 3.22, 5.22, 0.35, 20);
    line(slide, 3.47, 4.19, 3.47, 3.78, C.rose, true);
    rect(slide, 0.65, 4.25, 5.7, 0.62, C.pale);
    txt(slide, '较新层：whiteout 删除标记', 0.87, 4.38, 5.22, 0.35, 20, { color: C.rose });
    rect(slide, 0.65, 5.05, 5.7, 0.77, C.rose);
    txt(slide, '早期层：100 MB 载荷仍保留', 0.87, 5.25, 5.22, 0.37, 20, { color: C.white, bold: true });
    txt(slide, 'whiteout 是层条目，\n不是合并视图里的普通文件。', 0.65, 5.99, 5.7, 0.58, 16.5);

    txt(slide, '同一个 RUN 内，新建再删除', 7.01, 2.43, 5.66, 0.48, 24, { bold: true });
    rect(slide, 7.01, 3.09, 5.66, 1.95, C.white, C.rule);
    txt(slide, '开始：无此路径', 7.3, 3.34, 4.99, 0.35, 20);
    txt(slide, '创建临时文件  →  删除它', 7.3, 3.94, 4.99, 0.35, 20, { color: C.rose, bold: true });
    txt(slide, '结束：仍无此路径', 7.3, 4.5, 4.99, 0.35, 20);
    txt(slide, '端点差异中，没有这条路径的载荷。', 7.01, 5.31, 5.66, 0.45, 20, { color: C.rose, bold: true });
    txt(slide, '不等于整层为零，\n也不会回收基础层已有文件的字节。', 7.01, 5.92, 5.66, 0.66, 18.5);
    txt(slide, '100 MB 为假设的未压缩载荷（100000000 字节），不是压缩镜像或磁盘占用实测。', 0.65, 6.63, 12.02, 0.29, 15);
    slide.addNotes('左边要同时看两件事：合并视图里路径消失，早期层的载荷仍在。删除记录位于较新的层，不能画成用户在合并目录中能看到的普通 whiteout 文件。右边的比较必须坚持“新建临时文件”：开始和结束都没有这个路径，才不会把它的临时载荷加入这个 RUN 的端点差异。它不表示所有层都为空，也不表示能删除基础层里的旧数据。100 MB 是解释机制用的未压缩假设载荷，并不是构建实验。');
  }

  // s07-synthesis
  {
    const slide = base(7, '把三种机制连起来', '依据：简介 Dossier 的三个有界案例；本页为编辑归纳，不是学习效果实验');
    heading(slide, '三次 “Aha”，都在分清观察对象', '先问“看到了什么”，再问“哪一层表示发生了变化”。');
    const rows = [
      {
        y: 2.65, no: '01', name: '格陵兰',
        left: '图上占幅改变', right: '球面面积不变',
        condition: '固定球面墨卡托；球面刚性旋转',
      },
      {
        y: 3.91, no: '02', name: 'CPython',
        left: '新 str 槽位变宽', right: '原 str 不变；UTF-8 另计',
        condition: '3.11.15；此例添加 U+1F600',
      },
      {
        y: 5.17, no: '03', name: 'Docker',
        left: '合并视图中消失', right: '早期层载荷仍在',
        condition: '普通未压平镜像；在较晚 RUN 删除',
      },
    ];
    rows.forEach(({ y, no, name, left, right, condition }) => {
      ellipse(slide, 0.65, y + 0.02, 0.54, 0.54, C.rose);
      txt(slide, no, 0.65, y + 0.12, 0.54, 0.26, 12.5, { align: 'center', color: C.white, bold: true });
      txt(slide, name, 1.4, y + 0.04, 2.0, 0.4, 23, { bold: true });
      txt(slide, left, 3.71, y + 0.04, 3.62, 0.4, 23, { color: C.rose, bold: true });
      txt(slide, right, 8.04, y + 0.04, 4.6, 0.4, 23, { bold: true });
      line(slide, 7.61, y + 0.04, 7.61, y + 0.5, C.rule);
      txt(slide, condition, 3.71, y + 0.64, 8.93, 0.34, 16.5, { color: C.muted });
    });
    slide.addNotes('三个例子不是在说所有东西都会发生同一种变化，而是在示范同一种解释动作：给观察对象起清楚的名字，区分表示和被表示的对象。地图中的面积感不是球面面积；新的字符串不是原字符串；合并视图不是旧层存储。读者能说清“变的是哪一个对象”，就更容易理解前面每个机制的边界。这是编辑组织原则，不是对学习效果的实测结论。');
  }

  // s08-start-with-question
  {
    const slide = base(8, '从问题开始', '依据：Aha 简介 Dossier · 2026-09-17；当前 Aha 作者指南的媒介选择原则', true);
    txt(slide, '先问依据，再选表达。', 0.65, 1.27, 12.0, 0.8, 42, { color: C.paper, bold: true });
    txt(slide, '把问题、材料和阅读用途交给宿主，\n由宿主协调所需技能。', 0.65, 2.43, 11.9, 1.1, 27, { color: C.darkMuted });
    const blocks = [
      { x: 0.65, n: '1', title: '说清问题', copy: '想理解哪一个变化？' },
      { x: 4.83, n: '2', title: '核对依据', copy: '证据支持到哪里？' },
      { x: 9.01, n: '3', title: '选择表达', copy: '读者准备怎样使用？' },
    ];
    blocks.forEach(({ x, n, title, copy }) => {
      rect(slide, x, 4.14, 3.66, 1.72, C.rose);
      txt(slide, n, x + 0.24, 4.41, 0.46, 0.52, 29, { color: C.white, bold: true });
      txt(slide, title, x + 0.91, 4.43, 2.48, 0.42, 24, { color: C.white, bold: true });
      txt(slide, copy, x + 0.26, 5.16, 3.17, 0.39, 18, { color: C.white });
    });
    txt(slide, 'Aha 的角色：保存支持得住的结论，让关键关系被看见。', 0.65, 6.24, 12.0, 0.44, 23, { color: C.paper });
    slide.addNotes('可以把下一次请求说成：“我想弄懂这个现象，手头有哪些材料，希望读者通过网页探索，还是通过幻灯片讨论？”先指定问题和用途，宿主才有明确的协调目标。研究已经足够时可以复用已有档案，但仍要检查适用范围。结尾回到两项职责：研究保留支持关系，解释把读者需要理解的关系组织出来。');
  }
}
