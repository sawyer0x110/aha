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
    purpose: ["01 / PROJECT AND PURPOSE", "Aha! Now it makes sense", "Two portable skills, coordinated by your AI host.", "Source: aha-research / aha-explain skill definitions"],
    "research-scope": ["02 / AHA RESEARCH", "Clarify the question before choosing sources", "Choose sources for the question; public, supplied and code evidence are distinct.", "Source: shared research workflow / aha-research definition"],
    "research-loop": ["02 / AHA RESEARCH", "Let evidence change the conclusion", "Workflow illustration: prioritize assumptions that could change the answer.", "Source: shared workflow / evidence, counterevidence and targeted follow-up"],
    "research-boundaries": ["02 / AHA RESEARCH", "Read-only first. Permission stays separate.", "These are behavioral constraints, not an operating-system sandbox.", "Source: shared execution, privacy and research guidance"],
    "research-delivery": ["02 / AHA RESEARCH", "Research is a complete deliverable", "Do not rewrite findings for a layout; new evidence belongs in a new snapshot.", "Source: aha-research definition / artifact authoring guide"],
    "explain-purpose": ["03 / AHA EXPLAIN", "Design for the purpose, not a template", "Check existing research for freshness and coverage; investigate gaps when needed.", "Source: aha-explain definition / medium-specific authoring"],
    "explain-language": ["03 / AHA EXPLAIN", "Four formats. Clear language choices.", "HTML also supports one language. Output language does not rewrite the research.", "Source: artifact language contract / defaults are not the only choices"],
    "format-html": ["04 / FOUR WAYS TO EXPLAIN / 1 OF 4", "HTML: interact and explore", "Recorded English-page interaction / fixed spherical Mercator / constant spherical area", "Current artifact: greenland.html / Natural Earth / PROJ / D3"],
    "format-image": ["04 / FOUR WAYS TO EXPLAIN / 2 OF 4", "PNG: compare at a glance", "Original infographic / specific CPython 3.11.15 case / object memory differs from UTF-8 payload", "Current artifact: cpython-string.png / PEP 393 / recorded CPython observations"],
    "format-slides": ["04 / FOUR WAYS TO EXPLAIN / 3 OF 4", "PPTX: edit and present", "Original Chinese slides / actual PowerPoint page previews, not a live editing demonstration", "Current artifact: anc.pptx, pages 2-3 / native structure and edit checks in artifact QA"],
    "format-video": ["04 / FOUR WAYS TO EXPLAIN / 4 OF 4", "Video: follow change over time", "Actual muted excerpt / illustrative 100 MB payload / no Docker build was executed", "Current artifact: docker-layers.mp4 / Docker / OCI / same-RUN case applies to new files only"],
    summary: ["05 / RECAP", "Answer first. Then choose the medium.", "Research-only requests stop with research. Choose formats when you need artifacts.", "The host coordinates two skills; they are not an automatic pipeline."],
    install: ["05 / WELCOME TO AHA", "Bring your next question to Aha", "", ""]
  };
  window.ahaVideo = {
    async renderFrame(input) {
      const index = narration.findIndex(segment => segment.text === input.text);
      if (index < 0) throw new Error("Narration not in approved project.");
      const id = narration[index].id;
      const p = input.segmentFrames > 1 ? input.segmentFrame / (input.segmentFrames - 1) : 1;
      const showcase = id.startsWith("format-");
      document.documentElement.setAttribute("data-theme", "dark");
      document.documentElement.lang = "en";
      document.querySelector("main").classList.toggle("showcase", showcase);
      $("scene").setAttribute("viewBox", showcase ? "0 0 1280 382" : "0 0 1280 366");
      const page = pages[id];
      if (!page) throw new Error(`Unknown scene ${id}`);
      ["eyebrow", "heading", "note", "source"].forEach((name, i) => { $(name).textContent = page[i]; });
      const state = { sceneId: id, segmentIndex: input.segmentIndex, fullSegmentIndex: index,
        segmentFrame: input.segmentFrame, segmentFrames: input.segmentFrames, progress: p,
        language: "en", timing: "frame-indexed-not-word-aligned", editingDemonstrated: false };
      let svg = "";
      if (id === "purpose") {
        svg = text(64, 92, "Investigate complex questions.", "big") +
          text(64, 164, "Make understanding clear.", "big") +
          box(64, 235, 475, 104, p > .12) + text(92, 276, "aha-research", "strong accent") +
          text(92, 312, "Investigate / report and dossier") +
          box(690, 235, 526, 104, p > .42) + text(718, 276, "aha-explain", "strong accent") +
          text(718, 312, "Explain / create requested media") +
          text(590, 265, "Host", "small center") + text(590, 294, "coordinates", "small center") +
          line(553, 314, 676, 314, p > .42);
      } else if (id === "research-scope") {
        svg = box(64, 55, 216, 124, true) + text(92, 102, "Question", "strong") + text(92, 144, "Purpose and scope", "small") +
          arrow(288, 118, 335, p > .15);
        ["What needs explaining?", "Which evidence matters?", "What could disprove it?"].forEach((label, i) => {
          svg += box(348, 12 + i * 98, 316, 78, p > .12 + i * .15) + text(371, 61 + i * 98, label);
        });
        svg += text(764, 48, "Choose authorized sources", "label") +
          text(764, 110, "Public information", p > .2 ? "strong accent" : "strong") +
          text(764, 171, "Supplied documents", "strong") + text(764, 232, "Authorized code", "strong") +
          text(64, 341, "Break down the question. Follow what could change the answer.", "strong");
      } else if (id === "research-loop") {
        const checking = p >= .24, gap = p >= .44, revised = p >= .70;
        svg = box(64, 60, 216, 112, true) + text(92, 105, "Question", "strong") + text(92, 145, "Keep the goal fixed", "small") +
          arrow(286, 116, 328, true) +
          box(340, 60, 230, 112, checking) + text(364, 102, "Key assumption") + text(364, 142, "Open to disproof", "small") +
          arrow(578, 116, 638, checking) +
          box(650, 60, 245, 112, checking) + text(674, 102, "For and against") + text(674, 142, "Check the reasoning", "small") +
          arrow(903, 116, 955, revised) +
          box(965, 60, 251, 112, revised) + text(989, 102, revised ? "Narrow or revise" : "Provisional claim") +
          text(989, 142, revised ? "Keep its conditions" : "Not yet a fact", "small") +
          line(773, 180, 773, 231, gap) +
          `<path d="M767 223L773 231L779 223" class="${gap ? "accent-line" : "line"}"/>` +
          text(799, 213, "Key gap", "small") +
          box(650, 240, 245, 100, gap) + text(674, 281, "Targeted follow-up") + text(674, 316, "Not more of the same", "small") +
          `<path d="M642 291H609V157H638M630 151L638 157L630 163" class="${gap ? "accent-line" : "line"}"/>` +
          text(965, 278, "Still unknown?", "label") + text(965, 320, "State what is uncertain.", "small");
        state.researchPhase = revised ? "narrow-or-revise" : gap ? "targeted-follow-up" : checking ? "check-support-and-counterevidence" : "frame-question";
        if (gap && !revised) {
          const distance = ease((p - .44) / .26) * 196;
          const x = distance < 33 ? 642 - distance : distance < 167 ? 609 : 609 + distance - 167;
          const y = distance < 33 ? 291 : distance < 167 ? 291 - (distance - 33) : 157;
          svg += `<circle cx="${x}" cy="${y}" r="5" class="solid"/>`;
        }
      } else if (id === "research-boundaries") {
        svg = text(64, 46, "Read-only by default", "big accent") + text(64, 114, "Do not invent evidence") +
          text(64, 162, "Separate facts, inference and unknowns") + text(64, 210, "Source instructions are not permission");
        ["Run code", "Install software", "Send content outside"].forEach((label, i) => {
          const y = 12 + 104 * i;
          svg += box(644, y, 330, 82, p > i * .18) + text(670, y + 51, label) +
            line(990, y + 15, 990, y + 68, true) + text(1020, y + 49, "Approval", "label accent");
        });
        svg += text(64, 337, "Permission boundaries are not system isolation.", "strong");
      } else if (id === "research-delivery") {
        svg = box(64, 18, 530, 250, p > .1) + text(92, 70, "Readable report", "strong") +
          text(92, 124, "Answer the question") + text(92, 171, "Connect evidence to conclusions") + text(92, 218, "Explain disagreement and unknowns") +
          box(650, 18, 566, 250, p > .33) + text(678, 70, "Independent dossier", "strong") +
          text(678, 124, "Sources and identity") + text(678, 171, "Claims, evidence and limitations") + text(678, 218, "Gaps and reasons to stop") +
          text(64, 336, "Asked for research only? Deliver it here.", "strong accent");
      } else if (id === "explain-purpose") {
        const selected = Math.min(3, Math.floor(clamp((p - .12) / .6) * 4));
        svg = box(64, 56, 386, 232, true) + text(92, 111, "Research dossier", "strong") +
          text(92, 164, "Check freshness and coverage") + text(92, 208, "Investigate remaining gaps") +
          text(92, 254, "Keep research independent", "small") +
          arrow(463, 177, 589, true) + text(525, 143, "By purpose", "small center");
        [["HTML", "Explore"], ["PNG", "Compare"], ["PPTX", "Edit and present"], ["Video", "Follow change"]].forEach(([format, use], i) => {
          const x = 612 + (i % 2) * 310, y = 22 + Math.floor(i / 2) * 140;
          svg += box(x, y, 294, 118, selected === i) + text(x + 24, y + 44, format, "strong") +
            text(x + 24, y + 89, use);
        });
        svg += text(64, 344, "Create the requested formats, not all four by default.", "strong");
        state.selectedMedium = selected;
      } else if (id === "explain-language") {
        svg = box(64, 14, 1152, 139, true) + text(92, 63, "Interactive HTML", "strong") +
          text(518, 61, "Default: English / Chinese", "strong accent") +
          text(518, 111, "Starts in English; one language is also an option", "label");
        ["PNG infographic", "Native PPTX", "Narrated video"].forEach((label, i) => {
          const x = 64 + 392 * i;
          svg += box(x, 185, 368, 155, p > .23) + text(x + 24, 229, label, "strong") +
            text(x + 24, 277, "Default: English") +
            text(x + 24, 314, "Chinese on request / one language", "small");
        });
      } else if (id === "format-html") {
        svg = sequence("greenland", Math.max(0, input.segmentFrame / input.fps - .4), 64, 0, 872, 382, state) +
          text(980, 70, "Greenland", "small accent") + text(980, 128, "Move the") + text(980, 166, "control") +
          text(980, 244, "Watch the") + text(980, 282, "response");
      } else if (id === "format-image") {
        const zoom = ease((p - .12) / .25);
        const crop = [64 * zoom, 425 * zoom, 1800 - 128 * zoom, 1600 - 1068 * zoom];
        svg = image("preview-cpython", 64, 0, 240, 330, [0, 0, 1800, 1600], [1800, 1600]) +
          text(64, 365, "Full infographic", "small") + image("preview-cpython", 340, 0, 876, 366, crop, [1800, 1600]);
        state.image = { detailCrop: crop, originalUnchanged: true };
      } else if (id === "format-slides") {
        const number = p < .52 ? "02" : "03";
        svg = image(`preview-anc-${number}`, 64, 0, 678, 382, [0, 0, 1600, 900], [1600, 900]) +
          text(798, 60, "Noise cancellation", "small accent") +
          text(798, 122, number === "02" ? "Show the relationship." : "Then explain the limits.") +
          text(798, 192, number === "02" ? "Incoming + control" : "Same timing error,") +
          text(798, 230, number === "02" ? "sound -> residual" : "different phase error") +
          text(798, 321, `Slide ${Number(number)} / 7`, "small") +
          text(798, 354, "Native text, shapes and tables", "tiny");
        state.slides = { page: Number(number), savedPageExport: true };
      } else if (id === "format-video") {
        svg = sequence("docker", input.segmentFrame / input.fps, 64, 0, 1152, 350, state) +
          text(64, 370, "The view changes. The earlier layer is not rewritten.");
      } else if (id === "summary") {
        svg = text(64, 56, "One question. Deliver what is needed.", "big") +
          box(64, 103, 440, 186, true) + text(92, 158, "aha-research", "strong accent") +
          text(92, 211, "Report + independent dossier") + text(92, 258, "Research alone is a complete delivery.", "small") +
          box(712, 103, 504, 186, p > .25) + text(740, 158, "aha-explain", "strong accent") +
          text(740, 211, "Create for the intended use") + text(740, 258, "HTML / PNG / PPTX / video", "small") +
          text(608, 164, "Host coordinates", "small center") + text(608, 208, "Choose as needed", "small center") +
          text(64, 346, "Start with evidence. Make the relationships visible.", "strong");
      } else if (id === "install") {
        svg = text(640, 160, "https://github.com/sawyer0x110/aha", "big center accent") +
          text(640, 260, "Give the link to your agent and ask it to help you install.", "label center");
      }
      $("scene").innerHTML = svg;
      $("scene").setAttribute("aria-label", id === "install" ? "Aha project: https://github.com/sawyer0x110/aha" : page[1] + ". " + page[2]);
      window.overviewState = state;
    }
  };
})();
