# Aha examples

**English** | [简体中文](README.zh-CN.md)

Start with the [local gallery](index.html) or the [new Aha video introduction (Chinese topic notes)](aha-introduction/README.md). Three topics were independently researched again on 2026-09-16, each with four formats. On 2026-09-17, a Greenland video, CPython and Docker mechanism pilots, and a new project introduction with an overview–examples–summary structure were added: **seven example groups and sixteen artifacts**. The earlier and new project introductions use different research snapshots and remain separate; they are not presented as one four-format edition. The gallery and three interactive HTML explanations open in English with a Chinese switch. PNGs, native PPTX slides, and narrated videos are in English. Topic READMEs remain in Chinese and have not been translated. The first four topics have Chinese research reports; the two code pilots and new introduction have English research reports.

GitHub's source preview does not run interactive HTML. Download or clone the repository and open `examples/index.html` in a browser; use the links to view or download PNG, PPTX, MP4, and subtitle files with a suitable local viewer. **Artifacts** are the reader-facing explanations. Research, receipts, hashes, approvals, and review records are **evidence** for checking sources and production history—not additional artifacts or proof that pending reviews have passed.

| Topic (notes in Chinese) | HTML | PNG | Native PPTX | Narrated video |
| --- | --- | --- | --- | --- |
| [Noise-cancelling headphones](anc/README.md) | [Interactive explanation](anc/index.html) | [1800×1200](anc/anc.png) | [9 slides](anc/anc.pptx) | [127.1 seconds](anc/anc.mp4) |
| [Git merge](git-merge/README.md) | [Interactive explanation](git-merge/index.html) | [1800×1200](git-merge/git-merge.png) | [10 slides](git-merge/git-merge.pptx) | [126.27 seconds](git-merge/git-merge.mp4) |
| [Aha tour: earlier research snapshot](project-overview/README.md) | [Interactive tour](project-overview/index.html) | [New capabilities diagram · 1080×1800](project-overview/overview.png) | [10 slides](project-overview/overview.pptx) | [148.43 seconds · earlier version](project-overview/overview.mp4) |
| [Greenland and map projections](greenland/README.md) | Not requested | Not requested | Not requested | [115.73 seconds](greenland/greenland.mp4) |
| [CPython strings](cpython-string/README.md) | Not requested | Not requested | Not requested | [21.47-second pilot](cpython-string/pilot.mp4) |
| [Docker image layers](docker-layers/README.md) | Not requested | Not requested | Not requested | [21.27-second pilot](docker-layers/pilot.mp4) |
| [New Aha introduction](aha-introduction/README.md) | Not requested | Not included | Not requested | [119.4 seconds](aha-introduction/overview-v5.mp4) |

The user selected the new capabilities diagram on 2026-09-17; it now replaces `project-overview/overview.png`. It explains only the project's purpose, its two skills, and four media formats, without case studies. It reuses that directory's original research snapshot and is not presented as sharing the new video's snapshot. The count remains sixteen; the previous image is retained in Git history.

The landscape ANC and Git infographics target desktop/document reading at least 1200px wide; they do not promise zoom-free phone reading. Browser text boundaries were checked for the new portrait Aha diagram, and 390px/540px scaled previews were generated. Image-tool limitations prevented the agent's actual visual review; the user selected it. See the [new image inclusion record](../evals/examples/overview-image-20260917/publication.json). Earlier visual records do not apply to the new image, and more pixels are not a substitute for readability.

## Current directory contract

- Each topic root retains only included artifacts, accompanying receipts, video SRT subtitles, and `video-plan.json`. Greenland, CPython, Docker, and the new introduction are video-only here.
- `projects/{html,image,pptx,video}/` retains independent author source, metadata, assets, and the research copies required by the runtime. The publication migration did not change those bytes.
- `research/` contains the topic's archived research report, evidence, and manifest. The project tour records source and example snapshots from the time of research, not live page screenshots.
- `audio/` retains the current audio manifest and WAV files. The first three examples and new introduction use imported recordings. `audio-origin/` retains original narration plans, original manifests or failure records, and byte-identity mappings from original recordings to current files. Imported WAVs are identical to the original synthesized WAVs, so only one copy is stored. Greenland, CPython, and Docker use direct Edge TTS synthesis without a fabricated import-origin directory. Docker's current recordings come from the approved second synthesis; the first attempt's insufficient-duration failure record is archived separately. After layout corrections, the new introduction imported its original thirteen recordings offline; this is not presented as another online synthesis.
- Git's `public/` retains the pinned upstream files that were read, their licenses, and access records. The additional animated presentation has a separate post-processing audit and does not reuse the base presentation's receipt.
- The [delivery manifest](delivery-manifest.json) indexes the sixteen current artifacts and their research, source, and output hashes. [First-three-example review records](../evals/examples/refresh-20260916/), [Greenland review records](../evals/examples/greenland-20260917/), the [code-pilot inclusion record](../evals/examples/code-pilots-20260917/publication.json), and the [new introduction record](../evals/examples/aha-introduction-20260917/publication.json) live in `evals`, outside the artifact narratives.

`examples` retains each group's final artifacts and reproduction materials; earlier versions remain in Git history (`4b87e4c` before the new image replacement). Following the user's explicit cleanup request, candidates, duplicate renders, temporary audio, and local backups in this round's ten media-production directories were deleted. Required approval and review records remain in `evals`; independent skill-evaluation materials were not deleted. Earlier review records describe only earlier versions and are not evidence that a newer version passed. Absolute paths in historical receipts retain their original meaning even when the original production directory has been cleaned up; use the delivery manifest for current paths.

