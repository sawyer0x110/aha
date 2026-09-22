# Compose for the reader's task

Read only the matching section when planning a requested visual artifact. This guide connects an already scoped question and its research to the explanation's structure; it does not choose a medium, authorize execution, or turn ordinary text answers into media. Use [format selection](format-selection.md) only if the medium is unresolved.

In existing authoring notes, name the reader's decision or question, the evidence needed to answer it, and the visual relationship that makes the answer easier to inspect. Use the prompts below as omissions to check, not mandatory page sections. A small task may need one annotated comparison, not a dashboard with every category. Preserve the [research workflow](research-workflow.md) and [explanation editing](explanation-writing.md) rather than repeating their contracts.

## Explain a change

Establish the actual comparison endpoints, affected objects, and the condition under which behavior differs. For code, follow [codebase research](research-codebase.md): distinguish committed changes from a dirty workspace and read the relevant caller/consumer path, not just the diff.

Organize around the consequential behavior: what a reader could do or observe before, what changes after, why, and what stays the same. Separate intended benefit from demonstrated behavior. Mention API, data, configuration, tests or rollout only where the change affects them; touched test files are not passing test results.

Use aligned before/after views with stable names and the same level of detail. Emphasize the changed edge, state or condition instead of drawing two unrelated architectures. A file map can locate implementation, but it cannot substitute for the causal explanation. Keep supporting file/symbol/version locators near the claims they support.

Review: can the reader identify one concrete condition that distinguishes before from after, follow its relevant path, and locate any unresolved effect? Do not invent a change where the inputs only support a description of one version.

## Review a proposed plan

Keep proposed steps separate from established current behavior. Extract the goal and consequential assumptions, then test each against the supplied evidence. If a proposal depends on uninspected code, a missing version or an unrun experiment, label that dependency unknown rather than approving it by plausibility.

For each material step, connect **proposal -> current evidence -> consequence -> recommendation**. Useful statuses include supported, contradicted, conditional and unknown; choose wording that states why. A risk list without this connection does not review the plan.

Choose an aligned current/proposed diagram when the topology changes, or a compact claim/evidence/revision table when assumptions are the issue. Preserve the proposal's identifiers so the reader can find the affected step. End with a scoped decision and the smallest useful correction or next check. A suggested experiment is not an observed result; a review recommendation is not permission to execute commands.

The reasoning chain is not a fixed column layout. For prose-heavy reviews on narrow screens, group each assumption with its evidence, consequence and recommendation vertically, retaining identifiers, qualifications and source links. Keep a horizontally scrollable table when the task genuinely depends on comparing rows and columns; preserve headers and keyboard access. Choose for the intended reading width rather than shrinking text or making readers repeatedly scroll sideways to reconstruct one argument.

Review: does the corrected plan actually remove the unsupported assumption, preserve the user's goal, and distinguish remaining uncertainty from blockers? Avoid replacing one blanket guarantee with another. Do not manufacture a full implementation plan when a single conditional correction is sufficient.

## Explain a mechanism

Name the objects and boundary, show an initial state, the action or condition that changes it, and the resulting state. Choose one stable example if it helps the reader track the mechanism; distinguish its assumed values from measurements. Follow the same identities across prose, arrows and states.

Select a visual that carries the relationship: a state transition for changing conditions, a sequence for temporal dependencies, an annotated cutaway for hidden versus visible state, or a matched comparison for alternatives. A labeled box named after the mechanism is not an explanation of its operation.

Include the nearest meaningful boundary or counterexample, where supported, to prevent an overgeneralized conclusion. Do not force a counterexample or interactive slider when the evidence supplies neither. For video, translate the mechanism into [shots and beats](video-storyboarding.md), not one new title card per sentence.

Review: can the reader follow what changes, what remains, and why the stated consequence follows? Do not claim learner understanding without a separate reader evaluation.

## Recap a project

Start with the reader's purpose: orientation, a handoff, or deciding what to do next. Establish the snapshot date/version and distinguish current capabilities, historical observations, proposed work and unverified status.

Use responsibilities and relationships as the spine: what the project does, its main parts, one relevant path through them, and the limits or next decision. Use a timeline only when chronology explains the state. A repository tree is useful for navigation but is not the narrative.

For a handoff, surface the current deliverable, unresolved dependencies and the evidence behind readiness claims. For an introduction, emphasize user value and boundaries rather than internal production history. Do not infer current release availability or example counts from an old research snapshot.

Review: can someone unfamiliar with the authoring session tell what exists now, how the pieces cooperate, and what is only planned? Keep audit records outside reader-facing content except for meaningful sources and limitations.
