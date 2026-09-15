# Image infographic

Use [artifact authoring](artifact-authoring.md) for project metadata and [execution](execution.md) before capture. Use an independent HTML/SVG composition for a PNG, not a shrunken screenshot of the whole HTML article.

Select metadata language under [language](language.md), then author the title, labels, chart text, sources, and limitations in that language. Inspect glyph coverage and long labels at actual reading size; metadata alone does not prove legible translation.

Choose dimensions and a resolution budget for the reading/sharing context. Design a coherent visual argument with title, purposeful sections, connecting relationships, key figures, units, limitations, and concise sources. A single argument may need multiple subclaims; it need not be a tiny card. Use [visual design](visual-design.md) and optionally one [theme section](design-themes.md). Compose a vertical infographic, landscape diagram, research plate, or poster for the argument rather than a universal card grid.

Set an explicit root light/dark author preference when capture appearance must be stable; inspect a pilot at the actual delivery size before expanding. Reuse visual identity across media, not the HTML article's geometry.

Author the full image composition in the HTML entry, sized to `artifact.json`'s `width` and `height`. The runtime captures that viewport, not an arbitrary root-selector API; image overflow is an error. Keep fonts/assets local and licensed. Wait for actual font/image readiness before capture. If dimensions exceed the available browser/resource budget, report it and propose a changed size or explicit split; do not silently crop.

After authoring and obtaining approval to execute reviewed page code, use `doctor --for image` if capture capabilities are unknown:

```text
node "<absolute installed skill>/scripts/aha.mjs" explain-check <project-directory>
node "<absolute installed skill>/scripts/aha.mjs" render-image <project-directory> <new.png> --allow-code
```

Inspect the complete PNG and a realistic reading-size view. Check clipping, edge padding, tiny text, glyph fallback, connectors, legend consistency, image loading, and source readability. A screenshot being produced proves neither full capture nor legibility. Use [artifact QA](artifact-qa.md) for source review and acceptance, and [artifact authoring](artifact-authoring.md#working-history-and-current-delivery) for delivery.
