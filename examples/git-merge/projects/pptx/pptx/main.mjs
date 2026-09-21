export default async function ({ pptx, research }) {
  // 设计意图：面向已懂提交和分支的开发者，以三侧状态而非提交消息解释结果。
  // 采用宽屏讲解；原生状态图、比较表和排查流程各承担不同关系，备注补充推导。
  // 构建阶段与应用核验记录保存在交付 QA 中，不写入演讲者备注。
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Aha';
  pptx.subject = research.question;
  pptx.title = '为什么 Git 合并有时会带回已撤销的修改？';
  pptx.company = '基于冻结研究材料的中文讲解';
  pptx.lang = 'zh-CN';
  pptx.theme = {
    headFontFace: 'Microsoft YaHei',
    bodyFontFace: 'Microsoft YaHei',
    lang: 'zh-CN',
  };

  const C = {
    bg: 'F6F3EB', ink: '222C30', muted: '536166', border: 'B7C1BD',
    base: '58656B', ours: '155F58', theirs: '874219',
    paleOurs: 'E4EFEB', paleTheirs: 'F6E8D9', white: 'FFFFFF', dark: '182D2C',
  };
  const text = (s, value, x, y, w, h, size = 22, extra = {}) =>
    s.addText(value, {
      x, y, w, h, fontFace: 'Microsoft YaHei', fontSize: size,
      color: C.ink, margin: 0, breakLine: false, valign: 'mid',
      ...extra,
    });
  const box = (s, x, y, w, h, fill, line = fill) =>
    s.addShape(pptx.ShapeType.rect, {
      x, y, w, h, fill: { color: fill }, line: { color: line, width: 1 },
    });
  const arrow = (s, x1, y1, x2, y2, color = C.base) =>
    s.addShape(pptx.ShapeType.line, {
      x: Math.min(x1, x2), y: Math.min(y1, y2),
      w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
      flipV: y2 < y1,
      line: { color, width: 2, beginArrowType: 'none', endArrowType: 'triangle' },
    });
  const note = (s, paragraphs, evidenceIds) => {
    const refs = evidenceIds.map(id => {
      const e = research.evidence.find(item => item.id === id);
      return e ? `${e.locator}\n${e.url}` : id;
    });
    s.addNotes([...paragraphs, '来源：冻结研究材料（截点 2026-09-16）；示例是状态模型推导，不是 Git 实验结果。', ...refs].join('\n\n'));
  };
  const page = (number, title, subtitle, source, dark = false) => {
    const s = pptx.addSlide();
    s.background = { color: dark ? C.dark : C.bg };
    text(s, `Git 合并机制  /  ${String(number).padStart(2, '0')}`, 0.6, 0.32, 11.8, 0.25, 12,
      { color: dark ? 'C2D5CD' : C.muted });
    text(s, title, 0.6, 0.88, 12.1, 0.64, 32,
      { bold: true, color: dark ? C.white : C.ink });
    text(s, subtitle, 0.6, 1.7, 12, 0.74, 20,
      { color: dark ? 'DCE7E0' : C.muted });
    text(s, source, 0.6, 6.91, 11.5, 0.28, 11,
      { color: dark ? 'C2D5CD' : C.muted });
    text(s, `${number} / 8`, 12, 6.91, 0.73, 0.28, 11,
      { align: 'right', color: dark ? 'C2D5CD' : C.muted });
    return s;
  };
  const table = (s, rows, x, y, widths, rowHeight, size = 20) => {
    s.addTable(rows.map((row, index) => row.map(value => ({
      text: value,
      options: {
        bold: index === 0,
        color: index === 0 ? C.white : C.ink,
        fill: index === 0 ? C.dark : index % 2 ? C.white : 'EAEFEA',
      },
    }))), {
      x, y, w: widths.reduce((a, b) => a + b, 0),
      colW: widths, rowH: rowHeight, fontFace: 'Microsoft YaHei',
      fontSize: size, color: C.ink, margin: 0.12, valign: 'middle',
      border: { type: 'solid', color: C.border, pt: 0.8 },
      autoPage: false,
    });
  };

  // 第1页：先回答“为何回来”，三块并列状态将净变化与结果连接起来。
  {
    const s = page(1, '为什么 Git 合并有时会带回已撤销的修改？',
      '普通 revert 改变当前内容，却不是“今后永远禁止这项修改”的指令。',
      '依据：Git v2.55.0 策略手册、git-revert；冻结材料截点 2026-09-16', true);
    text(s, '示例文本：feature.txt 中的 mode=off / on；不是 Git 文件模式。',
      0.6, 2.52, 12.1, 0.28, 16, { color: 'DCE7E0' });
    const nodes = [
      { x: 0.6, label: '基点 B', state: 'mode=off', detail: '双方共同祖先中的内容', color: C.base },
      { x: 4.72, label: '本侧 ours', state: 'mode=off', detail: '先改成 on，再撤销回 off', color: C.ours },
      { x: 8.84, label: '对侧 theirs', state: 'mode=on', detail: '仍保留 off → on 的变化', color: C.theirs },
    ];
    nodes.forEach(n => {
      box(s, n.x, 2.9, 3.89, 1.75, C.white);
      text(s, n.label, n.x + 0.2, 3.1, 3.49, 0.3, 18, { color: n.color, bold: true });
      text(s, n.state, n.x + 0.2, 3.52, 3.49, 0.45, 28, { bold: true });
      text(s, n.detail, n.x + 0.2, 4.12, 3.49, 0.3, 16);
    });
    text(s, '该路径本侧相对基点没变 → 采用对侧 on', 0.6, 5.02, 12.1, 0.55, 29,
      { color: C.white, bold: true });
    text(s, '限定：普通文件、文件模式相同、无重命名或自定义驱动的 ort 三方合并。\n这是状态模型推导，不是 Git 实验结果。', 0.6, 5.9, 12, 0.62, 17,
      { color: 'DCE7E0' });
    note(s, [
      '先请听众看三个最终状态，而不是猜测 Git 是否记住了撤销意图。这里采用的是对侧当前仍有的内容，不是把 A 提交神秘地重新执行一遍。',
      '例子里的 R 是已经提交的普通 revert。普通 revert 通常新建反向修改提交；--no-commit 是不立即提交的例外。有关合并提交的撤销在第5页单独说明。',
      '三个状态属于同一个相关路径，不意味着本侧整棵树没有独立修改。第3页展开这个区别。',
    ], ['e-strategy', 'e-revert', 'e-code-select']);
  }

  // 第2页：提交图说明历史用于找基点，条带说明树作为内容输入，避免“不看历史”误解。
  {
    const s = page(2, '先沿历史找基点，再比较三侧内容',
      '合并基点是最佳共同祖先；不是日期最近的提交，也不是本侧当前文件。',
      '依据：git-merge-base 1–32 行；merge-ort.c 5303–5450 行（v2.55.0）');
    const node = (x, y, id, state, fill) => {
      box(s, x, y, 2.65, 0.98, fill);
      text(s, `${id}   ${state}`, x + 0.15, y + 0.2, 2.35, 0.58, 22, { color: C.white, bold: true });
    };
    arrow(s, 3.25, 3.35, 4.5, 3.35, C.ours);
    arrow(s, 7.15, 3.35, 8.4, 3.35, C.ours);
    arrow(s, 1.93, 3.84, 1.93, 4.57, C.theirs);
    arrow(s, 1.93, 4.57, 4.5, 4.57, C.theirs);
    node(0.6, 2.86, 'B', 'off', C.base);
    node(4.5, 2.86, 'A', 'on', C.ours);
    node(8.4, 2.86, 'R', 'off', C.ours);
    node(4.5, 4.08, 'T', 'on', C.theirs);
    text(s, '本侧当前', 11.35, 3.08, 1.32, 0.4, 17, { color: C.ours });
    text(s, '对侧当前', 7.48, 4.29, 2, 0.4, 17, { color: C.theirs });
    text(s, '箭头：较早提交 → 后续提交；R 撤销 A 的修改', 0.6, 5.24, 12, 0.35, 17, { color: C.muted });
    box(s, 0.6, 5.88, 12.13, 0.67, C.paleOurs);
    text(s, '内容输入是 B、R、T 的树；多个最佳基点时，ort 先合成共同祖先树。',
      0.83, 5.99, 11.65, 0.44, 20, { color: C.ours });
    note(s, [
      '先沿图读 B→A→R，再读 B→T。A 说明本侧曾经改成 on，但当前内容合并输入是 R 的树，而非依次重放 A 和 R。',
      '图中箭头为了讲解表示历史推进方向，不是 Git 对象内部父指针的方向。B 只是此简单拓扑的单一最佳共同祖先。',
      '不能把“内容合并比较三个状态”说成“Git 完全不看历史”。merge_ort_internal 先获取或接收基点，必要时合并多个基点，再把基点树、h1 树与 h2 树交给后续合并。',
    ], ['e-base', 'e-code-base', 'e-strategy']);
  }

  // 第3页：真正的原生表格对照独立路径，避免把整树选择误当成逐路径合并。
  {
    const s = page(3, '撤销一个文件，不会抹掉其它路径的独立修改',
      '按路径比较：feature.txt 的本侧净变化为零，local.txt 的本侧修改却仍然存在。',
      '依据：merge-ort.c 1260–1455 行；下表为未运行的说明性推导');
    table(s, [
      ['路径', '基点 B', '本侧 R', '对侧 T', '推导结果'],
      ['feature.txt', 'mode=off', 'mode=off', 'mode=on', 'mode=on'],
      ['local.txt', '旧内容', '本侧更新', '旧内容', '本侧更新'],
      ['remote.txt', '旧内容', '旧内容', '对侧更新', '对侧更新'],
    ], 0.6, 2.88, [2.53, 2.4, 2.4, 2.4, 2.4], 0.65, 20);
    text(s, '关键比较是文件模式与对象 ID，不是 R 的提交消息。', 0.6, 5.82, 12, 0.38, 23, { bold: true });
    text(s, '适用上述普通文件条件。同一文件不同区域的修改仍需内容合并，不能照搬此快速路径。',
      0.6, 6.36, 12, 0.35, 16, { color: C.muted });
    note(s, [
      '从第一行开始：在三侧均有普通文件的限定情形，模式与对象 ID 显示本侧等于基点，就可以选取对侧。第二行则是对侧等于基点，因此保留本侧独立修改。',
      '让听众分别指出每一行哪一侧没有变化，比直接说“Git 自动聪明合并”更能建立判断方法。第三行再次选入对侧更新，但不是整棵树都被对侧替换。',
      '此处列出的是独立路径模型，没有运行 Git。若改的是同一文件的不同区域，需要依据内容、匹配和驱动判断，不能把逐文件快速选择直接等同于每行文本的实现。',
    ], ['e-code-select', 'e-strategy']);
  }

  // 第4页：保留两个当前值，改变基点，使反例直接反驳“撤销必回来”。
  {
    const s = page(4, '本侧 off、对侧 on 不变，基点改变可反转结果',
      '本侧始终是 off，对侧始终是 on；谁相对共同祖先发生了变化，才是关键。',
      '依据：merge-ort.c 1260–1455、2097–2295、4325–4377 行');
    table(s, [
      ['基点', '本侧当前', '对侧当前', '简单普通文件的推导'],
      ['off', 'off：未变', 'on：已变', '采用对侧 on'],
      ['on', 'off：已变', 'on：未变', '保留本侧 off'],
    ], 0.6, 2.75, [1.75, 2.7, 2.7, 4.98], 0.62, 22);
    box(s, 0.6, 5.02, 12.13, 1.46, C.paleTheirs);
    text(s, '基点 off、本侧 manual、对侧 on：两侧都改，不能快速选边。',
      0.84, 5.19, 11.6, 0.48, 21, { color: C.theirs, bold: true });
    text(s, '可能进入内容合并并冲突，但不同修改不必然冲突。\n即使文本合并干净，也仍需测试和代码审查来确认业务正确性。',
      0.84, 5.81, 11.6, 0.52, 18);
    note(s, [
      '逐列比较两行：本侧在两行中都为 off，对侧在两行中都为 on；并不是本侧与对侧相等。唯一改变的是基点。第一行本侧未变，第二行对侧未变，所以采用的内容相反。',
      '这同时反驳“我撤销过，合并必带回来”和“两个当前值不同，必然冲突”。判断必须包含第三个状态。',
      '底部明确列出基点 off、本侧 manual、对侧 on。材料只支持可能进入内容合并并出现冲突；没有运行例子，也没有审计底层 xdiff 或自定义驱动，因此不提供确定冲突输出。',
    ], ['e-code-select', 'e-code-content', 'e-merge-intro']);
  }

  // 第5页：操作对照保留祖先关系和指针移动的差异，备注补充合并撤销的精确边界。
  {
    const s = page(5, '先分清：撤销内容，还是移动历史指针？',
      '表面文件相同，不代表祖先关系相同；普通 revert 的例子不能直接套到其它操作。',
      '依据：git-revert 1–94 行；git-reset 1–107 行（冻结 v2.55.0 文档）');
    table(s, [
      ['操作', '内容与历史发生什么', '排查时不能忽略'],
      ['普通 revert', '通常新建反向提交；\n原提交与祖先关系保留', '--no-commit 不立即提交；\n不是永久禁用修改'],
      ['撤销合并提交', '-m 选择主线父提交；\n反转相对它的树变化', '合并祖先关系仍在；\n影响后续可带入的变化'],
      ['reset', '提交形式移动 HEAD；\n模式决定索引与工作区', '路径形式只改索引；\n移动指针可能改变未来基点'],
    ], 0.6, 2.65, [2.35, 4.89, 4.89], 0.8, 19);
    text(s, '不要机械“重新合并”或“撤销撤销”；reset --hard 也不是安全的自动修复。',
      0.6, 6.18, 12, 0.46, 20, { color: C.theirs, bold: true });
    note(s, [
      '第1页的 R 是已提交的普通 revert，保持原提交及父子关系。--no-commit 则只改变工作区与索引，不立即创建提交。',
      '撤销合并提交需要 -m 指定主线父提交。官方说明后续合并只会带入那些不是先前被撤销合并之祖先的提交所引入的树变化。撤销树变化没有删除合并祖先关系，因此不能保证重新合并就能取回先前内容。',
      '也不能总建议 revert the revert。应先检查后续拓扑和目标内容。reset 的提交形式移动 HEAD／当前分支指针；带路径的形式不移动 HEAD。--hard 会覆盖工作区内容，本页不建议执行，也未执行任何操作。',
    ], ['e-revert', 'e-reset', 'e-base']);
  }

  // 第6页：用整树与冲突区域的尺度对照，揭示两个 ours 并不等价。
  {
    const s = page(6, '名字都有 ours，作用范围却完全不同',
      '这里的解释以通常的 ort 三方合并为前提；策略或选项一变，不能照搬结论。',
      '依据：v2.55.0 merge-strategies.adoc（策略手册）');
    box(s, 0.6, 2.82, 5.88, 2.59, C.paleOurs);
    box(s, 6.85, 2.82, 5.88, 2.59, C.paleTheirs);
    text(s, '-s ours', 0.88, 3.05, 5.32, 0.5, 29, { color: C.ours, bold: true });
    text(s, '保留本侧整棵树', 0.88, 3.8, 5.32, 0.4, 25, { bold: true });
    text(s, '忽略其它分支的内容，\n也可能丢掉原本想要的对侧修改。', 0.88, 4.43, 5.24, 0.65, 21);
    text(s, '-Xours', 7.13, 3.05, 5.32, 0.5, 29, { color: C.theirs, bold: true });
    text(s, '仅在冲突区域偏向本侧', 7.13, 3.8, 5.32, 0.4, 25, { bold: true });
    text(s, '对侧不冲突的修改仍会进入，\n并非保护已撤销内容的通用开关。', 7.13, 4.43, 5.24, 0.65, 21);
    text(s, 'ort 是合并单个分支的默认策略；自 v2.50.0 起 recursive 是其同义名。',
      0.6, 5.78, 12, 0.43, 20);
    text(s, '其它策略、子模块、复杂重命名与自定义驱动不在本模型的完整验证范围。',
      0.6, 6.36, 12, 0.33, 17, { color: C.muted });
    note(s, [
      '先读命令中的小写 s 与大写 X，强调它们不是拼写风格差异：一个选择策略，一个传递策略选项。',
      '-s ours 是“所有合并都会带回修改”的反例，但不是此问题的通用修复；它忽略其它分支内容，会丢弃本来想合入的修改。-Xours 只对冲突区域偏向本侧，无法承诺拒绝非冲突的对侧修改。',
      '冻结手册指出 recursive 从 v2.50.0 起是 ort 的同义名，不应当作当前另一套独立实现。resolve、octopus、subtree 的能力和输入条件不同，本材料没有穷尽验证。',
    ], ['e-strategy']);
  }

  // 第7页：可操作的诊断阅读顺序，不提供可能破坏工作区的一键修复命令。
  {
    const s = page(7, '排查顺序：先还原三侧状态，再讨论修复',
      '不要只看最近一次提交消息，也不要只对比两个分支的当前文件。',
      '依据：冻结研究报告“策略、选项与排查顺序”；以下建议未执行', true);
    const steps = [
      ['01', '记录真实输入', 'Git 版本、策略与选项；\n两侧实际提交是什么？'],
      ['02', '查基点与路径', '最佳共同祖先有哪些？\n相关路径在三侧分别是什么？'],
      ['03', '辨认撤销方式', '普通 revert、合并撤销，\n还是 reset 移动了指针？'],
      ['04', '审查预期结果', '独立修改是否保留？\n冲突与业务行为是否验证？'],
    ];
    steps.forEach((step, i) => {
      const y = 2.77 + i * 0.83;
      text(s, step[0], 0.65, y, 0.7, 0.51, 28, { color: 'C9DDC6', bold: true });
      text(s, step[1], 1.68, y, 3.2, 0.51, 24, { color: C.white, bold: true });
      text(s, step[2], 5.13, y - 0.01, 7.1, 0.62, 19, { color: 'DCE7E0' });
      if (i < 3) arrow(s, 0.98, y + 0.57, 0.98, y + 0.78, 'C9DDC6');
    });
    text(s, '负责人确认目标内容 + 项目测试 + 代码审查；“没有冲突”只是起点。',
      0.6, 6.32, 12, 0.4, 21, { color: C.white, bold: true });
    note(s, [
      '把排查当成重建证据，而不是寻找万能选项。先确认输入，避免用错分支或把其它策略的表现误归给 ort。',
      '检查共同祖先和相关路径，再看撤销操作的类型。存在多个最佳共同祖先时，需要考虑 ort 的共同祖先树，而不是随意拿一个旧文件作基准。',
      '最后由项目负责人判断哪些内容应该保留，再做项目验证。提醒听众：文本合并没有冲突并不能证明业务正确，仍需项目测试和代码审查。',
    ], ['e-base', 'e-code-base', 'e-code-select', 'e-revert', 'e-reset', 'e-strategy', 'e-code-content']);
  }

  // 第8页：版本与证据限制对观众可见，区分冻结研究记录与本轮新观察。
  {
    const s = page(8, '记住三侧状态，也记住证据的边界',
      '结论：普通撤销不是永久禁令；要用基点、本侧与对侧共同判断合并内容。',
      '全部事实取自提供的冻结 Research Dossier；来源链接与定位见各页备注');
    box(s, 0.6, 2.85, 4.05, 3.52, C.dark);
    text(s, '版本锚点', 0.88, 3.09, 3.49, 0.38, 22, { color: C.white, bold: true });
    text(s, 'Git v2.55.0', 0.88, 3.73, 3.49, 0.49, 29, { color: C.white, bold: true });
    text(s, '固定提交 e9019fc…\n标签日期 2026-06-29\n材料截点 2026-09-16', 0.88, 4.48, 3.49, 1.2, 20,
      { color: 'DCE7E0' });
    text(s, '材料证明到哪里', 5.09, 2.97, 7.56, 0.43, 25, { bold: true });
    text(s, '官方手册 + 固定源码片段支持机制；\n它们属于同一项目证据链，不是独立实验复验。',
      5.09, 3.56, 7.56, 0.75, 21);
    text(s, '没有证明什么', 5.09, 4.69, 7.56, 0.43, 25, { bold: true });
    text(s, '没有新 Git 实验；未审计底层 xdiff、驱动或全部拓扑。\n标签列表只查前五项；不等于完整维护版本调查。',
      5.09, 5.27, 7.56, 0.85, 20);
    note(s, [
      '本页日期是冻结材料的研究记录，不代表演讲时的最新版本。材料曾在标签列表前五项同时见到 v2.56.0-rc0 和 v2.55.0；采用已发布的 v2.55.0，不把候选版称作稳定版。',
      '固定标签对象为 5ce91c059e41090e7d2cffad39c04af8acf98dc1，指向 e9019fcafe0040228b8631c30f97ae1adb61bcdc。2026-06-29T14:59:19Z 是标记者日期，不是逐行源码的作者日期。未独立验证签名。',
      '关键源码读取范围：merge-ort.c 1260–1455、2097–2295、4325–4377、5303–5450。完整下载记录不意味着通读整个源码。模型推导保留这些来源的范围限制。',
      '收束时回到第3、4页：先找基点，再逐路径比较两侧相对基点的变化。普通撤销保留历史，不能充当永久禁令；若策略、文件条件或拓扑不同，应重新检查适用边界。',
    ], ['e-tags', 'e-tag', 'e-code-select', 'e-code-base', 'e-code-content']);
  }
}