## Content and review boundaries

ANC illustrates ideal sound-pressure superposition at one location, not headphone measurements, decibels, or perceived loudness. Speech retaining recognizable cues does not imply that no headphones can attenuate speech.

Git research reads the pinned v2.55.0 manual and `merge-ort.c`; no new Git experiment was run. Simplified interface states are not command results. Ordinary revert, merge revert, reset, `-s ours`, and `-Xours` are distinguished. A successful text merge does not prove correct program behavior.

Aha research pins local commit `31ff1331`, whose tree matched the then-main-branch commit `c98b1927`. Existing ANC/Git pages in the tour belong to that snapshot; they are not claimed to be this round's new pages. Host document skills, Clawpilot styling, and external media tools also contributed to production, so these are not controlled experiments isolating Aha's effects.

The Greenland example explains high-latitude enlargement with spherical Mercator, using rigid rotation of real generalized boundaries on a sphere rather than two-dimensional scaling. The local fourfold area factor at 60° does not describe all of Greenland. Equal Earth's area preservation does not preserve every shape. See the topic's research report for detailed sources and the limitation that the body of the official statistics was not verified.

The CPython pilot compares string-object sizes and UTF-8 payloads for the specific CPython 3.11.15 implementation. U+1F600 makes the new result use a four-byte code-point representation; it does not change the original string, and the result does not apply to every emoji or Python implementation. Docker's 100 MB is an assumed payload; no build was executed. The merged view after deletion must be distinguished from immutable layer data, and the same-RUN comparison applies only to newly created temporary files.

Current records cover bilingual pages at desktop/phone widths and their interactions, native slide rendering and in-memory text editing, rechecks after layout corrections, complete video decoding, subtitle text, and encoded scene frames. **The user has watched and listened to the earlier four mechanism pilots and the revised pilot for the new introduction. Continuous viewing/listening of the standalone CPython and Docker pilots and full videos, and actual presentation playback of Git's additional animated version, remain unconfirmed.** The new introduction preserves the review process: introduce only the project on the opening screen, add chapter transitions, remove repeated sentences, and fix Docker lines crossing text. Some image reads were limited; no complete frame-by-frame visual acceptance is claimed. Human understanding-transfer studies, independent human translation review, physical-phone testing, and screen-reader acceptance are incomplete.

## License and third-party boundaries

Original repository source is provided under the [MIT license](../LICENSE), subject to the coverage and exclusions in [License scope](../docs/LICENSE-SCOPE.md). This is **not a blanket relicensing of the examples directory**. Upstream files and excerpts, third-party materials, speech-service and recording rights, and font licenses do not become MIT-licensed by inclusion; their own licenses, attribution requirements, and service terms still apply. Receipts, source records, and the ability to view an artifact locally do not themselves grant those third-party rights.

## Local reproduction

Identity checks do not execute author code:

```powershell
npm run build
npm run examples:verify
```

The unified verifier checks sixteen artifacts, research copies, receipts, current audio, and original narration provenance where applicable. The code pilots and new introduction also bind approved plans, preview status, encoding records, and evidence hashes. Regression cases check identity mismatches, rejection of incorrect evidence even after resealing, and reconstruction of source corresponding to original narration. The updated offline browser checks cover the three explanations in English/Chinese, light/dark themes, and 1280px/390px widths. The current [pre-publication recheck](../evals/examples/refresh-20260916/browser-recheck/runtime.json) records 24 scenarios and 96 checks.

After reviewing the pages and obtaining local execution approval, save new browser results to a directory that does not yet exist, without overwriting archived records:

```powershell
node .\evals\examples\check-html.mjs --allow-code --output artifacts\examples-browser-new --screenshots
```

For example, rebuild ANC into a new directory rather than overwriting current artifacts or receipts. Before PNG/PPT/video execution, review author source and obtain separate local execution approval:

```powershell
node .\dist\cli\aha.mjs render-html .\examples\anc\projects\html .\artifacts\anc-rebuild\index.html
node .\dist\cli\aha.mjs render-image .\examples\anc\projects\image .\artifacts\anc-rebuild\anc.png --allow-code
node .\dist\cli\aha.mjs render-pptx .\examples\anc\projects\pptx .\artifacts\anc-rebuild\anc.pptx --allow-code
node .\dist\cli\aha.mjs video-plan-check .\examples\anc\projects\video .\examples\anc\video-plan.json
```

When source, narration, and research bindings are unchanged, video can be rendered again offline using the check's current `planHash` and current `audio/`. Code or text changes require a new plan and corresponding approval; the command-line `--approve` flag is not authorization itself. Online narration requires separate disclosure and approval of the complete narration, provider, voice, rate, and scope of data sent externally.

On Windows, the pinned media environment can live at `%LOCALAPPDATA%\Aha\media-venv`. Install the repository's locked `requirements-media.txt` and point the user-level `AHA_PYTHON` variable at its `Scripts\python.exe`. Reuse an existing environment rather than deleting it when switching worktrees or cleaning production intermediates; only new processes automatically inherit updated user environment variables. Do not commit machine environments.

`examples/.gitattributes` and `evals/examples/.gitattributes` disable automatic line-ending conversion so Windows checkout does not change the exact bytes of research, source, artifacts, or review records.
