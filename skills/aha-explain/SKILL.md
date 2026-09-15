---
name: aha-explain
description: Create a visual artifact as the final deliverable, choosing rich HTML with interactive diagrams, image infographics, native editable PPTX, or narrated dynamic video. Use for visual explanations from public topics, open-world questions, provided research, or authorized codebases and diffs, including topics needing research first. Route report-only investigations to aha-research. Do not turn trivial text answers or ordinary code explanations into media production.
---

# Aha Explain

Create only the requested medium. For a visual explanation with no specified medium or decisive context, default to HTML and briefly state the choice. Load [format selection](references/format-selection.md) only if routing is ambiguous or multiple outputs need coordination. Research-only requests stop with research.

1. Reuse a Dossier after checking sources, freshness, and coverage. For a topic or codebase, load [the research workflow](references/research-workflow.md) and only the selected [public](references/research-public.md) or [codebase](references/research-codebase.md) route (both for mixed evidence; neither extra guide for provided-only material). Load [the draft contract](references/research-contract.md) when authoring; consult [the synthetic example](references/research-example.md) only on first authoring or troubleshooting. Build a Dossier without assuming automatic skill-to-skill dispatch.
2. At project authoring, read [artifact authoring](references/artifact-authoring.md) and only the selected medium: [HTML](references/html.md), [image](references/image.md), [native PPTX](references/pptx.md), or [dynamic video](references/video.md). New HTML defaults to bilingual English/Chinese, initially English; image/PPTX/video default to English. Explicit Chinese output uses `--language zh`; `bilingual` is HTML-only. Load [language](references/language.md) when authoring metadata or bilingual content; research language follows the research request independently.
3. Before styling, apply [explanation editing](references/explanation-writing.md) to the argument and representative copy; do not compress away the relationships the reader needs. For bilingual work, review each language independently before comparing fidelity. Then use [visual design](references/visual-design.md). Read only the chosen [theme recipe section](references/design-themes.md), if useful; branding takes precedence and Clawpilot is a fallback, not a required aesthetic. Structure and length follow the content, without a mandatory quiz, simulator, or 12-slide limit.
4. Initialize, author actual topic-specific source and coverage, then mark `status` as `authored` and run `explain-check`. Scaffolds are drafts, not completed explanations.
5. Before execution, load [execution and privacy](references/execution.md): review source and obtain explicit local execution approval. Video narration approval and external speech-processing permission are separate; no automatic installs.
6. At review, load the full [fact checking and actual QA guide](references/artifact-qa.md). Inspect the requested output, test HTML interaction and both bilingual branches, view images at reading size, render PPTX in a presentation application, or watch/listen to video. Record factual support, explanatory clarity, language quality, and binary/runtime checks separately. Revise source and publish a new output.

## Tools and delivery

All commands use `node "<absolute installed skill>/scripts/aha.mjs" ...`, resolved from this installation, never an assumed working-directory path. When capabilities are unknown, use `doctor --for <current-step>` as described in execution; missing optional tools block only the corresponding step, not unrelated authoring.

Deliver the requested output plus editable source, research snapshot identity, resource/license notes, and honest QA results or blockers. Do not expose full private research by default. Metadata consistency is not semantic proof; static checks are not visual review, and the runtime is not a sandbox.
