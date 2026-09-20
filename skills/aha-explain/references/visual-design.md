# Visual design: choose an expression, not a template

Load this guide at composition, not during source research. Use only the requested [HTML](html.md), [image](image.md), [PPTX](pptx.md), or [video](video.md) reference; read a chosen [theme section](design-themes.md) only when useful. Aha supports freely authored visual styles and compositions. The scaffold is a starting point, not a required look or layout. User direction, project branding, accessibility, factual accuracy, and the medium's contracts take precedence over optional recipes.

## Write a small content design brief

Before styling, record these decisions in the project's existing authoring or QA notes, not a new required schema:

- **Reader and task:** who is reading, what they already know, and the question or decision the artifact should resolve.
- **Argument:** one-sentence takeaway; necessary mechanism, comparison, evidence, and caveat; which claims need prominent sources.
- **Reading situation:** screen or print, available time, intended dimensions, likely CJK/non-Latin content, and whether native editing matters.
- **Visual responsibilities:** what prose explains, what the diagram proves or illustrates, what a chart compares, and what interaction or motion adds.
- **Direction:** user/brand constraints; one coherent aesthetic baseline, a small palette, font roles, density, and examples of two or three different compositions.
- **Constraints and review:** local licensed assets/fonts available, light/dark intent, reduced motion, execution permissions, resource budget, and a representative pilot to inspect.

For example: “Explain why a queue backs up to engineers; distinguish arrival rate from service capacity; pair a labeled queue schematic with a measured backlog chart and an uncertainty note; use an engineering baseline, not six equal summary cards.” Do not turn this brief into mandatory metadata or a rigid slide outline.

For PPTX, refine this brief into short page intentions at the point of composition: what the page answers, what must be visible, why this composition fits, and what the speaker adds. Follow [PPTX](pptx.md) for capacity repair, native-object selection, image slots, and notes separation; keep these medium-specific decisions out of unrelated HTML/image/video workflows.

## Establish a grammar; vary the composition

Choose a baseline from the [recipe index](design-themes.md), read only that section and its palette row, or invent another without loading recipes. Keep type roles, spacing rhythm, entity identities, arrow meanings, and evidence treatment coherent. Change composition to fit the content: a full-width mechanism, a margin-annotated passage, a direct comparison, a timeline, a native table, or a restrained conclusion page. A universal grid of rounded cards is not a substitute for reasoning.

Start with three type levels: title, section/claim heading, body/labels. Add a smaller source level only if it remains readable at delivery size. Distinguish levels through size, weight, and spacing rather than using a different font for each. As initial working ranges, HTML body text can be 16–19 CSS px with a roughly 60–75-character Latin measure; projected slides can start at 28–36 pt headings and 18–24 pt body. These are starting points, not limits or guarantees: inspect the actual output, CJK line wrapping, image scaling, and viewing distance.

Use locally installed or already available licensed fonts. Pair a display or serif heading face with a readable sans body, or use one sans family well. For CJK, explicitly test an available family such as Noto Sans/Serif CJK, Source Han Sans/Serif, Microsoft YaHei, PingFang SC, or Yu Gothic as appropriate to script and platform, with a generic fallback. Availability and licenses differ; listing a name does not supply or license the font. Do not download fonts. Embed/package only licensed local font files through the existing medium's supported path; otherwise disclose substitution risks, especially for editable PPTX on another machine.

## Color roles and runtime compatibility

Clawpilot neutral is optional. Its `--cp-*` token **roles** remain the compatibility interface for runtime Mermaid and controls, not a mandatory set of color values. Keep meaningful values for every consumed role: page/surface backgrounds, primary/secondary/muted text, borders, accents, focus/selection, and semantic states where present. Map them into the chosen palette rather than deleting or renaming the interface. A new palette must keep runtime captions, controls, expanded diagrams, and focus states readable, not merely style the authored article.

The authored stylesheet can override all relevant variables. Inspect the supplied defaults and their selectors: replace the complete relevant role set, including values in root `data-theme` variants, not just a few declarations on `:root`. The runtime supplies `:root` defaults and `html[data-theme="dark"]` overrides before authored styles. Define subsequent `html[data-theme="light"]` and `html[data-theme="dark"]` rules with the intended role values; otherwise a default variant can leak through into Mermaid or controls. Override body typography separately; the runtime Mermaid renderer reads the body's computed font family. Define and inspect both variants if both can be reached. This is source CSS authoring, not a new theme file, manifest schema, or CLI flag.

