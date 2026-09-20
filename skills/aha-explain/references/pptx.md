# Native, detailed PPTX

Use [artifact authoring](artifact-authoring.md) for project metadata and [execution](execution.md) before running the author module. Plan the full argument and coverage before choosing page count. Agree a practical page/resource budget; there is no arbitrary 12-slide limit. Content richness means complete reasoning, mechanisms, concrete examples, evidence, and useful appendices, not tiny text.

Select metadata language under [language](language.md), then author native titles, text, charts, reader-facing notes, citations, and limitations in that language. Copying `research.title` does not translate it. Artifact metadata alone does not prove native text language or presentation-application language settings; inspect authored content and actual rendering.

Design varied layouts for comparison, mechanism, sequence, data, code, conclusions, and references. Use [visual design](visual-design.md) and optionally one [theme section](design-themes.md). Translate semantic color/type roles into native slide properties; HTML CSS variables and root theme preferences do not style PPTX objects. Use locally available licensed fonts, test CJK fallback, and disclose cross-machine substitutions. Use readable native text, shapes, tables, connectors, and charts for core content. A complex SVG or image may be appropriate, but disclose its editing limits; whole-slide screenshots are not native editable slides.

Pilot two contrasting compositions, such as an annotated mechanism and an evidence comparison, in the actual presentation application. Keep a shared visual grammar without repeating one card grid; expand coverage through useful pages rather than shrinking text.

## Decide what each page must explain

Before coding a page, briefly connect its question, takeaway, visible evidence and material conditions, composition, and speaker-note contribution. Reuse the existing brief or authoring notes; this is not a required per-slide schema or a second exhaustive planning document. Use the existing coverage IDs to locate claims, not as a substitute for expressing them.

Choose the composition for the relationship: a sequence or timeline for order, a labeled mechanism for causality, a comparison for alternatives, and a native data chart for supported quantities. A cover or transition can orient the audience without a separate evidentiary claim. Merge redundant pages; split a page that must explain two demanding relationships. Do not force every page into cards, one layout catalogue, or a fixed light/dark cadence.

For example, a cancellation page might ask "Why can waiting continue after cancellation?" Its visible takeaway distinguishes preventing the next send from promptly cleaning up a pending wait; a paired timeline shows the difference, with the relevant retry condition on the page. Notes can supply implementation detail. This is an illustration of planning, not a claim about an uninspected codebase.

## Repair capacity before shrinking type

For Chinese and mixed-script slides, inspect title breaks, long identifiers, punctuation, table cells, text-box padding, and source space in the actual font. Character counts and estimated line capacity are diagnostics, not proof of fit. Use this repair order:

1. Tighten redundant wording while retaining the relationship, negation, units, and conditions.
2. Recompose: widen the text region, change columns to a sequence, or move an explanation outside a diagram node.
3. Split the reasoning across connected pages, or move secondary detail to a clearly referenced appendix.
4. Only then adjust type within the agreed reading context; do not keep shrinking until the box accepts the text.

A shorter label such as "Waiting continues" needs its relevant condition nearby, not deleted to save space. Keep source cues and material caveats readable; do not hide them beneath a diagram or in notes. Use the starting ranges in [visual design](visual-design.md), not a universal character limit or a new hard font-size rule. If a page budget prevents readable, accurate coverage, state the conflict rather than silently dropping the argument.

Treat table height as content-dependent: wrapping, cell margins, and font substitution can expand rows beyond the authored height. Reserve space for the takeaway and footer, then check the actual rendered table bottom against those neighboring regions. After changing cells, recheck the table and its neighbors on the same page; a source-coordinate gap alone does not prove clearance. Tighten redundant cell text, widen columns, recompose, or split before reducing reading size. Distinguish an intentional background/text containment from a table obscuring an unrelated explanation.

## Select objects and image slots deliberately

| Content responsibility | Preferred representation | Check in the delivered file |
| --- | --- | --- |
| Titles, explanations, conditions | Native text | The words and styles are editable, including material qualifiers. |
| Supported numerical comparisons | Native chart when appropriate | Categories, series, values, units, and source agree with research; editable lines alone are not a data chart. |
| Row/column comparisons | Native table | Headers, cells, units, and merged regions retain their intended content. |
| Mechanisms and flows | Native shapes and connectors | Nodes and relationships can be meaningfully changed; group by logical purpose where supported. |
| Evidence from an interface or document | Embedded screenshot | Necessary labels, axes, units, timestamps, and context survive any crop. |
| Decorative or illustrative imagery | Embedded licensed image | It is not presented as measurement or evidence, and its internal content is not claimed editable. |

