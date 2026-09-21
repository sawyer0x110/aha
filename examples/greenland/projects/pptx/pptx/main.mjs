export default async function ({ pptx, research }) {
  /*
   * 设计简报：面向一般读者，用七页回答“看起来大”与“实际面积”的区别。
   * 屏幕宽幅；原生文字、图表、表格和少量几何示意承担全部论证。
   * 深海绿代表投影，赭色代表面积比较；不以颜色作为唯一分类标识。
   * 先给答案，再给面积证据、几何桥梁、局部例子、用途和选择标准。
   * 页面保留重要条件；备注提供讲述顺序和冻结材料中的来源，不增加事实。
   * 无外部图片、字体文件或资源。Microsoft YaHei 仅为字体请求，未检查可用性。
   * 本轮只做源项目静态检查；未执行、未渲染、未验证字体或原生编辑行为。
   * 必需的宿主 pptx 技能已加载，作为共同干预披露；实际作者规范为固定 Aha 技能。
   */
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Aha';
  pptx.subject = research.question;
  pptx.title = '格陵兰为什么在某些世界地图上显得巨大？';
  pptx.company = '冻结研究材料的中文解释';
  pptx.lang = 'zh-CN';
  pptx.theme = {
    headFontFace: 'Microsoft YaHei',
    bodyFontFace: 'Microsoft YaHei',
    lang: 'zh-CN',
  };
  const C = {
    paper: 'F6F4EE', ink: '183D43', muted: '52696B',
    teal: '176C70', pale: 'DCECE6', warm: 'A04C2B',
    sand: 'F0E0D0', white: 'FFFFFF', border: '92A7A2',
  };
  const S = pptx.ShapeType;
  const sources = {
    area: 'IndexMundi《格陵兰面积》（页面更新于2021年）；Britannica《非洲》',
    mechanism: 'PROJ 9.9 墨卡托公式；Esri ArcGIS Pro 3.6《墨卡托》',
    tradeoff: 'Britannica《地图投影》；Esri《Equal Earth》及《墨卡托》',
  };
  function text(slide, value, x, y, w, h, options = {}) {
    slide.addText(value, {
      x, y, w, h, fontFace: 'Microsoft YaHei', fontSize: 21,
      color: C.ink, margin: 0, breakLine: false, valign: 'mid',
      lang: 'zh-CN', ...options,
    });
  }
  function rect(slide, x, y, w, h, fill, line = fill) {
    slide.addShape(S.rect, {
      x, y, w, h, fill: { color: fill }, line: { color: line, width: 1 },
    });
  }
  function line(slide, x1, y1, x2, y2, color = C.teal, width = 2) {
    slide.addShape(S.line, {
      x: x1, y: y1, w: x2 - x1, h: y2 - y1,
      line: { color, width },
    });
  }
  function page(number, eyebrow, title, source) {
    const slide = pptx.addSlide();
    slide.background = { color: C.paper };
    text(slide, eyebrow, 0.65, 0.36, 11.9, 0.34, {
      fontSize: 13, color: C.muted, charSpacing: 1.1,
    });
    text(slide, title, 0.65, 0.94, 12.0, 0.95, {
      fontSize: 32, bold: true, valign: 'top',
    });
    text(slide, source, 0.65, 6.94, 11.5, 0.25, {
      fontSize: 10.5, color: C.muted,
    });
    text(slide, `${number} / 7`, 12.0, 6.93, 0.7, 0.28, {
      fontSize: 11, align: 'right', color: C.muted,
    });
    return slide;
  }
  function notes(slide, body, ids) {
    const refs = ids.map(id => {
      const evidence = research.evidence.find(item => item.id === id);
      return evidence ? `${evidence.title}\n${evidence.url}` : id;
    }).join('\n\n');
    slide.addNotes(`${body}\n\n来源（研究材料所列）：\n${refs}`);
  }

  // 第1页：直接回答，区分真实面积与投影面积；备注引出证据页。
  {
    const slide = page(1, '读懂世界地图 · 先把“看起来”与“实际”分开',
      '格陵兰为什么在某些世界地图上显得巨大？', sources.mechanism);
    text(slide, '因为墨卡托投影越靠近两极，\n放大越严重。', 0.7, 2.25, 7.25, 1.45, {
      fontSize: 31, bold: true,
    });
    text(slide, '格陵兰位于高纬度，所以纸上的面积\n会显得不成比例；这不是所有地图的共同问题。',
      0.7, 4.05, 7.3, 1.1, { fontSize: 22 });
    rect(slide, 8.65, 2.2, 3.95, 3.75, C.ink);
    text(slide, '真实面积相比', 9.0, 2.57, 3.25, 0.5, {
      color: C.white, fontSize: 20,
    });
    text(slide, '约14倍', 9.0, 3.31, 3.25, 1.03, {
      color: C.white, fontSize: 47, bold: true,
    });
    text(slide, '非洲 ÷ 格陵兰', 9.0, 4.66, 3.25, 0.6, {
      color: C.white, fontSize: 22,
    });
    text(slide, '面积来源：IndexMundi、Britannica；使用约数。', 0.7, 6.03, 11.8, 0.45, {
      fontSize: 15, color: C.muted,
    });
    notes(slide,
      '先问听众：图上占据的面积，是否就是地球上的真实面积？直接回答不是。' +
      '本作品针对普通墨卡托的高纬放大，不把现象推广到所有世界地图。' +
      '下一页用共同坐标轴比较公布面积。不要把“14倍”解释成14个轮廓可以无重叠装进非洲。',
      ['e-mercator', 'e-greenland', 'e-africa']);
  }

  // 第2页：原生条形图比较面积；数量级和统计口径都在可见页面。
  {
    const slide = page(2, '真实面积 · 同一尺度才可比较',
      '非洲的真实面积约为格陵兰的14倍', sources.area);
    text(slide, '面积（百万平方公里，约数）', 0.7, 2.03, 7.8, 0.43, {
      fontSize: 18, color: C.muted,
    });
    slide.addChart(pptx.ChartType.bar, [
      { name: '面积（百万平方公里）', labels: ['格陵兰', '非洲'], values: [2.17, 30.4] },
    ], {
      x: 0.7, y: 2.68, w: 8.05, h: 3.55,
      barDir: 'bar', catAxisLabelFontFace: 'Microsoft YaHei',
      catAxisLabelFontSize: 18, catAxisLabelColor: C.ink,
      valAxisLabelFontFace: 'Microsoft YaHei', valAxisLabelFontSize: 13,
      valAxisLabelColor: C.muted, valAxisMinVal: 0, valAxisMaxVal: 35,
      valAxisMajorUnit: 5, showLegend: false, showTitle: false,
      showValue: true, dataLabelFormatCode: '0.##',
      dataLabelPosition: 'outEnd', dataLabelColor: C.ink,
      dataLabelBkgrdColor: C.paper, dataLabelFormatCodeSourceLinked: false,
      dataLabelFontSize: 18,
      chartColors: [C.teal], showCatName: false, showBorder: false,
      showShadow: false,
      catAxisLineColor: C.border, valAxisLineColor: C.border,
      catAxisMajorGridLine: { style: 'none' },
      valGridLine: { color: 'D5DEDA', width: 1 },
      showSerName: false,
    });
    rect(slide, 9.12, 2.46, 3.5, 3.92, C.sand);
    text(slide, '读数的边界', 9.42, 2.8, 2.9, 0.48, {
      fontSize: 23, bold: true, color: C.warm,
    });
    text(slide, '格陵兰总面积包括冰盖，\n不是只算无冰区。\n\n两地数字并非出自\n统一的测量流程。',
      9.42, 3.53, 2.9, 1.91, { fontSize: 19 });
    text(slide, '“约14倍”是面积比，\n不是轮廓装箱结论。', 9.42, 5.56, 2.9, 0.61, {
      fontSize: 17, color: C.warm, bold: true,
    });
    notes(slide,
      '先指共同的零点，再比较两条柱的长度；不能用图上轮廓的大小代替真实面积。' +
      '图中约数为2.17与30.4百万平方公里。冻结材料原值分别为2,166,086和约30,365,000平方公里，' +
      '比值约14.018，因此只讲约14倍。两者均在同一条从零开始的线性坐标轴上比较。' +
      '材料中的官方格陵兰2026 PDF正文提取失败，不能声称官方正文已核验；详见第7页。',
      ['e-greenland', 'e-africa']);
  }

  // 第3页：示意图连接经线汇聚与两个方向的拉伸，不伪装成地理底图。
  {
    const slide = page(3, '投影机制 · 从球面到平面',
      '经线在球面汇聚，在墨卡托图上却保持等距', sources.mechanism);
    text(slide, '球面：同一经度差，越往高纬越窄', 0.7, 2.07, 5.65, 0.5, {
      fontSize: 21, bold: true,
    });
    text(slide, '图上：经线等距，高纬就被拉宽', 7.1, 2.07, 5.55, 0.5, {
      fontSize: 21, bold: true,
    });
    slide.addShape(S.ellipse, {
      x: 1.23, y: 2.89, w: 3.4, h: 3.0,
      fill: { color: C.pale }, line: { color: C.teal, width: 2 },
    });
    slide.addShape(S.ellipse, {
      x: 2.04, y: 2.89, w: 1.78, h: 3.0,
      fill: { color: C.pale, transparency: 100 }, line: { color: C.teal, width: 2 },
    });
    line(slide, 2.93, 2.89, 2.93, 5.89);
    line(slide, 1.58, 3.49, 4.28, 3.49, C.warm, 3);
    line(slide, 1.23, 4.39, 4.63, 4.39, C.warm, 3);
    text(slide, '高纬', 4.73, 3.24, 1.1, 0.48, { fontSize: 17, color: C.warm });
    text(slide, '赤道', 4.73, 4.15, 1.1, 0.48, { fontSize: 17, color: C.warm });
    slide.addShape(S.chevron, {
      x: 6.02, y: 3.78, w: 0.58, h: 0.69,
      fill: { color: C.teal }, line: { color: C.teal },
    });
    rect(slide, 7.6, 2.9, 3.3, 2.99, C.pale, C.teal);
    [7.6, 8.7, 9.8, 10.9].forEach(x => line(slide, x, 2.9, x, 5.89));
    [3.3, 4.46, 5.06, 5.57].forEach(y => line(slide, 7.6, y, 10.9, y, C.warm, 2));
    text(slide, '高纬', 11.13, 3.08, 1.2, 0.46, { fontSize: 17, color: C.warm });
    text(slide, '赤道', 11.13, 5.34, 1.2, 0.46, { fontSize: 17, color: C.warm });
    text(slide, '为保留局部角度，南北方向也要同步拉伸；高纬的纬线间距因此增大。',
      0.7, 6.09, 11.9, 0.48, { fontSize: 19, bold: true });
    notes(slide,
      '从左侧球面讲起：经线向极点汇聚，因此相同经度差对应的东西距离变短。' +
      '右图把经线仍画为等距直线，相对于地球上的距离，高纬的东西方向就放大更多。' +
      '墨卡托为保持局部角度，南北方向必须匹配这一放大。' +
      '两幅图均为原生形状的定性关系示意，不是真实地理底图，不可读取纬度数值或测量面积。' +
      '右图仅示意北半球一段；纬线位置未按实际投影坐标计算。',
      ['e-proj', 'e-mercator']);
    text(slide, '关系示意，非真实地图；右图仅示意北半球一段，线条位置不可用于测量。', 0.7, 6.64, 11.8, 0.24, {
      fontSize: 11, color: C.muted,
    });
  }

  // 第4页：同一个微小区域的局部倍率，避免把整国当作一个纬度。
  {
    const slide = page(4, '局部例子 · 球面墨卡托，赤道比例设为1',
      '纬度60°附近：宽约2倍，高约2倍，面积约4倍', sources.mechanism);
    text(slide, '相对于赤道的局部尺度', 0.7, 2.09, 10.9, 0.46, {
      fontSize: 20, color: C.muted,
    });
    rect(slide, 1.19, 3.21, 1.23, 1.23, C.pale, C.teal);
    text(slide, '1份', 1.19, 3.59, 1.23, 0.44, { align: 'center', bold: true });
    text(slide, '赤道基准', 0.9, 4.82, 1.85, 0.48, { fontSize: 19, align: 'center' });
    slide.addShape(S.chevron, {
      x: 3.12, y: 3.52, w: 0.65, h: 0.8,
      fill: { color: C.teal }, line: { color: C.teal },
    });
    rect(slide, 4.43, 2.94, 2.46, 2.46, C.pale, C.teal);
    line(slide, 5.66, 2.94, 5.66, 5.4, C.teal, 1.3);
    line(slide, 4.43, 4.17, 6.89, 4.17, C.teal, 1.3);
    text(slide, '宽约2倍', 4.43, 5.62, 2.46, 0.41, { fontSize: 18, align: 'center' });
    text(slide, '高约\n2倍', 7.07, 3.57, 0.8, 1.1, { fontSize: 18 });
    rect(slide, 8.45, 2.86, 4.13, 3.26, C.ink);
    text(slide, '这是微小区域的例子', 8.77, 3.18, 3.49, 0.73, {
      color: C.white, fontSize: 23, bold: true,
    });
    text(slide, '格陵兰跨越不同纬度，\n不能给整个轮廓套用\n一个统一倍率。', 8.77, 4.13, 3.49, 1.48, {
      color: C.white, fontSize: 21,
    });
    text(slide, '示意正方形表示局部尺度，不表示格陵兰或非洲的轮廓。',
      0.7, 6.36, 11.8, 0.4, { fontSize: 16, color: C.muted });
    notes(slide,
      '先指赤道基准的1份，再指右侧2乘2的四格。这里比较的是同样大小的微小地表区域投影后的局部尺度。' +
      '球面墨卡托的局部线性倍率为纬度余弦的倒数，局部面积倍率为其平方；60度的余弦为二分之一。' +
      '这是从冻结材料中的PROJ公式推导的数学例子，不是实测整个国家的倍率。' +
      '非洲同样跨越不同纬度，也不能用单个纬度代表整个大陆。',
      ['e-proj']);
  }

  // 第5页：用途与代价并置，说明墨卡托不是“画错了”。
  {
    const slide = page(5, '用途与代价 · 墨卡托保留了什么？',
      '它擅长表达局部角度与恒定航向，不擅长比较面积', sources.mechanism);
    rect(slide, 0.7, 2.22, 5.8, 3.92, C.pale);
    text(slide, '保留下来的便利', 1.03, 2.56, 5.1, 0.53, {
      fontSize: 25, bold: true,
    });
    text(slide, '局部保角：\n保留非常小范围内的角度关系。\n\n恒向线为直线：\n恒定罗盘航向的路线更易表达。',
      1.03, 3.4, 5.05, 2.31, { fontSize: 22 });
    rect(slide, 6.85, 2.22, 5.77, 3.92, C.sand);
    text(slide, '不能由此推断', 7.18, 2.56, 5.08, 0.53, {
      fontSize: 25, bold: true, color: C.warm,
    });
    text(slide, '局部保角 ≠ 大陆整体形状不变\n恒向线直线 ≠ 通常的最短路线\n\n两极投影到无穷远，\n有限地图必须裁切纬度范围。',
      7.18, 3.4, 5.05, 2.31, { fontSize: 21 });
    text(slide, '本篇机制例子采用球面墨卡托；Web Mercator 的严格性质另有条件。',
      0.7, 6.39, 11.9, 0.41, { fontSize: 17, color: C.muted });
    notes(slide,
      '不要把投影描述为画错了，而应询问它优先保留了什么。局部保角只针对无穷小范围，' +
      '并不是整个大陆的形状和面积都不变。恒向线是保持罗盘航向的路线，但通常不是最短路线，' +
      '本页不是实际航海指导。两极在墨卡托公式中对应无穷远，因此实际有限画面需要裁切；' +
      '本作品不指定通用的裁切纬度。冻结材料还指出Web Mercator把椭球纬度代入球面公式，' +
      '严格性质不同于普通椭球墨卡托，不能直接混用其保角结论。',
      ['e-mercator', 'e-proj']);
  }

  // 第6页：真正的原生表格，以任务而不是“正确/错误”比较投影。
  {
    const slide = page(6, '选图标准 · 原生可编辑比较表',
      '没有全能的平面地图：先问你要比较什么', sources.tradeoff);
    slide.addTable([
      [
        { text: '比较维度', options: { bold: true, color: C.white, fill: C.ink } },
        { text: '普通墨卡托', options: { bold: true, color: C.white, fill: C.ink } },
        { text: 'Equal Earth（等面积）', options: { bold: true, color: C.white, fill: C.ink } },
      ],
      ['面积比例', '不保留；高纬放大严重', '保留面积比例'],
      ['角度与形状', '局部保角；不保留\n大陆整体形状', '不保角；形状仍会变形'],
      ['用途取向', '表达恒定航向；\n恒向线为直线', '比较地区的面积大小'],
      ['不能承诺', '恒向线通常不是最短路；\n有限地图需裁切两极', '不能同时保全形状、\n角度、方向和距离'],
    ], {
      x: 0.7, y: 2.0, w: 11.92, h: 3.86,
      colW: [2.02, 4.65, 5.25],
      rowH: 0.77, fontFace: 'Microsoft YaHei',
      fontSize: 19, color: C.ink, fill: C.white,
      border: { type: 'solid', color: C.border, pt: 1 },
      margin: [0.12, 0.17, 0.12, 0.17],
      valign: 'middle', autoPage: false,
      bold: false, lang: 'zh-CN',
    });
    text(slide, '比较“谁更大”时，等面积投影更合适；这不意味着它是唯一正确的地图。',
      0.7, 6.48, 11.92, 0.36, { fontSize: 20, bold: true });
    notes(slide,
      '按行讲，不逐格朗读：面积行回答本次问题，角度行解释墨卡托为何仍有用途，最后一行提醒所有平面投影都要取舍。' +
      'Equal Earth的等面积属性保留面积比例，但不能推导出形状、角度、方向或距离也准确。' +
      '最后回到格陵兰与非洲：比较谁的真实面积更大，应读面积数据或使用等面积投影，而不是用墨卡托图上的面积判断。',
      ['e-flat', 'e-equalearth', 'e-mercator']);
  }

  // 第7页：形成可迁移的读图步骤，并让关键来源缺口可见。
  {
    const slide = page(7, '回到问题 · 下次看到“大格陵兰”时',
      '先辨认投影，再判断图上的“大”意味着什么', '来源：IndexMundi、Britannica、PROJ、Esri；研究材料访问记录截至2026-09-16。');
    const steps = [
      ['01', '识别投影', '如果是墨卡托，\n先警惕高纬地区的面积放大。'],
      ['02', '换成同一面积尺度', '非洲约3040万平方公里；\n格陵兰约217万，非洲约为其14倍。'],
      ['03', '按目的选择地图', '比较面积可用等面积投影；\n不要期待一张平面图保留一切。'],
    ];
    steps.forEach((step, index) => {
      const y = 2.25 + index * 1.03;
      text(slide, step[0], 0.7, y, 0.75, 0.66, {
        fontSize: 28, bold: true, color: C.teal,
      });
      text(slide, step[1], 1.75, y, 3.18, 0.69, {
        fontSize: 23, bold: true,
      });
      text(slide, step[2], 5.12, y - 0.02, 7.4, 0.82, { fontSize: 20 });
    });
    rect(slide, 0.7, 5.56, 11.92, 1.05, C.sand);
    text(slide, '材料限制', 0.96, 5.8, 1.68, 0.5, {
      fontSize: 19, bold: true, color: C.warm,
    });
    text(slide, '格陵兰官方2026年PDF正文未能提取；面积比较采用公开二手数字。\n约数用于数量级比较，不代表统一口径下的精确测量。',
      2.76, 5.76, 9.48, 0.66, { fontSize: 16, color: C.ink });
    notes(slide,
      '结尾请听众完整说出两个结论：一是格陵兰在普通墨卡托上被高纬放大；二是非洲的真实面积约为格陵兰的14倍。' +
      '接着用任务选择地图：若关注面积比例，等面积投影比墨卡托合适，但并非全能。' +
      '官方PDF正文缺口以及来源测量口径差异决定了这里应使用约数。' +
      '若听众把“14倍”理解为轮廓装箱，回到第2页的同尺度条形图，强调比较的是公布面积之比。',
      ['e-greenland', 'e-africa', 'e-proj', 'e-mercator', 'e-flat', 'e-equalearth']);
  }
}
