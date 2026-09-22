# Fact checking and actual QA

## Review content from the output backward

Extract consequential assertions from the actual prose, diagram arrows, labels, comparisons, numbers, slides, captions, and narration. Trace each to the research claim and, where necessary, reopen the exact source context. Review units, denominators, time windows, applicability, inference strength, and counterevidence.

Record supported, revise, insufficient, or unverifiable findings with output locators. Fix misleading arrows and omissions as seriously as wrong sentences. New material facts require additional research and a new snapshot, not merely an added coverage ID.

Identity and reference checks establish metadata consistency, not semantic proof. A complete coverage map can still describe false, missing, or unreadable content.

## Review explanatory clarity separately

Apply [explanation editing](explanation-writing.md) to the actual reader-facing copy, including controls' feedback, headings, captions and narration. Read the title alone as a cold reader: the subject and question should be identifiable without the prompt or body. Check browser titles, gallery labels and covers too, separately in each language. Read prose without decorative layout, then check its correspondence with the visual. Flag unspecified referents, missing logical steps, unexplained terms, translated fragments and headlines that overstate the body. Record a locator, the ambiguity, the correction and remaining review gaps.

Keep factual support, explanatory clarity, language quality, visual/native usability, and runtime/media integrity as separate observations in existing QA notes, not new required metadata. Passing byte comparisons, text-length checks, language switching or video decoding does not pass the editorial review. Agent editorial judgments are not human comprehension results.

For the matching [task type](task-composition.md), review the delivered explanation against the reader's actual decision: before/after behavior for a change, proposal/evidence/correction for a plan, state/action/consequence for a mechanism, or current versus historical/planned status for a recap. A checklist of headings alone does not establish these relationships.

When the user requests evidence of understanding, agree a small learner evaluation separately from production QA. Ask intended readers to explain an unseen case that changes a meaningful condition, justify a prediction and identify where the explanation no longer applies. Collect their reasoning before revealing answers; self-reported understanding and copied page answers are not transfer evidence. Record prior knowledge, exposure and assistance, anonymized responses with consent, the rubric and unperformed items. For version comparisons, use anonymous labels and balanced allocation or matched tasks to reduce order and practice effects. Do not test the same reader on the same question twice and attribute practice gains to the skill. This is not a mandatory quiz in the artifact or a substitute for actual human participation.

## Review the requested medium

| Medium | Required observation |
| --- | --- |
| HTML | Open delivered HTML offline; inspect desktop/narrow screens and actually operate controls with pointer and keyboard; check reduced motion, console, fonts, tables, and diagrams. |
| Image | Verify pixel dimensions against the brief, then view the complete image and the composition scaled to its intended display width/container (about 390 CSS pixels wide for mobile if no exact target is known). Scroll through long images; fit one-screen images in full. Use native-resolution crops only for diagnosis. Check all edges, glyphs, units, relationships, source text, and legibility without relying on zoom in a no-zoom context. |
| PPTX | Inspect native object types and notes, render every actual slide in a presentation application, review continuity, and try editing representative native objects. |
| Video | Watch and listen to a representative mechanism pilot and the final video; inspect scene changes, audio, subtitle timing/safe area, readability, continuity, and real mechanism animation. |

Static checks, browser automation receipts, valid OOXML, and successful encoding are separate evidence, not a declaration of aesthetic quality or human acceptance. Do not fabricate human feedback, user sign-off, screenshots, playback, or interaction results.

For HTML plan reviews, follow the [composition guidance](task-composition.md) at the intended narrow width: can a reader follow one assumption through evidence and recommendation without repeatedly scrolling sideways? A genuinely two-dimensional comparison may retain horizontal scrolling; check headers and keyboard access rather than treating all scrollable tables as failures.

For video, apply [shot and beat review](video-storyboarding.md) to consequential transitions, intermediate frames, boundaries and result holds in the actual output. Check mutually exclusive labels for overprinting and agreement with the object's state, and persistent comparisons for readable labels at intended playback size with captions present. Check the interval and its neighbors after repair. Intentional static reading time is not a defect by itself; frame changes are not evidence that the intended mechanism is explained.

For PPTX, review the [page intentions and object choices](pptx.md) against the final output, not only the author plan. Distinguish visible text from speaker notes: note-only facts do not prove visible-page coverage, and a material qualification belongs with the claim it limits. Check Chinese/mixed-script wrapping and reading-size legibility after repairs; preserve screenshot context and compare chart categories/values and table cells with their inputs. Record missing native content or awkward editing even if the package contains other native shapes. If no capacity defect occurred, record that observation rather than manufacturing a repair. These observations are separate from structural tests and do not assert automated layout or semantic validation.

