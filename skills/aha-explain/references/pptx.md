# Native, detailed PPTX

Use [artifact authoring](artifact-authoring.md) for project metadata and [execution](execution.md) before running the author module. Plan the full argument and coverage before choosing page count. Agree a practical page/resource budget; there is no arbitrary 12-slide limit. Content richness means complete reasoning, mechanisms, concrete examples, evidence, and useful appendices, not tiny text.

Select metadata language under [language](language.md), then author native titles, text, charts, reader-facing notes, citations, and limitations in that language. Copying `research.title` does not translate it. Artifact metadata alone does not prove native text language or presentation-application language settings; inspect authored content and actual rendering.

Design varied layouts for comparison, mechanism, sequence, data, code, conclusions, and references. Use [visual design](visual-design.md) and optionally one [theme section](design-themes.md). Translate semantic color/type roles into native slide properties; HTML CSS variables and root theme preferences do not style PPTX objects. Use locally available licensed fonts, test CJK fallback, and disclose cross-machine substitutions. Use readable native text, shapes, tables, connectors, and charts for core content. A complex SVG or image may be appropriate, but disclose its editing limits; whole-slide screenshots are not native editable slides.

Pilot two contrasting compositions, such as an annotated mechanism and an evidence comparison, in the actual presentation application. Keep a shared visual grammar without repeating one card grid; expand coverage through useful pages rather than shrinking text.

## Source API

The project entry is a JavaScript module using the supplied PptxGenJS instance:

```js
export default async function ({ pptx, research }) {
  pptx.layout = 'LAYOUT_WIDE';
  const slide = pptx.addSlide();
  // Add topic-specific native text, shapes, charts, and notes here.
  slide.addText(research.title, {
    x: 0.7, y: 0.5, w: 11.9, h: 0.7, fontSize: 30,
  });
}
```

This illustrates the calling convention, not an authored presentation. The runtime supplies `research` as the Dossier's `research` payload (the complete research draft, not the manifest wrapper) and handles output writing. Do not call `writeFile`, install dependencies, or construct a replacement runtime. Replace the scaffold with substantive topic-specific pages and correct coverage.

Execution imports an authored Node module with host privileges and a 60-second timeout, not a sandbox. Apply reviewed local approval under execution. `doctor --for pptx` checks the bundle without external optional probes; it does not certify a presentation application for visual review.

```text
node "<absolute installed skill>/scripts/aha.mjs" explain-check <project-directory>
node "<absolute installed skill>/scripts/aha.mjs" render-pptx <project-directory> <new.pptx> --allow-code
```

## Native and visual QA are separate

Check the source text and OOXML for coverage, native object types, notes, and accidental private-data inclusion. Open the actual `.pptx` in PowerPoint or a compatible presentation application, render and inspect every page and adjacent-page continuity, and test editing representative text/shapes/tables/charts. Check fonts, clipping, alignment, diagrams, density, and speaker-note separation.

OOXML parsing is not visual review; HTML preview is not PPTX rendering. If a presentation application is unavailable, report visual/native editing QA as blocked, not passed. Preserve source, assets, output, and review record; see [artifact QA](artifact-qa.md).
