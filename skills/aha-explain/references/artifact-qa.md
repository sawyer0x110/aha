# Fact checking and actual QA

## Review content from the output backward

Extract consequential assertions from the actual prose, diagram arrows, labels, comparisons, numbers, slides, captions, and narration. Trace each to the research claim and, where necessary, reopen the exact source context. Review units, denominators, time windows, applicability, inference strength, and counterevidence.

Record supported, revise, insufficient, or unverifiable findings with output locators. Fix misleading arrows and omissions as seriously as wrong sentences. New material facts require additional research and a new snapshot, not merely an added coverage ID.

Identity and reference checks establish metadata consistency, not semantic proof. A complete coverage map can still describe false, missing, or unreadable content.

## Review the requested medium

| Medium | Required observation |
| --- | --- |
| HTML | Open delivered HTML offline; inspect desktop/narrow screens and actually operate controls with pointer and keyboard; check reduced motion, console, fonts, tables, and diagrams. |
| Image | View the complete image and realistic reading-size crops; check all edges, glyphs, units, relationships, source text, and legibility. |
| PPTX | Inspect native object types and notes, render every actual slide in a presentation application, review continuity, and try editing representative native objects. |
| Video | Watch and listen to a representative mechanism pilot and the final video; inspect scene changes, audio, subtitle timing/safe area, readability, continuity, and real mechanism animation. |

Static checks, browser automation receipts, valid OOXML, and successful encoding are separate evidence, not a declaration of aesthetic quality or human acceptance. Do not fabricate human feedback, user sign-off, screenshots, playback, or interaction results.

## Language acceptance

Review the project's selected language under [the language contract](language.md); QA does not reselect defaults or upgrade legacy metadata.

For bilingual HTML, actually switch with pointer and keyboard and inspect **both complete branches**, including narrow layouts. Check localized document title and `html lang`, English/中文 controls, inactive-branch hiding and excluded focus targets, Mermaid captions/controls and diagram geometry after switching, and optional author interactions responding to `aha:languagechange`. Confirm English initial display without inferred/persisted preferences, no language URL parameter, and offline operation without translation requests.

Review Chinese font coverage and longer English labels for clipping, overflow, and legibility. Compare headings, prose, charts, diagram labels, captions, accessibility labels, limitations, and citation wording against the same evidence and claim IDs. Verify matching quantities/units, negation, conditions, and uncertainty; neutral shared assets must not leak untranslated prose outside the localized roots.

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

**Evidence boundary:** these are acceptance criteria, not certified examples. No generated same-topic samples have yet been certified by this documentation work. Do not claim cross-medium visual quality, native editing, deterministic replay, or listening acceptance without the corresponding actual artifacts and observations. Mark unavailable application, browser, playback, or human review as unperformed/blocked; synthetic test fixtures and implementation tests do not close those gaps.

## Revise and deliver

Record actual tools, files, observations, defects, revisions, and unperformed checks in project QA notes. Fix the editable source, rebuild into a new destination, and inspect again. Do not only patch final output or cache. Keep previous snapshots.

Report: delivered paths and format, source/project path, bound research identity, factual limitations, resource/license notes, performed QA, remaining defects, and blocked checks. Do not claim a video or presentation is complete when required files or actual QA are missing. Keep audit metadata out of reader-facing content except natural sources and meaningful limitations.
