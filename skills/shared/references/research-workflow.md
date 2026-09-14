# Iterative research workflow

Shared by both skills. A topic-to-media request uses this method directly; it does not depend on the host dispatching another skill. Research-only requests stop with research.

## 1. Frame and plan

Reuse the requested question, purpose, audience knowledge, language, time horizon, and available budget. Specify authorized materials, inclusions, exclusions, and expected depth. Adult readers are the default; neither age nor job title establishes expertise. Clarify only ambiguity that changes the answer or permission boundary.

Research report language follows the user's research request, independently of artifact defaults. Select sources for relevance and requested source-language coverage; an English artifact default is not a reason to discard Chinese sources or translate the Dossier.

Build a question tree: central question, answerable subquestions, hypotheses, decisive evidence needs, possible disconfirmations, and dependencies. Separate planned actions from executed log entries. Depth comes from resolving important questions, not a prescribed source count.

Load only [public research](research-public.md), [codebase research](research-codebase.md), or both for a mixed inquiry, with their distinct standards. Provided-only material uses this workflow and the draft contract without either extra route guide. A mixed inquiry must not equate public assertions with observed local behavior.

## 2. Iterate

For each bounded round:

1. Read the most decision-relevant sources or code paths and record actual locators, identities, access/read extent, failures, and limitations. Record real timestamps where required for web evidence or executed logs; provided data does not require invented timestamps.
2. Update the claim/evidence ledger. Separate source assertions, observations, inferences, and explicit assumptions; retain supporting and contradicting evidence.
3. Update each subquestion: answered, contradicted, unresolved, or outside scope. These are workflow concepts; use the actual schema's status values in the draft.
4. Identify what would change the conclusion. Follow upstream citations, missing branches, disputed definitions, numbers, and alternative explanations with targeted follow-up.
5. Reassess the budget and scope. Escalate consequential new permission or budget needs; do not silently expand access or turn a deep inquiry into an unlabelled summary.

## 3. Synthesize and reverse-check

Write a direct answer with mechanisms or argument, concrete comparisons/examples where useful, counterevidence, uncertainties, and natural source citations. Explain disagreement rather than voting by source count. Keep the report independent of any medium; no required engine, scenarios, slides, quiz, or simulation.

From each major conclusion, work backward to the precise supporting source context. Check wording, units, dates, denominators, causal strength, boundary conditions, and whether contrary evidence changes it. Classify review outcomes as supported, revise, insufficient, or unverifiable in review notes, without inventing schema enum values.

Keep three distinct records: structural validation, semantic source review, and any explicitly authorized observed execution. A hash proves identity, not truth.

## 4. Stop and preserve

Stop when the core questions are adequately supported and important counterevidence handled, or when a documented access/tool/budget limit prevents further progress. Record the real stopping reason and remaining gaps with useful next steps; do not manufacture completeness.

Load [the research contract](research-contract.md) when writing the editable draft; check unfinished work with `research-check --draft`, then strict check/build for the versioned Dossier. Consult [the synthetic worked example](research-example.md) only on first authoring or troubleshooting. Preserve old snapshots when updating evidence. Report missing or stale evidence before reusing research for a consequential explanation.
