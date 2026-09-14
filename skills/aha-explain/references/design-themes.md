# Optional aesthetic recipes

These are original design prompts, not templates to fill or themes to install. [Visual design](visual-design.md) owns briefing, token-role compatibility, font licensing, theme preference, and pilot review. User/project branding comes first. Read only the chosen section and its palette row; skip this file when an original or supplied brand direction is already clear. A recipe may be adapted or rejected without changing Aha's content, safety, or execution contracts.

## Recipe index

- **1. Editorial research:** nuanced, source-heavy reading.
- **2. Engineering schematic:** systems, code paths, protocols.
- **3. Evidence/data atlas:** comparisons and distributions.
- **4. High-contrast kinetic mechanism:** visible state changes.
- **5. Executive narrative:** decisions and recommendations.
- **6. Clawpilot neutral:** retain a restrained scaffold baseline.

## Palette and type starting points

Colors below suggest roles, not tested contrast combinations or a fixed color count. Keep muted text genuinely readable. Fonts are options only when locally available and licensed; use a tested local CJK fallback and a generic family rather than downloading anything.

| Recipe | Suggested palette | Local type options |
| --- | --- | --- |
| Editorial research | Paper `#F7F3EB`, ink `#232A31`, muted ink `#59636B`, brick accent `#9E3D32`, rule `#D7CDBF` | Georgia or an available Source Serif heading; Segoe UI/Arial body; Noto Serif CJK or Source Han Serif for CJK headings, Microsoft YaHei/Noto Sans CJK for body; serif/sans-serif fallbacks. |
| Engineering schematic | Pale field `#F3F7FA`, ink `#142B3B`, steel `#506675`, signal blue `#005B9A`, construction line `#C9D7E0` | Segoe UI/Arial body; Consolas/Cascadia Mono for identifiers only; Microsoft YaHei/Noto Sans CJK or Yu Gothic for the appropriate script; sans-serif/monospace fallbacks. |
| Evidence/data atlas | Warm white `#FAFAF5`, ink `#202D2A`, forest `#17624F`, ochre `#9A6100`, separator `#D1DAD2` | Aptos/Arial or locally available Source Sans; Noto Sans CJK/Source Han Sans/PingFang SC where available; sans-serif fallback. |
| High-contrast kinetic mechanism | Near black `#10131A`, foreground `#F4F6FA`, cyan signal `#5CE1E6`, amber condition `#FFC857`, subdued field `#283241` | Bold Segoe UI/Aptos Display headings; Segoe UI/Arial body; Microsoft YaHei/Noto Sans CJK for CJK; sans-serif fallback. |
| Executive narrative | Ivory `#F8F7F2`, navy `#142D4E`, muted slate `#536071`, decision teal `#006B65`, divider `#D5DAE0` | Aptos/Segoe UI/Arial; Georgia for a restrained opening if appropriate; Microsoft YaHei/PingFang SC/Noto Sans CJK where available; sans-serif or serif fallback by role. |
| Clawpilot neutral | Existing scaffold: warm field `#F7F4EF`, ink `#242424`, muted `#5C5C5C`, rose accent `#B11F4B`, border `#DEDEDE`; dark field `#3D3B3A`, ink `#DEDEDE`, accent `#FD8EA1` | Segoe UI/Aptos/Calibri, with Microsoft YaHei/Noto Sans CJK/PingFang SC as available; sans-serif fallback. Retain the existing scaffold values when using this baseline. |

## 1. Editorial research

**Character and fit.** A thoughtful journal or research feature: large claim-led heading, modest deck, generous text measure, quiet rules, margin evidence. Useful for nuanced explanations, source-heavy essays, and competing interpretations. Less useful for dense operational dashboards or rapid frame-by-frame instruction.

**Hierarchy and composition.** Use serif contrast sparingly in headings, readable sans or serif body, and clearly subordinate but legible citations. Alternate a reading column with a full-width diagram, a pull-out comparison, or a side annotation; do not box every paragraph. Reserve brick for a critical distinction, not all hyperlinks and all warnings indiscriminately.

```text
Claim-led title
Short framing paragraph
Reading column          Source / caveat
Reading column          Small evidence detail
----------- full-width mechanism -----------
Interpretation          Alternative explanation
```

