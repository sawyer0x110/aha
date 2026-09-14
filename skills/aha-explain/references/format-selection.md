# Select the deliverable

Resolve the medium before initializing a project. This is an agent workflow, not a CLI intent classifier. Research-only requests belong to the research workflow and never trigger the default below.

## Decision order

1. Honor explicit formats and exclusions, including natural-language names. Do not ask again when the user has already chosen.
2. Use an unambiguous requested deliverable: an interactive webpage means HTML, a single infographic means image, an editable PowerPoint means PPTX, and a narrated movie means video. Purpose alone ("for my team" or "for a meeting") is not a format.
3. For a visual explanation with no specified medium or decisive context, default to HTML. Briefly state that it supports prose, diagrams, and interaction without extra media production; proceed without a routine confirmation.
4. Ask one focused question only when ambiguity materially changes usefulness, cost, scope, or permissions: for example, "slides" with conflicting browser-only and PowerPoint requirements. Give a recommendation. Do not use ambiguity as permission to generate multiple formats.

| Request | Selected format(s) | Action |
| --- | --- | --- |
| "Explain this topic visually" / "帮我直观讲清楚这个主题" | `html` | Default to HTML, state the choice, research as needed. |
| "Make an interactive webpage" / "交互网页" | `html` | Author a reading experience, not a forced deck. |
| "One infographic / poster / 一图流 / 长图 / 海报" | `image` | Compose an independent PNG; respect any requested size. |
| "PPT / PowerPoint / editable slides / 做个演示文稿" | `pptx` | Author native slides, not HTML screenshots. |
| "HTML slides / browser slide deck / 网页幻灯片" | `html` | Author browser slides; no implicit PPTX export. |
| "Narrated video / MP4 / 讲解视频" | `video` | Prepare the video workflow; narration upload is not yet approved. |
| "HTML and PPT, no video" | `html`, `pptx` | Create exactly these two projects from the same reviewed research. |
| "All four formats / 四种都要" | `html`, `image`, `pptx`, `video` | Agree consequential production budgets, then author separately. |
| "Research only / 只调研，不生成作品" | None | Deliver research and stop. |
| Explicit unsupported final format, such as PDF | Unresolved | Explain the current renderer boundary and agree an alternative; never silently substitute HTML. |

Explicit requests outrank defaults. "Explain" alone does not require a visual artifact when the user only wants a textual answer or code explanation; do not hijack that request into media production.

## One project per medium

The CLI still requires a single `html|image|pptx|video` argument for `explain-init`; there is no `auto`, `all`, default CLI argument, or format array in `artifact.json`. For requested multiple outputs, validate/reuse one Dossier and initialize a new project per medium. Share facts and licensed assets where appropriate, but plan each medium's reading path, coverage, omissions, and composition independently.

Selection is not completion or permission. Missing dependencies do not authorize installations or another format. Local authored-code execution and external narration processing retain their separate approvals. Do not produce video, synthesize speech, or upload anything simply because HTML was the default. Report partial multi-format delivery per requested medium rather than labelling the entire set complete.

Next read [artifact authoring](artifact-authoring.md) and [visual design](visual-design.md), then only the selected medium references.