Do not invent numbers to obtain a chart or simulate a table with unrelated text boxes merely for styling. An appropriate raster/SVG illustration is allowed; distinguish its editing limits from surrounding native explanations.

Before selecting or making an image, decide its role, slot aspect ratio, essential subject/context, and any text-overlay safe area. Fit or letterbox an evidence image when cropping would remove necessary information. Do not bake an essential title or condition into decorative imagery instead of native text. Record local asset provenance and editing limits in existing resource notes; no automatic image service, font download, or external upload is authorized.

## Separate the page from the talk

The visible page should support a correct reading of its main claim, with necessary conditions, units, and natural source cues. Speaker notes can add derivation, implementation detail, examples, timing, and transitions; they should help the speaker explain rather than merely recite table cells. Any new factual assertion in notes still requires research support.

A claim present only in notes does not establish visible-page coverage. Use existing authoring/QA notes to distinguish visible explanation from speaker-only material without adding fields to `artifact.json`. If removing the notes makes the page misleading, restore the material qualification on the page. Do not infer that native notes imply audio narration or timed playback.

Keep production status in project QA/delivery records, not speaker notes: "source only", "not yet rendered", execution approval, and edit-probe results describe a particular build stage and become stale when the deck moves forward. Preserve those historical records with their stage and file identity rather than replacing them with unearned success claims. Research limitations and uncertainty still belong with the content they qualify. Notes should remain useful to the presenter after generation is complete.

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

Check the bundled PptxGenJS API for the object being authored rather than assuming similar-looking options are interchangeable. In the bundled 4.0.1 version, use `valign: 'middle'` for table cells: text boxes accept `'mid'`, but tables can serialize it as an invalid OOXML anchor. For endpoint-based lines, use minimum endpoint coordinates and nonnegative width/height, with `flipH`/`flipV` as needed to preserve direction; subtracting endpoints directly can emit invalid negative extents. A well-formed ZIP/XML package is not enough to catch these mistakes. If PowerPoint proposes repairing a file, retain the failed candidate, fix the author source, and render a new version; an automatically repaired file is not evidence that the original opened correctly.

The runtime reports targeted XML failures with slide/object/property locations before delivering a PPTX: malformed XML, duplicate nonvisual IDs, invalid text/table anchors, and negative geometry extents. Its bundled producer fixes known table/media/slide-number ID collisions; do not manually renumber serialized objects or inject private connector/timing references. AlternateContent in slide shape trees is unsupported and rejected rather than guessed. These checks are not full OOXML schema validation, semantic reconciliation, or proof that PowerPoint will open or lay out the deck correctly.

Execution imports an authored Node module with host privileges and a 60-second timeout, not a sandbox. Apply reviewed local approval under execution. `doctor --for pptx` checks the bundle without external optional probes; it does not certify a presentation application for visual review.

```text
node "<absolute installed skill>/scripts/aha.mjs" explain-check <project-directory>
node "<absolute installed skill>/scripts/aha.mjs" render-pptx <project-directory> <new.pptx> --allow-code
```

## Native and visual QA are separate

Check the source text and OOXML for coverage, native object types, notes, and accidental private-data inclusion. Open the actual `.pptx` in PowerPoint or a compatible presentation application, render and inspect every page and adjacent-page continuity, and test editing representative text/shapes/tables/charts. Check fonts, clipping, alignment, diagrams, density, and speaker-note separation.

OOXML parsing is not visual review; HTML preview is not PPTX rendering. If a presentation application is unavailable, report visual/native editing QA as blocked, not passed. Use [artifact QA](artifact-qa.md) for acceptance and [artifact authoring](artifact-authoring.md#working-history-and-current-delivery) for delivery.

Separate native editability from editing usability. On a copy, try a representative intended change: revise a label, a table value or a diagram relationship and inspect the result. Hundreds of independent line segments may be native but awkward to reshape; use meaningful grouping or an appropriate native chart when the underlying data supports it, without inventing measurements. State which edits were tried and which application rendered them. A native canvas observation does not establish desktop PowerPoint compatibility; keep the delivered original unchanged during the probe.

Compare the final pages with their intended questions and compositions. Check visible caveats separately from notes, long Chinese/mixed-script text after capacity repairs, critical screenshot context, and actual chart/table content. A native-object count cannot certify that the important content is editable. These are author and reviewer responsibilities; the current structural validator does not automate text fit, semantic object reconciliation, or QA freshness.

For each observed layout defect, keep the original export, identify the page and affected regions, change the author source, and compare a fresh application export of the same page. Check neighboring content and retained conditions as well as the original defect; moving a collision or hiding a caveat is not a repair. Bind observations to the reviewed output/receipt, not merely a filename. If there was no capacity defect, do not invent a repair; if rerendering is unavailable, record the proposed change as unverified.