**Diagram semantics.** Prefer restrained ink nodes with one highlighted path, labeled relations, and nearby explanatory notes. A pull quote is not evidence unless its attribution and context are visible.

**Across media.** HTML can alternate prose and wide figures; an infographic can become one annotated research plate rather than the whole article; native PPTX can pair a claim slide with a mechanism and an evidence appendix; frame-driven video can retain quiet type while progressively revealing the mechanism. Keep motion localized instead of animating long prose.

**Pitfalls.** Tiny footnotes, low-contrast “paper” text, oversized empty titles, and decorative newspaper columns that break reading order. For CJK, inspect line length and punctuation rather than relying on a Latin character measure.

## 2. Engineering schematic

**Character and fit.** A precise systems drawing: clear boundaries, aligned pathways, compact labels, and annotated interfaces. Useful for architecture, protocols, code paths, debugging, and state machines. Less useful when the main task is emotional storytelling or when research cannot support precise relationships.

**Hierarchy and composition.** Allocate most space to the system, a narrow strip to legend/assumptions, and a separate region to trace or code. Use a light construction grid only if it helps alignment. Keep identifiers monospaced and explanatory prose proportional. Alternate a topology overview, a left-to-right trace, and a before/after failure view.

**Diagram semantics.** Separate service boundaries from process steps; specify data versus control arrows, sync versus async links, and failure/retry paths. Do not make a dashed boundary look like an unverified trust boundary. Keep component names stable across views.

**Across media.** HTML supports topology plus expandable trace and local Mermaid navigation; an infographic can show one end-to-end path with numbered annotations; PPTX can use native grouped components and connectors with a separate detail slide; frame-driven video can advance a labeled message token, change a queue state, and expose the resulting delay deterministically.

**Pitfalls.** Decorative circuitry, unexplained acronyms, tiny code, crossing arrows, and using a glowing pulse as proof of actual measured execution. If a trace is illustrative, label it as such.

## 3. Evidence/data atlas

**Character and fit.** A navigable field of evidence: aligned small multiples, direct labels, visible units, and carefully located caveats. Useful for comparisons, trends, distributions, geographic findings, and research with multiple evidence classes. Less useful for a single causal mechanism with little quantitative support.

**Hierarchy and composition.** Lead with the question and comparison key. Use one dominant chart with aligned supporting panels or a table adjacent to an interpretation column. A grid is justified for comparable small multiples, not as a universal container for unrelated prose. Keep scales and legends consistent; reserve forest and ochre for named categories rather than generic good/bad.

**Diagram semantics.** Separate measurements, estimates, and missing values; show uncertainty when supported. If evidence is categorical, use a labeled matrix or index rather than inventing a numerical score or map coordinates. Avoid dual axes without a compelling, clearly explained need.

**Across media.** HTML can offer an accessible table and useful filters alongside charts; an infographic can present a static overview with direct labels and sources; native PPTX can preserve editable charts/tables and place detailed methodology in notes or appendices; frame-driven video can reveal a time progression while holding the axes fixed.

**Pitfalls.** Unlabeled normalization, truncated axes that exaggerate differences, color-only legends, invisible missing data, or animated interpolation that invents observations. Styling must not conceal uncertainty.

## 4. High-contrast kinetic mechanism

**Character and fit.** A dark, high-contrast stage for one evolving mechanism: large active objects, bright causal or state cues, minimal competing furniture. Inspired by the mechanism-first energy of anything2explainer, not its code or a prescribed layout. Useful for stepwise transformations, feedback loops, bottlenecks, and concise demonstrations. Less useful for long uninterrupted reading, exhaustive tables, or topics where motion would imply unsupported causality.

**Hierarchy and composition.** Place the active mechanism in the largest region, a short claim above it, and captions below in a reserved safe area. Use cyan for the active entity/path and amber for a named condition, with text or symbols duplicating the distinction. Stable context stays subdued but readable. Alternate overview, close-up, split before/after, and recap rather than cycling title cards.

```text
Current question / state

Input ---> [active transformation] ---> Result
                condition

Reserved caption area; source cue outside action
```

**Diagram semantics.** Track object identity through each transformation. Show initial state, triggering condition, changed state, and consequence; motion direction must match the labeled relationship. Explain whether a moving object represents a packet, quantity, signal, or merely attention.

