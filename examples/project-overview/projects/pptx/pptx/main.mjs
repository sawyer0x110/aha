// Local, native-object authoring only. The supplied runtime owns file writing.
// Slide IDs below are the coverage locators in artifact.json.
export default async function ({ pptx, research }) {
  const C = {
    cream: 'F7F2E9', paper: 'FFFCF6', berry: '6D2E46', rose: 'A26769',
    charcoal: '292629', ink: '332E31', muted: '655B60', pale: 'ECE2D0',
    pink: 'EACBD5', rule: 'CDBFBE', white: 'FFFFFF',
  };
  const BASE = 'https://github.com/sawyer0x110/aha/blob/a013ea795312eab9ae2e4224998a1314eea8f718/';
  const FONT = 'Segoe UI';
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Aha';
  pptx.subject = 'An introduction to Aha at repository commit a013ea7';
  pptx.title = 'Aha: traceable research, freely authored explanations';
  pptx.company = 'Aha project';
  pptx.lang = 'en-US';
  pptx.theme = {
    headFontFace: FONT, bodyFontFace: FONT, lang: 'en-US',
  };

  function text(s, content, x, y, w, h, size = 20, color = C.ink, extra = {}) {
    s.addText(content, {
      x, y, w, h, fontFace: FONT, fontSize: size, color, margin: 0,
      breakLine: false, valign: 'top', paraSpaceAfterPt: 0,
      ...extra,
    });
  }
  function rect(s, x, y, w, h, fill, border = fill) {
    s.addShape('rect', {
      x, y, w, h, fill: { color: fill }, line: { color: border, width: 0.7 },
    });
  }
  function line(s, x, y, w, color = C.rule) {
    s.addShape('line', { x, y, w, h: 0, line: { color, width: 0.8 } });
  }
  function arrow(s, x, y, w, color = C.berry) {
    s.addShape('chevron', {
      x, y, w, h: 0.28, fill: { color }, line: { color, transparency: 100 },
    });
  }
  function label(s, content, x, y, w, color = C.berry) {
    text(s, content, x, y, w, 0.28, 11, color, { bold: true, charSpacing: 1.5 });
  }
  function heading(s, chapter, title) {
    label(s, chapter, 0.6, 0.42, 12);
    text(s, title, 0.6, 0.92, 12.05, 0.72, 33, C.berry, { bold: true });
  }
  function footer(s, number, references, dark = false) {
    const color = dark ? C.pink : C.muted;
    text(s, `AHA  /  ${references}`, 0.6, 6.91, 11.25, 0.28, 11, color);
    text(s, `${String(number).padStart(2, '0')} / 09`, 11.9, 6.91, 0.83, 0.28, 11, color, { align: 'right' });
  }
  function notes(s, id, body, sources) {
    s.addNotes([
      `${id}\n${body}`,
      'Research scope: fixed repository commit a013ea795312eab9ae2e4224998a1314eea8f718; reviewed 2026-09-15. Runtime 0.3.0; research/artifact protocol 1.0.0.',
      `Bound Research Dossier: ${research.id}. The companion render receipt records its content hash. This deck translates the supported conclusions into English; it does not alter the research snapshot.`,
      `Fixed repository references:\n${sources.map((source) => BASE + source).join('\n')}`,
    ]);
  }
  function slide(dark = false) {
    const s = pptx.addSlide();
    s.background = { color: dark ? C.charcoal : C.cream };
    return s;
  }

  // slide-01-purpose
  {
    const s = slide(true);
    label(s, 'PROJECT INTRODUCTION  /  15 SEP 2026', 0.6, 0.48, 10, C.pink);
    text(s, 'Aha', 0.6, 1.04, 6.3, 1.08, 72, C.cream, { bold: true });
    text(s, 'Traceable research.\nFreely authored explanations.', 0.64, 2.3, 7.2, 1.65, 35, C.cream, { bold: true });
    text(s, 'Investigate a question, then choose how to explain it.\nKeep the evidence separate from the medium.', 0.65, 4.27, 6.9, 1.06, 22, C.pale);

    rect(s, 8.5, 1.4, 4.23, 4.46, C.berry);
    label(s, 'ONE RESEARCH BASIS', 8.83, 1.76, 3.5, C.pink);
    text(s, 'Sources + claims\n+ stated gaps', 8.83, 2.22, 3.5, 1.05, 26, C.cream, { bold: true });
    s.addShape('downArrow', {
      x: 10.33, y: 3.52, w: 0.4, h: 0.43,
      fill: { color: C.pink }, line: { color: C.pink, transparency: 100 },
    });
    text(s, 'HTML   /   PNG\nPPTX   /   Video', 8.83, 4.25, 3.5, 0.94, 23, C.cream);
    text(s, 'Separately authored.\nNot automatic conversion.', 8.83, 5.1, 3.48, 0.65, 18, C.pale, { bold: true });

    text(s, 'Source-first—not an automated truth engine or an “all formats” command.', 0.65, 6.22, 12, 0.44, 19, C.pink);
    footer(s, 1, 'README · Architecture  |  runtime 0.3.0 · protocol 1.0.0', true);
    notes(s, 'slide-01-purpose',
      'Aha combines two portable Skills and a local runtime. The host Agent performs investigation and content design. Shared factual grounding does not imply shared layouts or automatic all-format generation. The diagram shows reuse of research, not a one-click conversion pipeline.',
      ['README.md#L1-L39', 'docs/ARCHITECTURE.md#L1-L136']);
  }

  // slide-02-responsibilities
  {
    const s = slide();
    heading(s, '01  /  RESPONSIBILITIES', 'Two Skills guide the work; the runtime executes it');
    text(s, 'Choose the entry by the final deliverable—not by an assumed automatic handoff.', 0.6, 1.82, 12, 0.45, 20);
    const cols = [
      { x: 0.6, tag: 'REPORT OR INVESTIGATION', name: 'aha-research',
        body: 'Break down the question, collect evidence, test competing explanations, and synthesize a supported answer.',
        end: 'Delivers a Research Dossier and readable report.' },
      { x: 6.82, tag: 'VISUAL EXPLANATION', name: 'aha-explain',
        body: 'Reuse suitable research—or research first—then design and author the requested medium.',
        end: 'Delivers editable source, output, and candid QA.' },
    ];
    for (const col of cols) {
      rect(s, col.x, 2.6, 5.9, 2.63, C.paper);
      label(s, col.tag, col.x + 0.28, 2.86, 5.34);
      text(s, col.name, col.x + 0.28, 3.3, 5.3, 0.43, 24, C.berry, { fontFace: 'Consolas', bold: true });
      text(s, col.body, col.x + 0.28, 3.91, 5.25, 0.84, 18);
      text(s, col.end, col.x + 0.28, 4.79, 5.25, 0.4, 16, C.muted);
    }
    rect(s, 0.6, 5.65, 12.12, 1.04, C.berry);
    text(s, 'LOCAL RUNTIME', 0.9, 5.9, 2.22, 0.46, 17, C.cream, { bold: true });
    text(s, 'Checks contracts and identity; packages resources and renders.\nIt does not establish that a source supports a conclusion.', 3.35, 5.87, 8.95, 0.61, 18, C.cream);
    footer(s, 2, 'Research Skill · Explain Skill · README');
    notes(s, 'slide-02-responsibilities',
      'The two Skills share research guidance; aha-explain does not depend on the host automatically dispatching a task to aha-research. Reports can be complete deliverables without slides. Structural checks are not source-support review or evidence of host discovery.',
      ['skills/aha-research/SKILL.md#L1-L23', 'skills/aha-explain/SKILL.md#L1-L22', 'README.md#L31-L39']);
  }

  // slide-03-identity
  {
    const s = slide();
    heading(s, '02  /  IDENTITY', 'Bind research and source to the rendered result');
    text(s, 'Identity lets you answer “Which inputs produced this file?” It cannot answer “Is it true?”', 0.6, 1.82, 12, 0.53, 20);
    const stages = [
      { x: 0.6, n: '01', title: 'Research Dossier', code: 'manifest.json\nresearch.json\nreport.md',
        detail: 'Claims, evidence and gaps remain independent of any medium.' },
      { x: 4.84, n: '02', title: 'Artifact project', code: 'artifact.json\neditable medium source\nbound research copy',
        detail: 'Each claim is mapped to content or explicitly omitted with a reason.' },
      { x: 9.08, n: '03', title: 'Output + receipt', code: 'researchHash\nsourceHash\noutputHash',
        detail: 'For HTML, PNG and PPTX, the receipt binds the result to its inputs.' },
    ];
    for (const stage of stages) {
      rect(s, stage.x, 2.66, 3.65, 2.88, C.paper);
      label(s, stage.n, stage.x + 0.24, 2.89, 0.45);
      text(s, stage.title, stage.x + 0.24, 3.27, 3.17, 0.38, 21, C.berry, { bold: true });
      text(s, stage.code, stage.x + 0.24, 3.91, 3.17, 0.85, 16, C.ink, { fontFace: 'Consolas' });
      text(s, stage.detail, stage.x + 0.24, 4.89, 3.17, 0.52, 13.5, C.muted);
    }
    arrow(s, 4.4, 3.96, 0.27);
    arrow(s, 8.64, 3.96, 0.27);
    text(s, 'BIND', 4.3, 3.59, 0.5, 0.25, 10, C.berry, { bold: true, align: 'center' });
    text(s, 'RENDER', 8.51, 3.59, 0.54, 0.25, 9, C.berry, { bold: true, align: 'center' });
    text(s, 'After an edit', 0.6, 5.94, 2.3, 0.42, 22, C.berry, { bold: true });
    text(s, 'Rebuild the corresponding candidate; keep an old output as history, not as proof of new source.\nVideo adds a separate plan, audio, and output identity chain.', 3.12, 5.92, 9.56, 0.78, 18);
    footer(s, 3, 'Dossier implementation · Artifact contract · Render receipts · Video plan');
    notes(s, 'slide-03-identity',
      'Research Dossier files store the independent report and its content identity. Artifact metadata declares one format, entry, language, dimensions, researchHash, coverage and omissions. Every claim must be covered or explicitly omitted. The coverage map is an author declaration, not semantic proof. Hashes detect identity changes, not truth. HTML/PNG/PPTX receipts and the separate video chain should not be conflated. Research changes require a new snapshot and deliberate rebinding.',
      ['src/research/dossier.ts#L183-L225', 'src/artifacts/project.ts#L90-L168', 'src/artifacts/render.ts#L39-L81', 'src/media/plan.ts#L58-L101', 'docs/ARCHITECTURE.md#L1-L136']);
  }

  // slide-04-media
  {
    const s = slide();
    heading(s, '03  /  MEDIA CHOICE', 'Share the facts—not a fixed page layout');
    text(s, 'One project declares one format. Request several outputs only when each serves a different use.', 0.6, 1.82, 12, 0.48, 20);
    const rows = [
      ['MEDIUM', 'READER’S SITUATION', 'WHAT THE AUTHOR BUILDS', 'WHAT NOT TO ASSUME'],
      ['HTML', 'Explore at a chosen pace', 'Rich text, SVG / Mermaid,\nand local interactions', 'Packaging is not script execution\nor browser QA.'],
      ['PNG', 'Scan a fixed-size visual', 'A composition made for\nthe capture viewport', 'A shrunken long article is not\na readable one-image explanation.'],
      ['PPTX', 'Follow a sequence;\nedit the explanation', 'Native text, shapes,\ntables, and charts', 'Whole-slide screenshots are not\nnative slide authoring.'],
      ['Video', 'See a mechanism change\nover time', 'Frame-driven scenes aligned\nto actual audio; captions + SRT', 'Encoding is not proof of\nplayback or listening quality.'],
    ];
    const table = rows.map((row, ri) => row.map((value, ci) => ({
      text: value,
      options: {
        bold: ri === 0 || ci === 0,
        color: ri === 0 ? C.cream : ci === 0 ? C.berry : C.ink,
        fill: ri === 0 ? C.berry : ri % 2 ? C.paper : C.pale,
      },
    })));
    s.addTable(table, {
      x: 0.6, y: 2.68, w: 12.12,
      colW: [1.18, 3.05, 3.94, 3.95],
      rowH: [0.52, 0.75, 0.75, 0.75, 0.75],
      fontFace: FONT, fontSize: 16, margin: [0.12, 0.16, 0.12, 0.16],
      border: { color: C.cream, pt: 2 }, valign: 'mid',
      autoPage: false,
    });
    text(s, 'Re-authoring preserves the explanation’s logic while changing its reading path.', 0.6, 6.4, 12, 0.38, 22, C.berry, { bold: true });
    footer(s, 4, 'README · Architecture · Artifact project contract');
    notes(s, 'slide-04-media',
      'The four rows compare authoring approaches, not measured performance or guaranteed outcomes. HTML supports bundled local assets and offline interactions. PNG must be composed for the intended dimensions. PPTX uses the supplied PptxGenJS instance and native objects. Video is an authored deterministic frame callback; actual audio duration drives frames and captions, with burned subtitles and SRT. Multiple formats require separately authored projects; there is no auto/all command.',
      ['README.md#L23-L39', 'docs/ARCHITECTURE.md#L1-L136', 'src/artifacts/project.ts#L90-L168']);
  }

  // slide-demo-static
  {
    const s = slide();
    heading(s, '04  /  ACTUAL EXAMPLES', 'One project: an exploratory page and a composed poster');
    text(s, 'These are the companion artifacts made from this same research—not generic format icons.', 0.6, 1.8, 12, 0.48, 20);
    label(s, 'HTML  /  CHOOSE A FORMAT', 0.6, 2.47, 7.8);
    s.addImage({ path: 'assets/html-example.png', x: 0.6, y: 2.8, w: 7.85, h: 7.85 * 490 / 1096, altText: 'Actual HTML section showing four format selectors and an explanation of HTML authoring.' });
    text(s, 'Offline controls; English / Chinese. Open the HTML to interact.', 0.6, 6.42, 7.85, 0.3, 16);
    label(s, 'PNG  /  READ THE WHOLE PATH', 8.92, 2.47, 3.8);
    s.addImage({ path: 'assets/image-example.png', x: 9.53, y: 2.9, w: 1.95, h: 3.25, altText: 'Actual portrait infographic, shown as a thumbnail; open the companion PNG to read it at full size.' });
    text(s, 'A purpose-built 1080 × 1800 composition.\nThumbnail here; full size in the example.', 8.92, 6.2, 3.8, 0.5, 14, C.muted);
    footer(s, 5, 'Actual companion HTML and PNG · shared research, separately designed layouts');
    notes(s, 'slide-demo-static',
      'The image on the left is a capture of the actual delivered HTML format-selector section. Its controls are interactive in the HTML, not in this screenshot. The right-hand thumbnail is the actual separately authored poster. It is intentionally a thumbnail and is not presented as readable full-size poster text. The current slide remains native editable text plus supporting raster previews. These example-specific observations are production evidence, not additional general claims about Aha.',
      ['src/artifacts/project.ts#L90-L168', 'docs/ARCHITECTURE.md#L51-L89']);
  }

  // slide-demo-motion
  {
    const s = slide();
    heading(s, '05  /  PPTX: SILENT ILLUSTRATION', 'Watch a source revision change, then an approval gate open');
    s.addImage({ path: 'assets/motion-preview.gif', x: 0.6, y: 2.03, w: 8.1, h: 4.56, altText: 'Animated eight-second loop: source revision A becomes B and the output is rebuilt; then approved narration passes a gate.' });
    label(s, 'THE PPTX EXAMPLE IS THIS SLIDE', 9.04, 2.07, 3.68);
    text(s, 'Native text stays editable.\nThe motion is an embedded GIF.', 9.04, 2.52, 3.58, 0.94, 23, C.berry, { bold: true });
    text(s, 'Play in a slideshow to see the loop. A static preview may show only its first frame.', 9.04, 3.82, 3.58, 0.96, 19);
    text(s, 'This loop illustrates source changes and approval. It is separate from the narrated ANC and Git walkthrough.', 9.04, 5.05, 3.58, 1.34, 17, C.muted);
    footer(s, 6, 'Actual frame-driven scenes · silent 8 s preview · not an embedded narrated MP4');
    notes(s, 'slide-demo-motion',
      'PptxGenJS does not expose a native animation/transition API in this locked version. This example therefore embeds a genuine multi-frame GIF as a supporting animated image instead of inventing APIs, rewriting runtime receipts, or rasterizing the entire slide. Native headings and explanatory text remain editable; the animated illustration is edited through projects/motion-preview and regenerated. The GIF replays source/receipt revision and exact-plan approval scenes. These are independent illustrations, not scenes from the final narrated ANC/Git video. Its illustrative duration is 8 seconds at 15 fps, not real speech timing. Static renderers may display only a still frame; slideshow playback requires a compatible presentation app.',
      ['src/artifacts/render.ts#L203-L251', 'src/media/plan.ts#L58-L101', 'skills/aha-explain/references/video.md']);
  }

  // slide-05-permissions
  {
    const s = slide();
    heading(s, '06  /  PERMISSION BOUNDARIES', 'Separate local execution from online narration');
    text(s, 'A request for a visual artifact does not authorize arbitrary code or external speech services.', 0.6, 1.82, 12, 0.48, 20);
    rect(s, 0.6, 2.61, 5.9, 3.25, C.paper);
    rect(s, 6.82, 2.61, 5.9, 3.25, C.berry);
    label(s, 'LOCAL EXECUTION  /  NOT A SANDBOX', 0.9, 2.92, 5.2);
    text(s, 'Review the source,\nthen approve execution.', 0.9, 3.41, 5.16, 0.87, 26, C.berry, { bold: true });
    text(s, 'Browser rendering and the PPTX author module run code. Node has host privileges; a flag or timeout is not an OS sandbox.', 0.9, 4.63, 5.12, 0.98, 18);
    label(s, 'EXTERNAL VOICE  /  EXACT-PLAN APPROVAL', 7.12, 2.92, 5.2, C.pink);
    text(s, 'Approve the exact plan\nand its external disclosure.', 7.12, 3.41, 5.16, 0.87, 26, C.cream, { bold: true });
    text(s, 'For online TTS, approve the full narration, provider, voice, rate, and plan hash. Changed bindings require renewed review.', 7.12, 4.63, 5.12, 0.98, 18, C.cream);
    label(s, 'IMPORTANT DISTINCTION', 0.6, 6.17, 2.7);
    text(s, 'HTML packaging does not execute author scripts. Online service availability remains unproven until observed.', 3.45, 6.12, 9.25, 0.62, 18);
    footer(s, 7, 'Execution contract · Render implementation · Video plan identity');
    notes(s, 'slide-05-permissions',
      'Local --allow-code permission must follow review of the current code and capabilities. Browser request restrictions do not isolate arbitrary Node code. HTML packaging itself does not execute authored scripts. Online Edge TTS separately requires approval of the complete current narration plan, provider, voice, rate, disclosure scope, and exact planHash; external network authorization is also separate. Plan/source mismatches are rejected. Source or voice changes cannot be authorized by hand-editing a hash. This introduction reports the contract, not a successful live TTS run.',
      ['skills/shared/references/execution.md#L1-L41', 'src/artifacts/render.ts#L39-L81', 'src/media/plan.ts#L58-L101']);
  }

  // slide-06-language-distribution
  {
    const s = slide();
    heading(s, '07  /  LANGUAGE & DISTRIBUTION', 'Language and packaging change how Aha travels');
    label(s, 'LANGUAGE CHANGES EXPRESSION', 0.6, 2.05, 5.6);
    text(s, 'It does not rewrite the research snapshot.', 0.6, 2.48, 5.55, 0.8, 25, C.berry, { bold: true });
    const languageRows = [
      ['New HTML', 'Bilingual; English shown first'],
      ['New PNG / PPTX / video', 'English by default'],
      ['Explicit Chinese choice', 'Chinese artifact; same research'],
    ];
    languageRows.forEach(([name, value], i) => {
      const y = 3.52 + i * 0.78;
      line(s, 0.6, y - 0.17, 5.63);
      text(s, name, 0.6, y, 2.58, 0.47, 16, C.berry, { bold: true });
      text(s, value, 3.37, y, 2.86, 0.56, 16);
    });
    text(s, 'The Agent writes and reviews translations.\nA language field is not translation certification.', 0.6, 6.15, 5.65, 0.59, 16, C.muted);

    rect(s, 6.84, 2.05, 5.88, 4.65, C.paper);
    label(s, 'DISTRIBUTION CARRIES CAPABILITY', 7.14, 2.35, 5.25);
    text(s, 'Build → two self-contained Skill bundles', 7.14, 2.84, 5.15, 0.83, 25, C.berry, { bold: true });
    text(s, 'Each carries its CLI, schemas, references, and local libraries—not just the source Skill folder.', 7.14, 3.95, 5.12, 0.94, 20);
    text(s, 'Browser and media tools are prepared separately.', 7.14, 5.16, 5.12, 0.6, 18);
    text(s, 'Build success ≠ published release,\nhost discovery, or installation acceptance.', 7.14, 6.01, 5.12, 0.52, 16, C.muted);
    footer(s, 8, 'Language contract · Artifact defaults · Build implementation · Architecture');
    notes(s, 'slide-06-language-distribution',
      'New HTML defaults to bilingual with English initially visible. PNG, PPTX and video default to English. Explicit Chinese selection changes the artifact language rather than the Dossier. The Agent must author and check translations; a local language switch does not call a translation service. Build output contains exactly aha-research and aha-explain Skill bundles with CLI, schemas, references, local runtime libraries and notices. Source skills folders are not complete installation packages. Browser, Python and FFmpeg are not bundled. Reading a build implementation does not prove a release, host discovery or installation acceptance.',
      ['skills/aha-explain/references/language.md#L1-L57', 'src/artifacts/project.ts#L90-L168', 'scripts/build.ts#L111-L149', 'docs/ARCHITECTURE.md#L1-L136', 'README.md#L17-L23']);
  }

  // slide-07-quality
  {
    const s = slide(true);
    label(s, '08  /  WHAT “DONE” MEANS', 0.6, 0.43, 12, C.pink);
    text(s, 'A valid file is not yet a good explanation', 0.6, 0.94, 12.05, 0.77, 33, C.cream, { bold: true });
    const layers = [
      ['Research support', 'Do the cited sources support the claims?'],
      ['Explanation clarity', 'Can the reader follow the reasoning between them?'],
      ['Visuals + editing', 'Does the actual artifact read and edit well?'],
      ['Runtime integrity', 'Do checks and receipts match the tested candidate?'],
      ['Human understanding', 'Can a real person explain or apply the idea?'],
    ];
    layers.forEach(([name, question], i) => {
      const y = 2.16 + i * 0.78;
      text(s, String(i + 1).padStart(2, '0'), 0.6, y + 0.02, 0.42, 0.3, 14, C.pink, { fontFace: 'Consolas' });
      text(s, name, 1.23, y, 2.53, 0.5, 17.5, C.cream, { bold: true });
      text(s, question, 4.02, y, 4.61, 0.56, 17, C.pale);
      if (i < layers.length - 1) line(s, 1.23, y + 0.62, 7.4, C.muted);
    });
    rect(s, 9.08, 2.16, 3.65, 3.91, C.berry);
    label(s, 'THE AHA APPROACH', 9.39, 2.47, 3.04, C.pink);
    text(s, 'Investigate.\nAuthor deliberately.\nCheck each layer.', 9.39, 3.04, 3.01, 1.72, 28, C.cream, { bold: true });
    text(s, 'Preserve the source.\nDisclose what is still untested.', 9.39, 5.04, 3.01, 0.8, 18, C.cream);
    text(s, 'These checks complement one another. Agent review is not an independent human comprehension study.', 0.6, 6.42, 12.05, 0.39, 17, C.pink);
    footer(s, 9, 'Architecture · Explain Skill  |  scope: repository description, not measured effectiveness', true);
    notes(s, 'slide-07-quality',
      'The five questions are separate acceptance layers, not measured results or a maturity score. Research support, explanatory clarity, visual/native-editing quality, runtime integrity and real-person comprehension cannot substitute for one another. A passing schema check or receipt does not certify meaning. No independent human comprehension study, live-host acceptance or cross-machine PowerPoint compatibility is asserted. This deck is authored source; actual rendering and slide/editing review are separate production tasks.',
      ['docs/ARCHITECTURE.md#L1-L136', 'skills/aha-explain/SKILL.md#L1-L22', 'src/artifacts/render.ts#L39-L81']);
  }
}
