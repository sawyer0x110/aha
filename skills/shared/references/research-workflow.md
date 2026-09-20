# Iterative research workflow

Shared by both skills. A topic-to-media request uses this method directly; it does not depend on the host dispatching another skill. Research-only requests stop with research.

## 1. Frame and plan

Reuse the requested question, purpose, audience knowledge, language, time horizon, and available budget. Specify authorized materials, inclusions, exclusions, and expected depth. Adult readers are the default; neither age nor job title establishes expertise. Clarify only ambiguity that changes the answer or permission boundary.

Research report language follows the user's research request, independently of artifact defaults. Select sources for relevance and requested source-language coverage; an English artifact default is not a reason to discard Chinese sources or translate the Dossier.

Build a question tree: central question, answerable subquestions, hypotheses, decisive evidence needs, possible disconfirmations, and dependencies. Separate planned actions from executed log entries. Depth comes from resolving important questions, not a prescribed source count.

Load only [public research](research-public.md), [codebase research](research-codebase.md), or both for a mixed inquiry, with their distinct standards. Provided-only material uses this workflow and the draft contract without either extra route guide. A mixed inquiry must not equate public assertions with observed local behavior.

## 2. Iterate

For each bounded round:

1. Select the next evidence action using the decision rule below, then read the relevant sources or code paths and record actual locators, identities, access/read extent, failures, and limitations. Record real timestamps where required for web evidence or executed logs; provided data does not require invented timestamps.
2. Update the claim/evidence ledger. Separate source assertions, observations, inferences, and explicit assumptions; retain supporting and contradicting evidence.
3. Update each subquestion: answered, contradicted, unresolved, or outside scope. These are workflow concepts; use the actual schema's status values in the draft.
4. Revisit the premise tested: did the evidence support, contradict, narrow, or leave it unresolved? Change the answer accordingly, rather than preserving the original conclusion behind a disclaimer. Follow upstream citations, missing branches, disputed definitions, numbers, and alternative explanations with targeted follow-up.
5. Reassess the budget and scope. Escalate consequential new permission or budget needs; do not silently expand access or turn a deep inquiry into an unlabelled summary.

### Choose the smallest sufficient next check

Start with the provisional answer and its most consequential unresolved premise. When orientation is missing, first make a bounded entry/source read; do not invent a hypothesis just to fill a template. Ask what evidence could change the main answer or distinguish reasonable competing explanations. Choose an authorized action sufficient to resolve that distinction; among comparably useful actions, prefer the lower cost. A cheap snippet is not sufficient when methods or surrounding code determine the claim.

Before acting, identify the possible outcomes and how each would affect the conclusion. This is a decision rule, not a mandatory per-round table or extra document. Do not collect more same-lineage agreement in place of a missing reasoning link, demand a contrarian conclusion, or investigate an immaterial gap merely because it is easy.

For example, when several summaries repeat a claimed benefit but the allocation method is unknown, read the original methods before collecting more summaries. Comparable randomized allocation could strengthen a causal interpretation; self-selection would require a narrower observational claim. Neither outcome alone settles every other causal assumption. If the necessary methods are inaccessible, keep that gap visible rather than treating failed access as evidence for either explanation.

If only an experiment can resolve the distinction, existing read permission does not authorize execution. Describe the minimum proposed observation and required approval; remain read-only without adequate authorization/isolation. Stop when the scoped answer is supported and material counterevidence handled, or record the real access/tool/budget limit. Simple, adequately supported questions need no extra cycle.

Keep consequential premises, alternative explanations, action rationale, and conclusion revisions in `report`; support/contradiction and read context in `evidence.summary`; bounded conclusions in `claims` and `limitations`; remaining unknowns and useful next actions in `gaps.description`. Only executed searches, reads, and failures belong in `researchLog`. Use existing contract fields and enum values, not new hypothesis or confidence-score fields. A log or schema pass cannot prove that a check was decisive.

## 3. Synthesize and reverse-check

Write a direct answer with mechanisms or argument, concrete comparisons/examples where useful, counterevidence, uncertainties, and natural source citations. Explain disagreement rather than voting by source count. Keep the report independent of any medium; no required engine, scenarios, slides, quiz, or simulation.

Check the reasoning bridge between the evidence and each conclusion. Name the entities, what changes or is compared, the relevant condition, and why the result follows; distinguish a source-supported mechanism from your own inference. Several supported facts do not by themselves establish a causal chain. If a necessary link is missing, follow up or narrow the conclusion and record the gap, rather than leaving a future artifact author to invent it. Explain essential terms in the readable report without adding new schema fields.

From each major conclusion, work backward to the precise supporting source context. Check wording, units, dates, denominators, causal strength, boundary conditions, and whether contrary evidence changes it. Classify review outcomes as supported, revise, insufficient, or unverifiable in review notes, without inventing schema enum values.

Keep three distinct records: structural validation, semantic source review, and any explicitly authorized observed execution. A hash proves identity, not truth.

## 4. Stop and preserve

Stop when the core questions are adequately supported and important counterevidence handled, or when a documented access/tool/budget limit prevents further progress. Record the real stopping reason and remaining gaps with useful next steps; do not manufacture completeness.

Load [the research contract](research-contract.md) before first recording structured claims, evidence, or research logs; reuse it during drafting. Check unfinished work with `research-check --draft`, then strict check/build for the versioned Dossier. Consult [the synthetic worked example](research-example.md) only on first authoring or troubleshooting. Preserve old snapshots when updating evidence. Report missing or stale evidence before reusing research for a consequential explanation.