**Across media.** HTML can expose labeled step controls with keyboard/reduced-motion alternatives; an infographic uses a numbered state sequence; native PPTX uses editable state diagrams across varied slides, not black screenshots; frame-driven video derives every position/state from the supplied frame inputs and keeps captions clear throughout the transition.

**Pitfalls.** Neon everywhere, insufficient quiet pauses, small gray context labels, flashing, animation for its own sake, and page fades masquerading as mechanism explanation. Never introduce autoplay, timing randomness, or new runtime dependencies just to mimic an aesthetic.

## 5. Executive narrative

**Character and fit.** A clear decision story: conclusion, reasons, trade-offs, and action. Useful for leadership briefings, proposals, and recommendations supported by research. Less useful when the audience needs the full implementation trace in the main flow or the evidence does not justify a recommendation.

**Hierarchy and composition.** Use claim-led headings, strong alignment, generous whitespace, and a restrained accent for the decision. Alternate a large evidence number with context, a two-sided trade-off, a mechanism, and an action timeline. Keep important caveats near the claim, not hidden exclusively in notes.

**Diagram semantics.** Label decision branches with conditions; separate recommended next steps from observed outcomes. A funnel or staircase should describe a supported process, not imply inevitable progress.

**Across media.** HTML can open with a decision summary then expand evidence; an infographic can be a decision map with explicit conditions; native PPTX can combine a recommendation, editable comparison table, mechanism, and detailed appendix; frame-driven video can move from problem to evidence to choice while keeping essential qualifications on screen.

**Pitfalls.** Unqualified big numbers, vague slogans, ornamental progress arrows, and “executive” as an excuse to remove reasoning. Rich content can span more pages rather than become unreadable.

## 6. Clawpilot neutral

**Character and fit.** The existing scaffold's understated application/document language is a convenient baseline, not Aha's required identity. Useful for quick mixed-content explainers, interactive controls, and projects without brand direction. Less useful when it produces a generic dashboard feel instead of the requested editorial, schematic, or narrative expression.

**Hierarchy and composition.** Start with the scaffold's semantic token roles and local system typography. Use a document column, wide relationship figures, purposeful tables, and sparing surfaces; reserve cards for genuinely independent selectable or comparable items. Vary density and composition while keeping navigation and focus treatment consistent.

**Diagram semantics.** Keep accent, selected, warning, and comparison meanings distinct. Match runtime Mermaid/control roles to authored elements; a selection accent is not automatically an evidence category.

**Across media.** HTML can keep familiar controls around freely composed content; an infographic can use the same palette without app chrome; native PPTX translates the roles into native fills, lines, and text rather than pretending CSS applies to slides; frame-driven video uses coherent entity colors and deterministic state changes, not a recording of a static dashboard.

**Pitfalls.** Retaining a scaffold title/empty content, treating every section as a rounded card, allowing default dark/light tokens to leak into a custom palette, or claiming familiar controls guarantee accessible output.

## Adaptation and provenance

The shared baseline carries **identity and semantics**, not identical geometry. HTML reflows; a PNG has fixed bounds; PPTX needs native objects, explicit fonts, and page-level pacing; video needs time, deterministic frames, narration/caption alignment, and safe areas. Apply the corresponding medium reference and [QA](artifact-qa.md). No recipe requires generating all formats.

Conceptual references at fixed revisions:

- [visual-explainer skill](https://github.com/nicobailon/visual-explainer/blob/7163c3e10660912e0b89e1af465db9f387282b88/plugins/visual-explainer/SKILL.md): deliberate visual direction and content-shaped composition.
- [visual-explainer themes](https://github.com/nicobailon/visual-explainer/blob/7163c3e10660912e0b89e1af465db9f387282b88/plugins/visual-explainer/references/themes.md): aesthetically concrete palette/type/layout choices rather than a single default look.
- [anything2explainer style guide](https://github.com/Vincentwei1021/anything2explainer/blob/5b57239578284385c72ebfb2d1fce3ab61a3950a/reference/style-guide.md): high-contrast mechanism emphasis and purposeful staged motion.

These recipes are original guidance inspired by those ideas; they do not copy upstream prose, source code, or assets, and do not establish generated-sample acceptance.
