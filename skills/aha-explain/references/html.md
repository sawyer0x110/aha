# Rich HTML

Use [artifact authoring](artifact-authoring.md) for project metadata; apply [execution](execution.md) before browser execution. Author the project's HTML source directly; it is the editable authority, not a generated fixed-card layout.

## Language and localized roots

When authoring metadata or bilingual content, use [the language contract](language.md) for the exact localized roots, titles, offline switch, hiding, and `aha:languagechange` behavior. Keep interactions branch-aware so initially hidden diagrams work after switching. Layouts remain free-form; Aha packages authored translations, not automatically translated research.

## Compose for the question

Choose the reading structure from the question: a diagram-led single view, a direct comparison, an interactive exploration, a long-form document, or a mixture. HTML is a delivery medium, not a requirement to write an article. Use prose where it supplies a necessary relationship or qualification, and keep an accessible textual explanation of the visual argument. Do not add sections merely to make the page longer.

Choose relationships deliberately: architecture/topology, sequence, comparison, timeline, data, or argument. Mix structures when useful. Use consistent arrow meanings, object identities, type hierarchy, spacing, and color semantics. Keep natural source links near supported claims.

At composition, follow [visual design](visual-design.md) for runtime `--cp-*` roles, light/dark selectors, author/system preference, and `scoutTheme` overrides; optionally read only a chosen [theme section](design-themes.md). Give prose a comfortable measure; let wide tables and complex diagrams expand independently instead of squeezing them into the text column or turning the whole article into a slideshow.

Author SVG or local Mermaid diagrams as appropriate. The built-in path recognizes `.mermaid` elements (normally `<pre class="mermaid">`) and embeds the installed local Mermaid runtime, which initializes strict mode, renders SVG in the browser, and provides figure captions and zoom/pan/expansion controls. Keep diagram text properly escaped; never add a CDN or a competing initialization/control wrapper. This is browser-time rendering, not precomputed SVG.

The injected runtime exposes `window.ahaMermaidReady`, a Promise that author code and browser checks can await before inspecting diagram geometry or capturing output. Do not assume injection has finished when an earlier inline script runs: await it after the runtime is available, for example from a load handler. Report rejected rendering rather than capturing a blank diagram.

For a static SVG deliverable, you may instead use already available, reviewed build-time Mermaid tooling and preserve its editable source. Mermaid conversion is not a dedicated Aha CLI command. If a required local renderer is unavailable, author SVG or report the limitation instead of silently downloading it.

Interactive features must serve understanding: zoom/pan/reset, expandable detail, table filtering, code-path highlighting, or a well-grounded parameter model. Provide keyboard controls, focus states, useful labels, and reduced-motion behavior. A recorded sequence or diagram navigation is not an observed experiment; do not invent a causal slider just to be interactive.

## Offline packaging boundary

The runtime packages local CSS, classic `.js`/`.cjs` scripts, supported images, and fonts into the output; source resource paths must stay within the allowed project tree. Plain local references have no query strings or encoded paths. Use a locally prebundled classic script rather than module scripts, import maps, or dynamic imports.

Author inline SVG for complex graphics; external SVG assets must be inert and self-contained. Embedded frames/objects/media, authored `http-equiv` metadata, `srcset`, CSS imports/escapes, and SVG animation elements are unsupported. Use deterministic JavaScript for scene animation. Natural HTTP(S)/mailto citation links are allowed, but asset fetching and active network access are not. Aha inserts its offline CSP; do not weaken it or describe resource checks as a universal code sandbox.

## Build and inspect

Use `doctor --for html` if packaging capabilities are unknown, or `doctor --for browser` before preview diagnostics. Use the installed CLI:

```text
node "<absolute installed skill>/scripts/aha.mjs" explain-check <project-directory>
node "<absolute installed skill>/scripts/aha.mjs" render-html <project-directory> <new.html>
node "<absolute installed skill>/scripts/aha.mjs" browser-check <project-directory> --allow-code
```

`render-html` packages source without executing authored code; it is not evidence of visual quality. Browser execution needs reviewed code approval even when the HTML was packaged without execution. The CLI check does not replace actually opening and interacting with the delivered output.

Follow [artifact QA](artifact-qa.md) for offline desktop/narrow-screen, keyboard, reduced-motion, font and bilingual checks. Inspect every authored interaction and the structures actually present; long prose, wide tables and sequence diagrams are capability-test cases, not mandatory ingredients of every work. Record what was and was not observed.
