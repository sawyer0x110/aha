(() => {
  "use strict";
  const { narration, captures } = window.showcaseData;
  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
  const text = (x, y, value, cls = "label") => `<text x="${x}" y="${y}" class="${cls}">${esc(value)}</text>`;
  const box = (x, y, w, h, active = false) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" class="${active ? "selected" : "box"}"/>`;
  const line = (x1, y1, x2, y2, active = false) =>
    `<path d="M${x1} ${y1}L${x2} ${y2}" class="${active ? "accent-line" : "line"}"/>`;
  const arrow = (x1, y, x2, active = false) => line(x1, y, x2, y, active) +
    `<path d="M${x2 - 8} ${y - 6}L${x2} ${y}L${x2 - 8} ${y + 6}" class="${active ? "accent-line" : "line"}"/>`;
  const clamp = p => Math.min(1, Math.max(0, p));
  const ease = p => { p = clamp(p); return p * p * (3 - 2 * p); };
  function image(id, x, y, w, h, crop, original) {
    const resource = $(id);
    if (!resource || !resource.complete || !resource.naturalWidth) throw new Error(`Missing image ${id}`);
    const clip = `${id}-${x}-${y}-clip`;
    return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${crop.join(" ")}" preserveAspectRatio="xMidYMid meet">` +
      `<defs><clipPath id="${clip}"><rect x="${crop[0]}" y="${crop[1]}" width="${crop[2]}" height="${crop[3]}"/></clipPath></defs>` +
      `<image clip-path="url(#${clip})" href="${esc(resource.getAttribute("src"))}" width="${original[0]}" height="${original[1]}"/></svg>`;
  }
  function sequence(name, seconds, x, y, w, h, state) {
    const record = captures[name];
    if (!record) throw new Error(`Missing capture ${name}`);
    const frame = Math.min(record.frames - 1, Math.max(0, Math.floor(seconds * record.fps)));
    const sheet = Math.floor(frame / 16), cell = frame % 16;
    state.capture = { name, frame, fps: record.fps, artifactHash: record.artifactHash,
      sourceFrame: record.firstSourceFrame === null ? null : record.firstSourceFrame + frame };
    return image(`capture-${name}-${sheet}`, x, y, w, h,
      [(cell % 4) * record.width, Math.floor(cell / 4) * record.height, record.width, record.height],
      [record.width * 4, record.height * 4]);
  }
  const pages = {
    purpose: ["01 · 项目与目的", "Aha! · 原来如此", "两个可移植技能，由你的 AI 宿主协调。", "依据：aha-research / aha-explain 技能定义"],
    "research-scope": ["02 · AHA RESEARCH", "先把问题问清楚，再决定查什么", "按问题选择来源路线；公开、提供材料和代码证据不能混为一谈。", "依据：共享研究流程 · aha-research 技能定义"],
    "research-loop": ["02 · AHA RESEARCH", "让证据改变结论，而不是只增加资料", "流程示意：优先检查会影响答案的关键前提。", "依据：共享研究流程 · 证据、反证、缺口与定向补查"],
    "research-boundaries": ["02 · AHA RESEARCH", "只读起步；事实、推断和授权分开", "这些是行为约束，不是操作系统沙箱。", "依据：共享执行与隐私规则 · 研究流程"],
    "research-delivery": ["02 · AHA RESEARCH", "研究本身，就是独立交付物", "研究结论不为视觉布局而改写；新证据对应新快照。", "依据：aha-research 技能定义 · 作品创作指南"],
    "explain-purpose": ["03 · AHA EXPLAIN", "按用途组织解释，不是换一个模板", "先检查已有研究的新鲜度与覆盖；不够时再补充研究。", "依据：aha-explain 技能定义 · 媒介独立创作"],
    "explain-language": ["03 · AHA EXPLAIN", "四种格式，明确的语言选择", "HTML 也可选择单语；研究语言独立，不因输出语言而重写研究。", "依据：作品语言契约 · 默认不等于只能如此"],
    "format-html": ["04 · 四种表达方式 · 1 / 4", "HTML：可交互，边操作边理解", "中文页面的操作录制 · 固定球面墨卡托投影 · 球面面积不变", "当前作品：greenland.html · Natural Earth / PROJ / D3"],
    "format-image": ["04 · 四种表达方式 · 2 / 4", "PNG：集中对照，便于回看", "英文原图 · 特定 CPython 3.11.15 示例 · 对象内存与 UTF-8 载荷是不同的量", "当前作品：cpython-string.png · PEP 393 / 既有 CPython 记录"],
    "format-slides": ["04 · 四种表达方式 · 3 / 4", "PPTX：原生可编辑，适合演示", "真实中文幻灯片 · PowerPoint 页面预览，非现场编辑演示", "当前作品：anc.pptx 第 2–3 页 · 原生结构与编辑检查见作品 QA"],
    "format-video": ["04 · 四种表达方式 · 4 / 4", "视频：用时间展示变化", "英文原片的真实片段，已静音 · 100 MB 为假设 · 未执行 Docker 构建", "当前作品：docker-layers.mp4 · Docker / OCI · 同 RUN 对比只针对新文件"],
    summary: ["05 · 总结", "先回答问题，再选择表达方式", "只请求研究，就交付研究；需要作品，再选择所需格式。", "两个技能由宿主协调，不是自动串联的流水线。"],
    install: ["05 · 欢迎使用", "把你的下一个问题，交给 Aha", "", ""]
  };
  window.ahaVideo = {
    async renderFrame(input) {
      const index = narration.findIndex(segment => segment.text === input.text);
      if (index < 0) throw new Error("Narration not in approved project.");
      const id = narration[index].id;
      const p = input.segmentFrames > 1 ? input.segmentFrame / (input.segmentFrames - 1) : 1;
      const showcase = id.startsWith("format-");
      document.documentElement.setAttribute("data-theme", "dark");
      document.documentElement.lang = "zh-CN";
      document.querySelector("main").classList.toggle("showcase", showcase);
      $("scene").setAttribute("viewBox", showcase ? "0 0 1280 382" : "0 0 1280 366");
      const page = pages[id];
      if (!page) throw new Error(`Unknown scene ${id}`);
      ["eyebrow", "heading", "note", "source"].forEach((name, i) => { $(name).textContent = page[i]; });
      const state = { sceneId: id, segmentIndex: input.segmentIndex, fullSegmentIndex: index,
        segmentFrame: input.segmentFrame, segmentFrames: input.segmentFrames, progress: p,
        language: "zh", timing: "frame-indexed-not-word-aligned", editingDemonstrated: false };
      let svg = "";
      if (id === "purpose") {
        svg = text(64, 92, "把复杂问题研究清楚。", "big") +
          text(64, 164, "把理解解释明白。", "big") +
          box(64, 235, 475, 104, p > .12) + text(92, 276, "aha-research", "strong accent") +
          text(92, 312, "研究问题 · 独立报告与档案") +
          box(690, 235, 526, 104, p > .42) + text(718, 276, "aha-explain", "strong accent") +
          text(718, 312, "组织解释 · 按需创作媒介") +
          text(590, 265, "宿主", "small center") + text(590, 294, "协调", "small center") +
          line(553, 314, 676, 314, p > .42);
      } else if (id === "research-scope") {
        svg = box(64, 55, 216, 124, true) + text(92, 102, "研究问题", "strong") + text(92, 144, "明确目的与范围", "small") +
          arrow(288, 118, 335, p > .15);
        ["要解释什么？", "哪项证据能区分？", "什么会推翻判断？"].forEach((label, i) => {
          svg += box(348, 12 + i * 98, 316, 78, p > .12 + i * .15) + text(371, 61 + i * 98, label);
        });
        svg += text(764, 48, "按授权与问题，选择来源", "label") +
          text(764, 110, "公开资料", p > .2 ? "strong accent" : "strong") +
          text(764, 171, "提供的文档", "strong") + text(764, 232, "授权代码库", "strong") +
          text(64, 341, "先拆问题，再选足以改变答案的一查。", "strong");
      } else if (id === "research-loop") {
        const checking = p >= .24, gap = p >= .44, revised = p >= .70;
        svg = box(64, 60, 216, 112, true) + text(92, 105, "研究问题", "strong") + text(92, 145, "保持问题锚点", "small") +
          arrow(286, 116, 328, true) +
          box(340, 60, 230, 112, checking) + text(364, 102, "关键假设") + text(364, 142, "允许被推翻", "small") +
          arrow(578, 116, 638, checking) +
          box(650, 60, 245, 112, checking) + text(674, 102, "支持 + 反证") + text(674, 142, "核对推理链", "small") +
          arrow(903, 116, 955, revised) +
          box(965, 60, 251, 112, revised) + text(989, 102, revised ? "收窄或修订" : "待检验的结论") +
          text(989, 142, revised ? "保留适用条件" : "不提前写成事实", "small") +
          line(773, 180, 773, 231, gap) +
          `<path d="M767 223L773 231L779 223" class="${gap ? "accent-line" : "line"}"/>` +
          text(799, 213, "关键缺口", "small") +
          box(650, 240, 245, 100, gap) + text(674, 281, "定向补查") + text(674, 316, "而非重复搜集", "small") +
          `<path d="M642 291H609V157H638M630 151L638 157L630 163" class="${gap ? "accent-line" : "line"}"/>` +
          text(965, 278, "仍然不知道？", "label") + text(965, 320, "明确说明未知与限制。", "small");
        state.researchPhase = revised ? "narrow-or-revise" : gap ? "targeted-follow-up" : checking ? "check-support-and-counterevidence" : "frame-question";
        if (gap && !revised) {
          const distance = ease((p - .44) / .26) * 196;
          const x = distance < 33 ? 642 - distance : distance < 167 ? 609 : 609 + distance - 167;
          const y = distance < 33 ? 291 : distance < 167 ? 291 - (distance - 33) : 157;
          svg += `<circle cx="${x}" cy="${y}" r="5" class="solid"/>`;
        }
      } else if (id === "research-boundaries") {
        svg = text(64, 46, "默认只读", "big accent") + text(64, 114, "不编造证据") +
          text(64, 162, "区分事实、推断和未知") + text(64, 210, "材料里的指令 ≠ 用户授权");
        ["执行代码", "安装软件", "对外发送内容"].forEach((label, i) => {
          const y = 12 + 104 * i;
          svg += box(644, y, 330, 82, p > i * .18) + text(670, y + 51, label) +
            line(990, y + 15, 990, y + 68, true) + text(1020, y + 49, "单独获准", "label accent");
        });
        svg += text(64, 337, "遵守边界，不把权限控制误说成隔离能力。", "strong");
      } else if (id === "research-delivery") {
        svg = box(64, 18, 530, 250, p > .1) + text(92, 70, "可读报告", "strong") +
          text(92, 124, "直接回答问题") + text(92, 171, "解释证据与结论的关系") + text(92, 218, "说明分歧与未知") +
          box(650, 18, 566, 250, p > .33) + text(678, 70, "独立研究档案", "strong") +
          text(678, 124, "来源与身份") + text(678, 171, "主张、证据与限制") + text(678, 218, "缺口与停止原因") +
          text(64, 336, "只要求调研 → 到这里交付。", "strong accent");
      } else if (id === "explain-purpose") {
        const selected = Math.min(3, Math.floor(clamp((p - .12) / .6) * 4));
        svg = box(64, 56, 386, 232, true) + text(92, 111, "研究档案", "strong") +
          text(92, 164, "检查新鲜度与覆盖") + text(92, 208, "按需补研究") +
          text(92, 254, "研究与作品保持独立", "small") +
          arrow(463, 177, 589, true) + text(525, 143, "按用途", "small center");
        [["HTML", "动手探索"], ["PNG", "集中对照"], ["PPTX", "编辑与演示"], ["视频", "追踪变化"]].forEach(([format, use], i) => {
          const x = 612 + (i % 2) * 310, y = 22 + Math.floor(i / 2) * 140;
          svg += box(x, y, 294, 118, selected === i) + text(x + 24, y + 44, format, "strong") +
            text(x + 24, y + 89, use);
        });
        svg += text(64, 344, "每次只做所需媒介，不默认生成四份。", "strong");
        state.selectedMedium = selected;
      } else if (id === "explain-language") {
        svg = box(64, 14, 1152, 139, true) + text(92, 63, "交互式 HTML", "strong") +
          text(518, 61, "默认：English / 中文", "strong accent") +
          text(518, 111, "初始英文；也可选择单语", "label");
        ["PNG 信息图", "原生 PPTX", "配音动态视频"].forEach((label, i) => {
          const x = 64 + 392 * i;
          svg += box(x, 185, 368, 155, p > .23) + text(x + 24, 229, label, "strong") +
            text(x + 24, 277, "默认英文 · 可明确选中文") +
            text(x + 24, 314, "分别生成单语言作品", "small");
        });
      } else if (id === "format-html") {
        svg = sequence("greenland", Math.max(0, input.segmentFrame / input.fps - .4), 64, 0, 872, 382, state) +
          text(980, 70, "格陵兰", "small accent") + text(980, 128, "移动") + text(980, 166, "控件") +
          text(980, 244, "观察") + text(980, 282, "响应");
      } else if (id === "format-image") {
        const zoom = ease((p - .12) / .25);
        const crop = [64 * zoom, 425 * zoom, 1800 - 128 * zoom, 1600 - 1068 * zoom];
        svg = image("preview-cpython", 64, 0, 240, 330, [0, 0, 1800, 1600], [1800, 1600]) +
          text(64, 365, "完整信息图", "small") + image("preview-cpython", 340, 0, 876, 366, crop, [1800, 1600]);
        state.image = { detailCrop: crop, originalUnchanged: true };
      } else if (id === "format-slides") {
        const number = p < .52 ? "02" : "03";
        svg = image(`preview-anc-${number}`, 64, 0, 678, 382, [0, 0, 1600, 900], [1600, 900]) +
          text(798, 60, "主动降噪", "small accent") +
          text(798, 122, number === "02" ? "先讲清楚关系。" : "再说明适用条件。") +
          text(798, 192, number === "02" ? "传入声压 + 控制声压" : "同样的时间误差，") +
          text(798, 230, number === "02" ? "→ 相加后的残余" : "不同的相位偏差") +
          text(798, 321, `实际第 ${Number(number)} 页 / 共 7 页`, "small") +
          text(798, 354, "原生文字、形状与表格", "tiny");
        state.slides = { page: Number(number), savedPageExport: true };
      } else if (id === "format-video") {
        svg = sequence("docker", input.segmentFrame / input.fps, 64, 0, 1152, 350, state) +
          text(64, 370, "视图改变了，先前存储的镜像层没有被改写。");
      } else if (id === "summary") {
        svg = text(64, 56, "同一个问题，按需要交付。", "big") +
          box(64, 103, 440, 186, true) + text(92, 158, "aha-research", "strong accent") +
          text(92, 211, "报告 + 独立研究档案") + text(92, 258, "只做研究，也是一份完整交付。", "small") +
          box(712, 103, 504, 186, p > .25) + text(740, 158, "aha-explain", "strong accent") +
          text(740, 211, "按用途创作所需作品") + text(740, 258, "HTML / PNG / PPTX / 视频", "small") +
          text(608, 164, "宿主协调", "small center") + text(608, 208, "按需选择", "small center") +
          text(64, 346, "先有依据，再让关系变得看得见。", "strong");
      } else if (id === "install") {
        svg = text(640, 160, "https://github.com/sawyer0x110/aha", "big center accent") +
          text(640, 260, "把链接交给你的 Agent，让它帮你安装。", "label center");
      }
      $("scene").innerHTML = svg;
      $("scene").setAttribute("aria-label", id === "install" ? "Aha 项目：https://github.com/sawyer0x110/aha" : page[1] + "。" + page[2]);
      window.overviewState = state;
    }
  };
})();
