# Image infographic

Use [artifact authoring](artifact-authoring.md) for project metadata and [execution](execution.md) before capture. Use an independent HTML/SVG composition for a PNG, not a shrunken screenshot of the whole HTML article.

Select metadata language under [language](language.md), then author the title, labels, chart text, sources, and limitations in that language. Inspect glyph coverage and long labels at actual reading size; metadata alone does not prove legible translation.

## Choose the canvas before composing

Choose dimensions in this order: explicit user dimensions, delivery-container/platform constraints, reading context, then content structure. If explicit dimensions conflict with a hard delivery or runtime limit, explain the conflict and ask which constraint to change instead of silently overriding it. The scaffold's dimensions are an initialization default, not a design recommendation.

Use landscape for simultaneous comparison, architecture, or relationships; use portrait for sequential steps, tutorials, or section-by-section introductions. Square images suit a single takeaway or summary. Content volume alone does not determine orientation.

| Reading context | Starting dimensions (pixels) | Composition |
| --- | --- | --- |
| Presentation or desktop, one screen | 1920 x 1080 | One main argument; comparisons and relationships can sit side by side. |
| Document illustration with more explanation | 1800 x 1200 | Landscape with additional room for labels and supporting text. |
| Mobile feed summary | 1080 x 1350 | A prominent title and a few key points. |
| Mobile full-screen image | 1080 x 1920 | Sequential reading; account for known interface overlays. |
| Scrollable infographic | 1080 wide, often 1800-3200 high | Purposeful sections; determine height from the content rather than filling a preset length. |
| Single takeaway or share card | 1080 x 1080 | A concise, self-contained message. |

These are design starting points, not platform upload specifications or mandatory sizes. Verify destination constraints when they matter. The current image runtime accepts integer widths of 320-4096 and heights of 240-16000; technical capacity is not a recommendation for an extremely long image.

When context is sufficient, choose and briefly explain the size without a routine question. If choosing between a one-screen presentation and a scrollable mobile image would materially change content coverage, ask about the intended use. Record the chosen dimensions, intended display width or container, and rationale in the existing brief/QA notes, not new required metadata.

If content does not fit, improve hierarchy and layout first. Increase height only for a scrollable context, or propose an explicit split if needed; do not create extra images without agreement. Do not shrink type, stretch the image, or silently crop to force a fit. Increasing pixel count with the same proportions does not make text larger at the same displayed width.

## Compose and capture

Design a coherent visual argument with title, purposeful sections, connecting relationships, key figures, units, limitations, and concise sources. A single argument may need multiple subclaims; it need not be a tiny card. Use [visual design](visual-design.md) and optionally one [theme section](design-themes.md). Compose a vertical infographic, landscape diagram, research plate, or poster for the argument rather than a universal card grid.

Set an explicit root light/dark author preference when capture appearance must be stable; inspect a pilot at the actual delivery size before expanding. Reuse visual identity across media, not the HTML article's geometry.

Author the full image composition in the HTML entry, sized to `artifact.json`'s `width` and `height`. The runtime captures that viewport, not an arbitrary root-selector API; image overflow is an error. Keep fonts/assets local and licensed. Wait for actual font/image readiness before capture. If dimensions exceed the available browser/resource budget, report it and propose a changed size or explicit split; do not silently crop.

After authoring and obtaining approval to execute reviewed page code, use `doctor --for image` if capture capabilities are unknown:

```text
node "<absolute installed skill>/scripts/aha.mjs" explain-check <project-directory>
node "<absolute installed skill>/scripts/aha.mjs" render-image <project-directory> <new.png> --allow-code
```

Inspect the complete PNG and a realistic reading-size view. For a mobile scrolling image, also view it scaled to about 390 CSS pixels wide, scrolling through all sections; use the actual target width when known. For a one-screen image, fit the whole composition into the intended container. Native-resolution crops help diagnose defects but do not replace this scaled reading check. Check clipping, edge padding, tiny text, glyph fallback, connectors, legend consistency, image loading, and source readability. Revise the composition if essential text requires zooming in the intended no-zoom context. A screenshot being produced proves neither full capture nor legibility. Use [artifact QA](artifact-qa.md) for source review and acceptance, and [artifact authoring](artifact-authoring.md#working-history-and-current-delivery) for delivery.