For repaired PPTX pages, compare actual before/after application exports of the same page and inspect its neighbors. In particular, check the rendered table bottom, takeaway, and footer rather than trusting authored table height. Retain the defect locator, source change, output identity, and remaining gaps in QA records; an older export cannot validate a newer source. Keep source-only/render-pending/approval status out of speaker notes, while preserving research limitations and historically scoped audit evidence.

## Language acceptance

Review the project's selected language under [the language contract](language.md); QA does not reselect defaults or upgrade legacy metadata.

For bilingual HTML, actually switch with pointer and keyboard and inspect **both complete branches**, including narrow layouts. Check localized document title and `html lang`, English/中文 controls, inactive-branch hiding and excluded focus targets, Mermaid captions/controls and diagram geometry after switching, and optional author interactions responding to `aha:languagechange`. Confirm English initial display without inferred/persisted preferences, no language URL parameter, and offline operation without translation requests.

Review Chinese font coverage and longer English labels for clipping, overflow, and legibility. Independently read each complete language branch for natural phrasing and a self-contained explanation before comparing headings, prose, charts, diagram labels, captions, accessibility labels, limitations, and citation wording against the same evidence and claim IDs. Include generated interaction text, not just the initial DOM. Verify matching quantities/units, negation, conditions, and uncertainty; neutral shared assets must not leak untranslated prose outside the localized roots.

For single-language media, inspect all reader-facing text in the selected language. Video voice defaults are not proof of translated narration: listen to the approved authored segment text and check its derived burned captions/SRT. A narration translation requires a new plan hash and fresh complete approval.

Record semantic translation review separately from schema checks and rendering. Scaffolds remain drafts until actually authored; nonempty bilingual roots do not constitute translation certification. Do not mutate the Dossier to make artifact languages agree.

## Visual acceptance and same-topic cross-medium cases

Use the existing brief and pilot observations from [visual design](visual-design.md); there is no need to load every [theme recipe](design-themes.md) at review. Accept against concrete observations: readable hierarchy at intended size, complete relationships, unclipped labels/glyphs, visible sources and limitations, coherent semantic colors, usable controls, and compositions suited to the argument. Do not replace these observations with aesthetic scores. User/project branding takes precedence over recipe matching.

For a same-topic case requested in multiple media, use the same bound research claims, entity names, quantities/units, and material caveats. Each medium needs its own composition and acceptance record; cross-medium consistency is not identical screenshots or equal word counts. For example, a queue-bottleneck case can share the distinction between arrival rate and service capacity, a supported backlog observation, and a qualification about the operating conditions.

| Requested output | Same-topic acceptance observation |
| --- | --- |
| HTML | Prose, a labeled queue mechanism, and a data view tell a consistent story; wide/narrow reading and actual controls work offline; author theme preference and explicit query overrides keep runtime diagrams/controls legible. |
| Image | A self-contained mechanism/evidence composition preserves units and the caveat, with readable source cues at delivery size; it is not a cropped or miniaturized article. |
| Native PPTX | Claim, mechanism, evidence, and caveat remain consistent across varied slides; core text/shapes/tables/charts are editable and actual presentation rendering is inspected. |
| Frame-driven video | Arrival, service, and backlog states are distinguishable; a condition change and consequence are visible, narration agrees with them, captions stay clear, and replay checks reproduce sampled frame states. Render success alone does not pass these checks. |

Generate and review only the formats the user requested. A single-medium request does not require a four-format demonstration. When multiple formats are requested, trace important assertions across outputs and log omissions or contradictions with section, image-region, slide, or timestamp locators. A compressed medium may omit secondary detail if its argument remains accurate and the scope reduction is explicit.

**Evidence boundary:** these are acceptance criteria, not certification of any example. Record the actual host skills, theme constraints and renderers used; a mixed-tool run cannot establish Aha-only aesthetic quality. Do not claim cross-medium visual quality, native editing, deterministic replay, or listening acceptance without the corresponding actual artifacts and observations. Mark unavailable application, browser, playback, or human review as unperformed/blocked; synthetic test fixtures and implementation tests do not close those gaps.

## Revise and deliver

Record actual tools, files, observations, defects, revisions, and unperformed checks in project QA notes. Fix source, rebuild and inspect again. Use [artifact authoring's delivery lifecycle](artifact-authoring.md#working-history-and-current-delivery) for history, replacement, receipt pairing and the final handoff; do not repeat that checklist in each medium.

Do not claim a video or presentation is complete when required files or actual QA are missing. Keep audit metadata out of reader-facing content except natural sources and meaningful limitations.
