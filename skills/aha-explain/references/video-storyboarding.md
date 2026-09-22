# From narration to shots and beats

Use at video composition and when repairing an unclear or poorly paced sequence. [Video](video.md) owns the production workflow; [the video contract](video-contract.md) owns implemented fields and timing. This is author guidance, not a new storyboard schema, renderer or word-alignment feature.

## Separate speech segmentation from visual structure

A narration segment is an approved audio/caption unit. A shot is a continuous visual situation. A beat changes an object, relationship or emphasis within that situation. One shot can span several segments; one segment can contain several beats. Do not reset the entire screen merely because `segmentIndex` changes.

Choose the shot around what must remain visible for the explanation to work: the same object before and after a change, a comparison whose two sides remain aligned, or a path followed through a system. Keep object identity stable so the reader sees a transformation rather than unrelated illustrations.

Continuity does not require every annotation to remain visible. Keep the object identities, spatial anchors and comparison baseline needed for the current beat; reveal supporting explanations when relevant and retire them when no longer needed. Keep material qualifications visible with the claim they limit. If a persistent comparison crowds the frame, simplify annotations or stage the focus with a compact reference state before shrinking labels. Review at the intended playback size with captions present; preserving context is not a reason to make either alternative unreadable.

Start with the complete narration and its supported claims. For each important verb or comparison, decide what the picture contributes beyond the captions. If the voice describes a consequence, show the relevant state or relation; do not substitute a title appearing while an unrelated background animates. A legitimate reading pause needs no decorative motion.

## Write a small shot plan before scene code

Use the project's existing source or authoring notes. Record only what is useful to implement and review the sequence:

| Decision | Record |
| --- | --- |
| Purpose and evidence | The question this shot answers, relevant claim IDs and approved segment IDs. |
| State and action | Initial state, the object or relationship that changes, resulting state, and the material boundary or caveat. |
| Beats | What enters, moves, connects, changes or is emphasized, and which narration segment it accompanies. |
| Timing and reading | Planned relative timing, a readable result/qualification hold, and any intentional static interval. |
| Composition | Main visual focus, persistent context, label space and the runtime caption safe area. |
| Continuity | What carries into the next shot and what deliberately leaves; avoid accidental disappearance or contradictory simultaneous states. |

These are questions to resolve, not required fields in `artifact.json` or VideoPlan. Do not add arbitrary storyboard properties to either schema. Keep the plan proportional: a short pilot can use a few rows, not a production manual.

For example, in a queue explanation keep the waiting items visible while service removes one and arrivals add more; then hold the resulting backlog long enough to compare it with the starting state. A decorative pulse on a box labelled "queue" does not explain why the backlog grew. The example is a composition pattern, not a researched claim or a reusable timing prescription.

## Bind timing without inventing alignment

Before audio is measured, mark timing as provisional. After approval and synthesis/import, derive segment boundaries from the generated manifest's measured frame counts. Use the existing global `frame`, `segmentIndex`, `segmentFrame`, `segmentFrames` and `fps` callback inputs to calculate the complete scene state deterministically.

Use stable segment IDs in authoring notes, and explicitly map them to the approved segment order in code. Within a segment, normalized progress can position planned beats; it does not locate a spoken word. When a mechanism needs a precise spoken cue, listen and verify its timing, or revise the segmentation/narration through the normal approval path. Do not label estimates or proportional timing as word-level alignment.

Keep planned beat times ordered and inside the segment or continuous shot they belong to. Budget for the result to settle and remain readable before the transition. Choose hold duration from content density and actual playback rather than a universal frame minimum. Keep captions clear throughout entry paths and camera/object motion, not only in the final pose.

Treat mutually exclusive state labels in the same slot as replacements, not an overlapping crossfade: replace the text at the modeled state change, or finish the old label's exit before the new label enters. Tie the label switch to the depicted object's state so a readable label does not describe the wrong moment. Object motion and other nonconflicting transitions may still animate; an intentional before/after comparison can show both labels in separately identified regions. Two half-visible contradictory labels neither communicate an intermediate state nor form a readable comparison.

Render state from time inputs rather than mutating it incrementally: replaying a frame or entering a later segment directly must reconstruct every persistent object correctly. Do not keep a hidden history of prior render calls. Cross-segment continuity must coexist with deterministic A-B-A replay.

Changing visual source still changes source identity. This guide does not loosen source-bound audio manifests, approval hashes, or the explicit `provided-audio` reimport path described in [video](video.md). Complete the source plan before binding audio where practical; do not hand-edit hashes to reuse a previous recording.

## Inspect beats, boundaries and the whole clip

In the representative pilot, watch and listen to the meaningful change, not just the opening title. Inspect the actual frame just before and after a consequential beat, intermediate frames while labels or objects are transitioning, the last and first states at shot/segment boundaries, and the result hold. Clean endpoints do not establish transition readability; sample within the actual transition interval, then inspect neighboring frames around any overlap or mistimed switch. A contact sheet can help find suspect moments but is not video playback or a listening check.

Ask whether the spoken object is visible, whether the action has the right direction and consequence, whether the result can be read, and whether the next shot carries necessary context. Preserve purposeful static reading intervals. Moving pixels, camera drift and changing captions do not establish meaningful mechanism animation.

For each observed defect, record shot/segment identity, timestamp or frame, the expected relationship, the observed mismatch, and the source revision. Reinspect that interval and its neighbors in the new output; an old frame cannot validate a repaired source. Keep unresolved timing, unavailable playback and unperformed listening explicit under [artifact QA](artifact-qa.md). Do not claim that these authoring notes automatically detect defects or prove comprehension.
