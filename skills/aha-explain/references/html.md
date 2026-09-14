# Rich HTML

Use [artifact authoring](artifact-authoring.md) for project metadata; apply [execution](execution.md) before browser execution. Author the project's HTML source directly; it is the editable authority, not a generated fixed-card layout.

## Language and localized roots

When authoring metadata or bilingual content, use [the language contract](language.md) for the exact localized roots, titles, offline switch, hiding, and `aha:languagechange` behavior. Keep interactions branch-aware so initially hidden diagrams work after switching. Layouts remain free-form; Aha packages authored translations, not automatically translated research.

## Compose for the question

Use a readable long-form document with headings, prose, lists, tables, code, quotations, and natural source links. Choose relationships deliberately: architecture/topology, sequence, comparison, timeline, data, or argument. Mix structures when useful. Use consistent arrow meanings, object identities, type hierarchy, spacing, and color semantics.

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

Check offline with network unavailable: fonts, diagrams, scripts, assets, Chinese/non-Latin text, long body, wide table, sequence diagram, and every useful interaction. Test desktop and narrow-screen layouts, keyboard navigation, zoom/reset, reduced motion, console errors, and source links. Inspect screenshots and the actual document; record what was and was not observed. Follow [artifact QA](artifact-qa.md).

For bilingual output, switch and inspect both complete branches under the language acceptance checklist in QA; the initial English view and schema success cannot certify translation.
