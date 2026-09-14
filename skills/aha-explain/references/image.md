# Image infographic

Read [artifact authoring](artifact-authoring.md) and [execution](execution.md). Use an independent HTML/SVG composition for a PNG, not a shrunken screenshot of the whole HTML article.

Choose dimensions and a resolution budget for the reading/sharing context. Design a coherent visual argument with title, purposeful sections, connecting relationships, key figures, units, limitations, and concise sources. A single argument may need multiple subclaims; it need not be a tiny card. Preserve the scaffold's Clawpilot theme roles while freely composing a vertical infographic, landscape diagram, or poster.

Author the full image composition in the HTML entry, sized to `artifact.json`'s `width` and `height`. The runtime captures that viewport, not an arbitrary root-selector API; image overflow is an error. Keep fonts/assets local and licensed. Wait for actual font/image readiness before capture. If dimensions exceed the available browser/resource budget, report it and propose a changed size or explicit split; do not silently crop.

After authoring and obtaining approval to execute reviewed page code:

```text
node "<absolute installed skill>/scripts/aha.mjs" explain-check <project-directory>
node "<absolute installed skill>/scripts/aha.mjs" render-image <project-directory> <new.png> --allow-code
```

Inspect the complete PNG and a realistic reading-size view. Check clipping, edge padding, tiny text, glyph fallback, connectors, legend consistency, image loading, and source readability. Recheck numbers and visual comparisons against research. A screenshot being produced proves neither full capture nor legibility. Deliver PNG plus editable source and report limitations; see [artifact QA](artifact-qa.md).
