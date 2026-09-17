(() => {
  "use strict";
  const baseRender = window.ahaVideo.renderFrame;
  const sourceIndices = [0, 1, null, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const sections = {
    2: { number: "01", category: "EVERYDAY PHENOMENA", name: "Greenland", question: "Why does a map make land look larger?" },
    4: { number: "02", category: "CODE MECHANISMS", name: "CPython", question: "Why can one added face widen an entire string?" },
    6: { number: "03", category: "ENGINEERING BEHAVIOR", name: "Docker", question: "Why can a deleted file leave its bytes behind?" }
  };
  const $ = id => document.getElementById(id);
  const clamp = value => Math.min(1, Math.max(0, value));
  const ease = value => { const p = clamp(value); return p * p * (3 - 2 * p); };
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
  const text = (x, y, value, cls = "label") => `<text x="${x}" y="${y}" class="${cls}">${esc(value)}</text>`;
  function bridge(progress) {
    const names = [["01", "Greenland", "Everyday phenomena"], ["02", "CPython", "Code mechanisms"], ["03", "Docker", "Engineering behavior"]];
    return text(64,48,"Three examples. Three kinds of questions.","strong") +
      names.map(([number, name, category], index) => {
        const x = 64 + index * 392, reveal = ease((progress - index * .13) / .42);
        return `<g opacity="${.3+.7*reveal}" transform="translate(0,${18*(1-reveal)})">` +
          `<rect x="${x}" y="84" width="352" height="194" rx="10" class="box"/>` +
          text(x+24,142,number,"strong accent") + text(x+24,198,name,"strong") +
          text(x+24,244,category,"small") + "</g>";
      }).join("") + text(64,338,"See what changes, what stays fixed, and why.","label");
  }
  window.ahaVideo = {
    async renderFrame(input) {
      const index = input.segmentIndex;
      if (!Number.isInteger(index) || index < 0 || index >= sourceIndices.length) throw new Error("Unknown introduction chapter.");
      const p = input.segmentFrames > 1 ? clamp(input.segmentFrame / (input.segmentFrames - 1)) : 1;
      const sourceIndex = sourceIndices[index];
      if (sourceIndex === null) {
        document.documentElement.setAttribute("data-theme", "dark");
        $("heading").textContent = "See Aha in action";
        $("eyebrow").textContent = "AHA · FROM INTRODUCTION TO EXAMPLES";
        $("note").textContent = "Three different questions, explained through their underlying mechanisms.";
        $("source").textContent = "Sources: Greenland, CPython and Docker research.";
        $("scene").innerHTML = bridge(p);
        $("scene").setAttribute("aria-label", "Three examples: Greenland, CPython and Docker.");
        window.overviewState = {
          sceneId: "three-examples", segmentIndex: index, sourceSceneIndex: null,
          frame: input.frame, fps: input.fps, segmentFrame: input.segmentFrame, segmentFrames: input.segmentFrames,
          progress: p, theme: "dark", examples: ["Greenland", "CPython", "Docker"],
          projectIntroductionOnly: false, bridgeBeforeExamples: true, approvedNarration: input.text
        };
        return;
      }
      const chapter = sections[sourceIndex] ?? (input.pilotChapterEntry && sourceIndex === 3 ? sections[2] : null);
      const mechanismProgress = chapter ? clamp((p-.16)/.84) : p;
      await baseRender({
        ...input, segmentIndex: sourceIndex,
        segmentFrame: Math.round(mechanismProgress * Math.max(0, input.segmentFrames-1))
      });
      if (chapter) {
        const diagramOpacity = ease((p-.08)/.1);
        const diagram = $("scene").innerHTML;
        $("scene").innerHTML =
          `<g opacity="${diagramOpacity}" transform="translate(${28*(1-diagramOpacity)},0)">${diagram}</g>` +
          `<g opacity="${1-diagramOpacity}" transform="translate(${-24*diagramOpacity},0)">` +
          text(64,76,`${chapter.number} · ${chapter.category}`,"label accent") +
          text(64,171,chapter.name,"number") +
          text(64,252,chapter.question,"strong") + "</g>";
        $("eyebrow").textContent = `${chapter.number} · ${chapter.category}`;
      }
      Object.assign(window.overviewState, {
        sourceSceneIndex: sourceIndex, segmentIndex: index, progress: p,
        segmentFrame: input.segmentFrame, projectIntroductionOnly: index < 2,
        chapterTransition: chapter ? { section: chapter.name, progress: ease((p-.08)/.1), mechanismProgress } : null
      });
    }
  };
})();