For a fixed author preference, use `<html data-theme="light">` or `<html data-theme="dark">` in the source. With neither explicit preference, automatic selection falls back to the viewer's system preference. An explicit `scoutTheme=light` or `scoutTheme=dark` query parameter overrides the author/system choice for the delivered document. Do not automatically add a theme-toggle UI. Check the authored preference and any supported explicit override; a fixed dark composition still needs usable runtime controls if deliberately viewed with the override. These document URL options do not permit query strings in local asset references.

Palette suggestions are not prevalidated contrast pairs. Check normal text at least 4.5:1, large text at least 3:1, and essential graphical/control boundaries at least 3:1 against their adjacent background. Never encode a category or status only by color: add text, line style, shape, or symbol. Decorative accent colors need not become text colors.

## Make diagrams accountable

- Give every entity a stable name and visual identity. Use position to express a real relation, not accidental proximity.
- Define arrows: for example, solid arrows transfer data, dashed arrows signal control, and blunt ends indicate blocking. Include a legend when meanings are not self-evident. Do not imply causality with a decorative connector.
- Label direction, state, units, and boundaries where they change interpretation. Separate observed measurements from estimates, hypothetical mechanisms, and inferred links.
- For charts, make axes, scales, denominators, and time windows explicit; keep comparable quantities on comparable scales. For maps or atlases, avoid implying a geographic or quantitative coordinate system where none exists.
- Prefer fewer crossings and shorter labels; move supporting prose outside nodes. Test labels, edge paths, and runtime controls in the actual rendered diagram, not just its source.
- Follow each rendered branch from its start to its intended endpoint, including arrowheads and nearby labels. In SVG, `marker-end` marks the end of a path, not every disconnected subpath: use separate paths when separate branches need terminal arrowheads. A valid SVG or an unclipped text box does not prove that connectors avoid labels or express the intended relation.

## Run a short visual pilot before expanding

Select the hardest representative content, not only a title: one mechanism and caveat with a long label, one comparison or data view, and a source cue. Include CJK text when relevant. Build a deliberately scoped, fully authored pilot in the requested medium: a representative HTML section, an infographic region at final scale, two contrasting native slides, or the 20–30 second mechanism pilot in [video](video.md).

Include only its finished source, map the claims it actually explains, and explicitly omit remaining claims with pilot-scope reasons. Replace scaffold content with actual work rather than merely clearing its markers. `authored` describes this pilot's implemented scope, not completion of the requested deliverable. As you expand, update coverage and omissions; perform full final QA separately. Review the source and obtain applicable execution/audio approvals under [execution](execution.md); this loop grants none.

Inspect the actual output at its intended reading size. Record concrete observations and fix/rebuild before expanding:

| Check | Pass observation | Fail observation and response |
| --- | --- | --- |
| Hierarchy | Takeaway is encountered before supporting detail; body can be read without zooming at intended size. | Sources dominate the claim or body is tiny: simplify the composition, not the argument. |
| Relationships | Reader can follow each labeled edge and distinguish evidence from inference. | Crossings obscure endpoints or arrows imply an unsupported cause: reroute, label, or remove them. |
| Density | Necessary reasoning fits with clear grouping and breathing room. | Repeated equal cards flatten a sequence or caveat is pushed out: choose a sequence or annotated composition. |
| Robustness | Long labels, CJK glyphs, captions, and controls fit; intended theme and explicit override remain legible. | Missing glyphs, clipped labels, default accent leaks, or invisible focus: repair source roles, font choice, or geometry. |
| Medium fidelity | Native slides remain editable; a motion pilot shows an interpretable state change; image reads at delivery size. | Rasterized core slides, meaningless page fades, or unreadable source text: revise the medium-specific design. |

Do not award aesthetic scores or invent reviewer reactions. Record the file, viewport/slide/frame/time, observed defect, correction, and checks still blocked. A pilot pass does not certify the complete artifact; repeat relevant checks on the final output using [artifact QA](artifact-qa.md).
