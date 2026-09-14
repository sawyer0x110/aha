# Video plan and audio contract

Use alongside [the video workflow](video.md). These are implemented `1.0.0` contracts, not a free-form storyboard schema. Keep plan/audio/output files outside the source project so preparing a plan does not change its own source identity.

## Editable VideoPlan

`prepare-video` writes the following required fields; extra properties are rejected:

| Field | Contract |
| --- | --- |
| `schemaVersion`, `status` | `"1.0.0"` and `"draft"` or `"authored"`. A generated plan starts draft; author its narration before approval. |
| `researchHash`, `sourceHash` | Current research and source identities, generated from the project. Do not invent or hand-edit hashes to evade a mismatch. |
| `provider` | `"edge-tts"` or explicitly chosen `"provided-audio"`. |
| `voice` | Explicit identifier; initialization defaults follow [language](language.md). Existing authored plans are not rewritten. For imported speech use a stable alphanumeric/hyphen label such as `user-recording`. |
| `rate` | Signed percentage from `-30%` through `+30%`; default `+0%`. This does not time-stretch imported audio. |
| `duration` | `{ minSeconds, maxSeconds }`, both positive, ordered, and at most 600 seconds. This is an approved range checked against measured audio, not a predicted exact duration. |
| `segments` | 1–200 ordered `{ id, text, claimIds }` objects. IDs are unique, lowercase, begin with a letter, and contain lowercase letters, digits, or hyphens, at most 64 characters. |

`text` contains the complete narration for that segment (1–1000 characters, nonblank, no control characters/newlines or U+2028/U+2029 separators). Keep segments short enough for the three-line sentence-level caption overlay; split sentences when captions do not fit. `claimIds` references existing research; every claim declared covered by the artifact must appear somewhere in the narration's reference lists. Extra rhetorical transitions may have no claim IDs but must not introduce unsupported factual assertions.

Author narration in the selected artifact language under [language](language.md). A translation changes the exact plan hash and follows the same validation and fresh approval path as any other narration change.

There is no stored `planHash` field: `video-plan-check` computes the hash of the exact plan for approval. After authoring the visual project, prepare a plan bound to that source, finish the narration, validate, and show the full current content before asking for sign-off. Research/source identity changes are errors; create a fresh bound plan rather than manually forcing old identities to match.

The frame callback receives global zero-based `frame`, `fps` (30), zero-based `segmentIndex`, segment-local zero-based `segmentFrame`, measured `segmentFrames`, and approved narration `text`. Derive visual anchors in author source from these inputs; there are no schema fields for arbitrary storyboard objects or per-word timing.

## Import list

For `provided-audio`, author a JSON file with exactly one local file per approved segment, in identical order:

```json
{
  "segments": [
    { "id": "sentence-1", "file": "speech-1.wav" },
    { "id": "sentence-2", "file": "speech-2.mp3" }
  ]
}
```

Replace these sample IDs with actual plan segment IDs. Relative `file` paths resolve from the audio-list file's directory. Supported input extensions are WAV, MP3, and M4A. Verify speech/content and permission manually; a filename/ID match does not prove the spoken words match.

Import/synthesis measures each segment, rounds duration up to 30-fps frames, and normalizes it to mono 48 kHz PCM WAV with end padding where necessary. It does not invent speech or claim exact word boundaries.

## Generated audio and outputs

Online synthesis requires the installed Python `edge-tts==7.2.8` adapter plus FFmpeg/ffprobe; `doctor --for speech` probes these locally without network access. Provided-audio import needs FFmpeg/ffprobe but not Edge TTS; video rendering needs browser/FFmpeg/ffprobe but no speech adapter. Missing dependencies block the corresponding step, not the entire workflow. See [execution](execution.md) for installation and disclosure permissions.

The new audio directory contains `manifest.json` and `segment-001.wav`, `segment-002.wav`, and so on. The manifest contains `schemaVersion`, `planHash`, `provider`, `voice`, and ordered `segments` with `id`, `filename`, `sha256`, and `frames`. These hashes and timings are generated from actual files, not author inputs to fabricate. Validation checks files, format, order, identity, and measured duration. An incomplete audio directory with a failure record is not renderable completion.

Rendering writes the new MP4 plus `<new.mp4>.srt` and `<new.mp4>.json` receipt. Captions are burned in and also exported as sentence/segment-level SRT. Encoding/sample hashes and codec checks do not establish a useful explanation or visual quality: actually watch and listen.

Both caption forms derive from authored `segments[].text`; neither automatically translates it. Verify language, fonts, pronunciation, and semantic fidelity during playback.

The render budget is 30 minutes, with at most 1 GiB of transient PNG frames per segment and 256 MiB for the final video. Use shorter segments or explicitly split larger work instead of bypassing limits. A failed render may leave `<new.mp4>.failure.json`, not a success receipt.

Current audio manifests are bound to the complete plan, including its visual `sourceHash`. Even a visual-only source change invalidates that binding. Do not promise seamless cross-revision audio reuse or forge hashes. Preserve authorized original audio; a new `provided-audio` plan can explicitly import it with renewed current-plan approval and no online synthesis, after verifying unchanged speech. Disclose the provider/identity change instead of labelling the import as a new Edge synthesis.
