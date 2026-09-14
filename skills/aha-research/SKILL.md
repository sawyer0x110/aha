---
name: aha-research
description: Investigate complex questions about public topics, open-world sources, provided materials, or authorized codebases and diffs when the final deliverable is a report or investigation. Use for deep research, competing explanations, evidence comparisons, mechanism tracing, and source-grounded fact checking; deliver an independent report and Research Dossier. Route visual artifact requests, including topics needing research first, to aha-explain. Do not use for trivial factual answers or ordinary text/code questions.
---

# Aha Research

Answer the question before choosing a presentation. Research is a standalone deliverable, not a search-summary prelude to slides.

1. Read [the shared research workflow](references/research-workflow.md). Reuse the user's purpose, language, knowledge, time horizon, budget, and authorized materials; resolve only consequential ambiguity.
2. Load only the selected source route: [public/topic research](references/research-public.md), [codebase research](references/research-codebase.md), or both for mixed evidence. Provided materials use the shared workflow without an extra route guide. Iterate a question tree through evidence, counterevidence, gaps, and targeted follow-up.
3. When writing the draft, load [the research contract](references/research-contract.md); use `research-check --draft` while unfinished, then strict check/build for delivery. On first authoring or troubleshooting, consult [the synthetic worked example](references/research-example.md).
4. Reverse-check consequential claims against actual sources. Distinguish structural validity, semantic support, and observed execution. Report unresolved contradictions, access limits, and the real stopping reason.
5. Deliver the readable report, Dossier location, scope, source identities, and remaining uncertainty. Stop here when only research was requested.

No required engine, scenarios, simulator, slides, or quiz. Do not invent evidence or mark planned searches as completed. An existing Dossier can be reused after checking freshness and coverage; new evidence produces a new snapshot rather than silently changing existing works.

## Tools

Resolve this installed skill's directory, not the user's current directory. All commands use `node "<absolute installed skill>/scripts/aha.mjs" ...`; arguments and contracts are in the references. Use `doctor --for research` when capabilities are unknown. Research is read-only by default; no automatic installs. Before execution or network use, load [execution and privacy](references/execution.md), the shared permission authority.

Media creation belongs to `aha-explain`; do not assume the host automatically dispatches between skills.
