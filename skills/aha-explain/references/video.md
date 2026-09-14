# Narrated dynamic video

Read [artifact authoring](artifact-authoring.md), [execution](execution.md), and [artifact QA](artifact-qa.md). The implemented engine captures deterministic browser frames and encodes them with FFmpeg. It does not use Remotion or turn static page fades into a claim of mechanism animation.

## Plan and author

Plan the argument, complete narration, scene responsibilities, visual anchors, and research coverage independently of the report's paragraph structure. Narration explains causes and transitions; the screen shows the mechanism rather than repeating every spoken word. Choose a practical duration/resource budget with the user, not a universal clip-length limit.

Author the source and the plan's `segments[].text` narration together, with stable segment identities. Use [the exact video contract](video-contract.md) for plan and audio-list fields. There is no implicit narration file or slide-notes input. Keep the Clawpilot theme roles while designing topic-specific HTML/SVG/canvas motion: relationship movement, condition changes, state transitions, data progression, and local emphasis. Static reading pauses are legitimate; only adding whole-page fades is not sufficient dynamic explanation.

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

## Prepare, review, approve

All commands use the installed entry:

```text
node "<absolute installed skill>/scripts/aha.mjs" doctor --media
node "<absolute installed skill>/scripts/aha.mjs" explain-check <project-directory>
node "<absolute installed skill>/scripts/aha.mjs" prepare-video <project-directory> <new-plan.json>
node "<absolute installed skill>/scripts/aha.mjs" video-plan-check <project-directory> <plan.json>
```

`prepare-video` creates a draft plan with suggested claim text, not a finished script. Replace suggestions with authored complete narration, set the plan's own `status` to `"authored"`, then run `video-plan-check`. Present the **complete current narration** for every segment, provider, voice, rate, disclosure scope, timing strategy, and the current `planHash` to the user. A hash-only summary is insufficient. Preparation or checking is not consent and does not synthesize audio.

Edge TTS is online. Verify applicable service terms and permission to transmit the approved text. Do not send private research, raw source code, source inventories, or speaker audit notes as a convenience. The user must approve the actual current narration and voice configuration; a request for video alone does not authorize upload.

```text
node "<absolute installed skill>/scripts/aha.mjs" synthesize <project-directory> <plan.json> <new-audio-dir> --approve <planHash> --allow-network
```

`--approve` reflects real user sign-off; `--allow-network` separately permits external speech processing. Never fill them merely to make a command succeed. Changed narration, provider, voice, or rate requires plan validation and fresh approval. Do not hand-edit hashes to reuse an incompatible audio manifest.

For the explicitly selected offline alternative, use `provided-audio` and the import contract:

```text
node "<absolute installed skill>/scripts/aha.mjs" import-audio <project-directory> <plan.json> <audio-list.json> <new-audio-dir> --approve <planHash>
```

This is user-supplied audio, not successful Edge TTS. Check that supplied speech matches the approved narration and that the audio is authorized for use. Do not silently switch providers after a network or dependency failure.

## Render and review

Use actual audio durations and plan/segment identities to derive timing. The current renderer delivers 1280 × 720 at 30 fps, H.264/AAC, with sentence/segment-level burned captions and an SRT sidecar; it does not provide word alignment. Do not force target length by distorting speech speed. The implemented resource ceiling is 600 seconds, with a maximum of 200 narration segments; choose a smaller working budget or split a longer work explicitly.

Review source code and obtain separate local execution approval before browser capture:

```text
node "<absolute installed skill>/scripts/aha.mjs" render-video <project-directory> <plan.json> <audio-dir> <new.mp4> --approve <planHash> --allow-code
```

The runtime is not a universal sandbox. The local execution flag is not TTS permission, and audio approval does not grant arbitrary script execution.

Inspect the rendered pilot and final file by actual playback: listen for pronunciation, missing or clipped speech, pacing, and segment continuity; watch mechanism changes, narration alignment, readable labels, glyphs, caption safe areas, and end frames. Record capture/encoding success separately from this review. Sampled pixel changes are not proof of a meaningful animation, and a successful render does not verify deterministic replay. If playback, browser, FFmpeg, or a speech dependency is unavailable, report the incomplete stage without automatic installs.

Preserve editable source, complete approved narration, plan identity, audio manifest, captions, render settings, and actual QA notes. A color-only source revision does not itself authorize or require another online synthesis; reuse audio only if runtime plan and project identity checks still accept it. If they do not, rebuild and revalidate rather than forging identity or assuming visual edits cannot affect timing.
