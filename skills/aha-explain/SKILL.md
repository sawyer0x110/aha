---
name: aha-explain
description: Create research-grounded rich HTML with interactive diagrams, image infographics, native editable PPTX, or narrated dynamic video from public topics, open-world questions, provided research, or authorized codebases and diffs. Use for visual explanations and media generation, including topic-to-artifact requests that need research first; freely author the requested format rather than forcing a fixed slide or card template.
---

# Aha Explain

Create only the requested medium. The editable source is the authority; metadata preserves research identity and coverage, not a fixed card DSL.

1. Reuse a Dossier after checking its sources, freshness, and coverage. Starting from a topic or codebase? Follow [the same research workflow](references/research-workflow.md), [public research](references/research-public.md) and/or [codebase research](references/research-codebase.md), then [build a Dossier](references/research-contract.md). Do not assume automatic skill-to-skill dispatch.
2. Read [artifact authoring](references/artifact-authoring.md) and [execution and privacy](references/execution.md). Plan the claims, examples, mechanisms, necessary limitations, intentional omissions, and reading path for this audience's actual knowledge.
3. Load only the requested medium: [HTML](references/html.md), [image](references/image.md), [native PPTX](references/pptx.md), or [dynamic video](references/video.md). Structure and length follow the content; no mandatory quiz, simulator, or arbitrary 12-slide limit.
4. Initialize the project, then author actual topic-specific source and coverage. Scaffolds start as drafts, not completed explanations. Mark `status` as `authored` only after authoring and run `explain-check`.
5. Review code and obtain explicit local execution permission before executing it. For video, obtain separate approval of the complete current narration and external speech processing scope.
6. Follow [fact checking and real QA](references/artifact-qa.md): inspect the actual output, interact with HTML, review images at reading size, render PPTX pages in a presentation application, and watch/listen to video. Revise source and publish a new output; do not patch only a generated file.

## Tools and delivery

All commands use `node "<absolute installed skill>/scripts/aha.mjs" ...`, resolved from this installation, never an assumed working-directory path. Run `doctor --media` to inspect available tools; missing dependencies are blockers, not permission to install.

Deliver the requested output plus editable source, research snapshot identity, resource/license notes, and honest QA results or blockers. Do not expose full private research by default. Metadata consistency is not semantic proof; static checks are not visual review, and the runtime is not a sandbox.
