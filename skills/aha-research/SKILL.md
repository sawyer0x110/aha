---
name: aha-research
description: Investigate complex questions about public topics, open-world sources, provided materials, or authorized codebases and diffs. Use for deep research, competing explanations, evidence comparisons, mechanism tracing, and source-grounded fact checking. Deliver an independent report and Research Dossier with iterative questions, evidence, counterevidence, scope, and research logs; media generation is not required.
---

# Aha Research

Answer the question before choosing a presentation. Research is a standalone deliverable, not a search-summary prelude to slides.

1. Read [the shared research workflow](references/research-workflow.md). Reuse the user's purpose, language, knowledge, time horizon, budget, and authorized materials; resolve only consequential ambiguity.
2. Follow [public/topic research](references/research-public.md), [codebase research](references/research-codebase.md), or both. Iterate a question tree through evidence, counterevidence, gaps, and targeted follow-up.
3. Use [the research contract](references/research-contract.md) to initialize and maintain an editable draft, check it, and build a new versioned Dossier. Read [execution and privacy](references/execution.md) before any code execution or network use.
4. Reverse-check consequential claims against actual sources. Distinguish structural validity, semantic support, and observed execution. Report unresolved contradictions, access limits, and the real stopping reason.
5. Deliver the readable report, Dossier location, scope, source identities, and remaining uncertainty. Stop here when only research was requested.

No required engine, scenarios, simulator, slides, or quiz. Do not invent evidence or mark planned searches as completed. An existing Dossier can be reused after checking freshness and coverage; new evidence produces a new snapshot rather than silently changing existing works.

## Tools

Resolve this installed skill's directory, not the user's current directory. All commands use `node "<absolute installed skill>/scripts/aha.mjs" ...`; arguments and contracts are in the references. Start with `doctor` when capabilities are unknown. Never install dependencies automatically.

Media creation belongs to `aha-explain`; do not assume the host automatically dispatches between skills.
