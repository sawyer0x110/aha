# Narrated dynamic video

Use [artifact authoring](artifact-authoring.md) for the project contract; load [execution](execution.md) before code execution or speech upload, and full [artifact QA](artifact-qa.md) at review. The implemented engine captures deterministic browser frames and encodes them with FFmpeg. It does not use Remotion or turn static page fades into a claim of mechanism animation.

## Plan and author

Select metadata language under [language](language.md), then author scene text, narration, captions, citations, and limitations in that language. Draft claim suggestions are not translated narration.

Plan the argument, complete narration, scene responsibilities, visual anchors, and research coverage independently of the report's paragraph structure. Narration explains causes and transitions; the screen shows the mechanism rather than repeating every spoken word. Choose a practical duration/resource budget with the user, not a universal clip-length limit.

Author the source and the plan's `segments[].text` narration together, with stable segment identities. Load [the exact video contract](video-contract.md) when authoring plan or audio-list fields. There is no implicit narration file or slide-notes input. Use [visual design](visual-design.md) and optionally one [theme section](design-themes.md), such as the high-contrast kinetic mechanism recipe. Set an explicit root light/dark author preference for stable capture styling. Design topic-specific HTML/SVG/canvas motion: relationship movement, condition changes, state transitions, data progression, and local emphasis. Static reading pauses are legitimate; only adding whole-page fades is not sufficient dynamic explanation.

The source must define:

```js
window.ahaVideo = {
  async renderFrame({ frame, fps, segmentIndex, segmentFrame, segmentFrames, text }) {
    const progress = segmentFrames > 1 ? segmentFrame / (segmentFrames - 1) : 1;
    // Set the entire scene deterministically from these inputs.
  },
};
```

This is a calling-convention sketch, not an authored scene. Create actual content, scene elements, and coverage before setting the project to `authored`. The runtime calls and awaits the callback once for every frame. Derive motion from supplied frame/timing inputs, not wall-clock time, random values, background timers, or accumulated state. Autonomous CSS animations and transitions are disabled during capture; explicitly set the frame's state. Browser capture may revisit a frame; the result must be reproducible. Use local assets; no remote fonts, CDN, or unapproved network.

Begin with a representative 20–30 second pilot: show a mechanism moving from A to B, a condition change, localized emphasis, two coherent narration sentences, captions, and a natural source cue. Obtain any necessary revised narration approval for a separately prepared pilot plan. Watch and listen before scaling to the complete video.

Before requesting speech, inspect representative authored scene states with the planned narration and caption area in mind, especially dense diagrams and long labels. This catches layout defects before audio becomes source-bound; it does not replace the rendered pilot, listening or execution approval. For replay checks, render state A, a different state B, then A again and compare both A captures. Sampled reproducibility is not proof of every frame's correctness or meaningful motion.

## Prepare, review, approve

All commands use the installed entry:

```text
node "<absolute installed skill>/scripts/aha.mjs" doctor --for video
node "<absolute installed skill>/scripts/aha.mjs" explain-check <project-directory>
node "<absolute installed skill>/scripts/aha.mjs" prepare-video <project-directory> <new-plan.json>
node "<absolute installed skill>/scripts/aha.mjs" video-plan-check <project-directory> <plan.json>
```

`prepare-video` creates a draft plan with suggested claim text, not a finished script. Replace suggestions with authored complete narration, set the plan's own `status` to `"authored"`, then run `video-plan-check`. Present the **complete current narration** for every segment, provider, voice, rate, disclosure scope, timing strategy, and the current `planHash` to the user. A hash-only summary is insufficient. Preparation or checking is not consent and does not synthesize audio.

Voice defaults and translation behavior are in the language contract; the plan stores an explicit voice. Edge TTS is online. Before choosing synthesis, use `doctor --for speech` for local dependency probes only, verify applicable service terms, and apply the separate narration/network approvals in execution. Transmit only approved narration, not the Dossier, raw source code, or audit notes.

```text
node "<absolute installed skill>/scripts/aha.mjs" synthesize <project-directory> <plan.json> <new-audio-dir> --approve <planHash> --allow-network
```

Changed narration, provider, voice, or rate requires plan validation and fresh approval of the complete current plan; stale consent is not transferable through edited hashes.

For the explicitly selected offline alternative, use `provided-audio` and the import contract:

```text
node "<absolute installed skill>/scripts/aha.mjs" import-audio <project-directory> <plan.json> <audio-list.json> <new-audio-dir> --approve <planHash>
```

This is user-supplied audio, not successful Edge TTS. Check that supplied speech matches the approved narration and that the audio is authorized for use. Do not silently switch providers after a network or dependency failure.

## Render and review

Use actual audio durations and plan/segment identities to derive timing. The current renderer delivers 1280 × 720 at 30 fps, H.264/AAC, with sentence/segment-level burned captions and an SRT sidecar; it does not provide word alignment. Do not force target length by distorting speech speed. The implemented resource ceiling is 600 seconds, with a maximum of 200 narration segments; choose a smaller working budget or split a longer work explicitly.

Frame budgets use exact stream ticks and their time base when available, including sample counts for normalized PCM. Already frame-aligned recordings therefore do not gain a frame from ffprobe's decimal rounding when reimported. A remaining partial frame is padded up, never rounded down to discard samples. If exact ticks are unavailable, the measured decimal duration is used conservatively rather than applying a guessed tolerance.

Burned captions and SRT derive from authored `segments[].text`, not automatic translation. Check Chinese fonts or longer English labels, pronunciation, units, negation, and uncertainty against the approved narration and research.

Review source code and obtain separate local execution approval before browser capture:

```text
node "<absolute installed skill>/scripts/aha.mjs" render-video <project-directory> <plan.json> <audio-dir> <new.mp4> --approve <planHash> --allow-code
```

Apply the execution contract's local-code boundary independently of audio approval.

The current renderer places burned captions in a separate overlay: centered 28px sans-serif white text on a translucent black background, with 64px side margins and a 24px bottom margin. Authored scene CSS does not restyle that overlay. Reserve this area and compose around it; the theme recipes do not add a caption-style API or promise arbitrary subtitle typography.

Inspect the rendered pilot and final file by actual playback: listen for pronunciation, missing or clipped speech, pacing, and segment continuity; watch mechanism changes, narration alignment, readable labels, glyphs, caption safe areas, and end frames. Record capture/encoding success separately from this review. Sampled pixel changes are not proof of a meaningful animation, and a successful render does not verify deterministic replay. Report only the affected stage as blocked: synthesis needs speech dependencies, provided-audio import does not need Edge TTS, and rendering needs browser/FFmpeg/ffprobe. Missing playback leaves actual QA unperformed.

Include the complete approved narration, plan identity, audio manifest, captions and render settings in the working record under [artifact authoring's delivery lifecycle](artifact-authoring.md#working-history-and-current-delivery). A color-only source revision does not itself authorize or require another online synthesis; reuse audio only if runtime plan and project identity checks still accept it. If they do not, rebuild and revalidate rather than forging identity or assuming visual edits cannot affect timing.

When a visual revision invalidates the binding but narration is unchanged, an explicitly approved option is a new `provided-audio` plan importing the previously authorized recordings through [the audio-list contract](video-contract.md). Show the complete narration and new plan hash for approval, retain original speech provenance, and label the new receipt as an import rather than another Edge synthesis. Check the new measured timing and captions; normalization or padding can change frame counts even with unchanged words. Do not edit hashes to force reuse or treat prior consent as approval of the new plan.
