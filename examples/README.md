# Aha examples

**English** | [简体中文](README.zh-CN.md)

Start with the [Aha introduction](aha-introduction/README.md), the only retained project introduction, or the [local gallery](index.html). There are **six example groups and sixteen artifacts**. The introduction's bilingual HTML, Chinese PNG, and 8-slide Chinese native PPTX use the current `aha-explain` guidance and its September 17 research snapshot; the original English video is unchanged. All four current PPTX decks use the iterated guidance. Git HTML and the Docker video now use the accepted second-round task/storyboard outputs; their research snapshots and other formats are unchanged. Git HTML is a Chinese-only plan review; ANC and introduction HTML open in English with a Chinese switch. Other PNGs and all narrated videos are English; topic notes are Chinese. Research reports retain their original languages.

GitHub's source preview does not run interactive HTML. Download or clone the repository and open `examples/index.html` in a browser; use the links to view or download PNG, PPTX, MP4, and subtitle files with a suitable local viewer. **Artifacts** are the reader-facing explanations. Research, receipts, hashes, approvals, and review records are **evidence** for checking sources and production history—not additional artifacts or proof that pending reviews have passed.

| Topic (notes in Chinese) | HTML | PNG | Native PPTX | Narrated video |
| --- | --- | --- | --- | --- |
| [Aha introduction · start here](aha-introduction/README.md) | [Bilingual explanation](aha-introduction/index.html) | [Chinese · 1080×1920](aha-introduction/overview.png) | [8 slides · Chinese](aha-introduction/overview.pptx) | [119.4 seconds](aha-introduction/overview-v5.mp4) |
| [Noise-cancelling headphones](anc/README.md) | [Interactive explanation](anc/index.html) | [1800×1200](anc/anc.png) | [7 slides · Chinese](anc/anc.pptx) | [127.1 seconds](anc/anc.mp4) |
| [Git merge](git-merge/README.md) | [Chinese plan review](git-merge/index.html) | [1800×1200](git-merge/git-merge.png) | [8 slides · Chinese](git-merge/git-merge.pptx) | [126.27 seconds](git-merge/git-merge.mp4) |
| [Greenland and map projections](greenland/README.md) | Not requested | Not requested | [7 slides · Chinese](greenland/greenland.pptx) | [115.73 seconds](greenland/greenland.mp4) |
| [CPython strings](cpython-string/README.md) | Not requested | Not requested | Not requested | [21.47-second pilot](cpython-string/pilot.mp4) |
| [Docker image layers](docker-layers/README.md) | Not requested | Not requested | Not requested | [21.27-second pilot](docker-layers/pilot.mp4) |

The introduction's four formats share its research snapshot, not identical layouts or detail. HTML and PPTX develop the three case mechanisms; the independent portrait infographic summarizes the skills, media choices, and distinctions.

The landscape ANC and Git infographics target desktop/document reading at least 1200px wide; they do not promise zoom-free phone reading. The introduction poster targets scrolling at approximately 390px display width; its current checks are bound in the [introduction publication record](aha-introduction/publication.json).

## Current directory contract

- Each topic root retains the latest included version of each format, accompanying receipts, video SRT subtitles, and `video-plan.json`. The introduction, ANC, and Git each have four formats; Greenland has PPTX and video; CPython and Docker are video-only.
- `projects/{html,image,pptx,video}/` retains the matching author source, metadata, project-local assets, and research copies. PPTX `qa/` holds the current PowerPoint observations and slide exports, excluded from source identity.
- `research/` contains the topic's archived research report, evidence, and manifest. Historical descriptions remain sealed; use the delivery manifest for the current gallery inventory.
- `audio/` retains the current audio manifest and WAV files. ANC, Git, Docker, and the introduction use imported recordings. `audio-origin/` retains original narration plans, original manifests or failure records, and byte-identity mappings from original recordings to current files. Imported WAVs are identical to the original synthesized WAVs, so only one copy is stored. Greenland and CPython retain direct Edge TTS synthesis. Docker's new scene imports its approved second-synthesis recordings offline; its original plan and the single added on-screen-only claim association are explicit. The first attempt's insufficient-duration failure record remains historical. The introduction likewise imported its original thirteen recordings offline, not via another online synthesis.
- Git's `public/` retains the pinned upstream files that were read, their licenses, and access records.
- The [delivery manifest](delivery-manifest.json) indexes all sixteen current artifacts. The [PPTX publication record](pptx-publication.json) binds the four decks to their sources, receipts, skill provenance, current application observations, and explicit review limits. The introduction's [publication record](aha-introduction/publication.json) binds its new HTML and image observations. Earlier non-PPT evidence remains in `evals`; historical observations do not validate newer outputs.

`examples` is the current gallery, not a collection of baseline/candidate variants. A skill-iteration output replaces its format only together with matching source, resources, receipt, and current evidence. Earlier versions, including the superseded Git animation derivative, remain in Git history. New generation does not refresh the underlying research automatically; use the delivery manifest for current paths and identities.

## Content and review boundaries

ANC illustrates ideal sound-pressure superposition at one location, not headphone measurements, decibels, or perceived loudness. Speech retaining recognizable cues does not imply that no headphones can attenuate speech.

Git research reads the pinned v2.55.0 manual and `merge-ort.c`; no new Git experiment was run. Simplified interface states are not command results. Ordinary revert, merge revert, reset, `-s ours`, and `-Xours` are distinguished. A successful text merge does not prove correct program behavior.

The Aha introduction reuses the September 17 synthesis; it is not a fresh investigation of today's code or a rerun of the inherited experiments. Host document skills, Clawpilot styling, and external media tools also contributed to production, so these are not controlled experiments isolating Aha's effects.

The Greenland example explains high-latitude enlargement with spherical Mercator, using rigid rotation of real generalized boundaries on a sphere rather than two-dimensional scaling. The local fourfold area factor at 60° does not describe all of Greenland. Equal Earth's area preservation does not preserve every shape. See the topic's research report for detailed sources and the limitation that the body of the official statistics was not verified.

The CPython pilot compares string-object sizes and UTF-8 payloads for the specific CPython 3.11.15 implementation. U+1F600 makes the new result use a four-byte code-point representation; it does not change the original string, and the result does not apply to every emoji or Python implementation. Docker's 100 MB is an assumed payload; no build was executed. The merged view after deletion must be distinguished from immutable layer data, and the same-RUN comparison applies only to newly created temporary files.

Current PPTX records distinguish native structure and PowerPoint open/export/copy-edit checks from bounded visual observations. The updated guides do not guarantee that every latest deck is aesthetically better: inherited explanatory or spacing issues are recorded, not hidden. Other records cover bilingual page interactions and video decoding, subtitles, and sampled frames. **Continuous viewing/listening of the standalone CPython and Docker pilots and full videos remains unconfirmed.** Human understanding-transfer studies, independent human translation review, physical-phone testing, and screen-reader acceptance are incomplete.

## License and third-party boundaries

Original repository source is provided under the [MIT license](../LICENSE), subject to the coverage and exclusions in [License scope](../docs/LICENSE-SCOPE.md). This is **not a blanket relicensing of the examples directory**. Upstream files and excerpts, third-party materials, speech-service and recording rights, and font licenses do not become MIT-licensed by inclusion; their own licenses, attribution requirements, and service terms still apply. Receipts, source records, and the ability to view an artifact locally do not themselves grant those third-party rights.

## Local reproduction

Identity checks do not execute author code:

```powershell
npm run build
npm run examples:verify
```

The unified verifier checks sixteen artifacts, research copies, receipts, current audio, and original narration provenance where applicable. Current PPTX observations and page images are hash-bound separately from historical slide evidence. The code pilots and introduction video also bind approved plans, preview status, encoding records, and evidence hashes. Regression cases reject stale identities and incorrect evidence even after resealing. Existing [browser checks](../evals/examples/refresh-20260916/browser-recheck/runtime.json) remain current for ANC, not the replaced Git page. The [task/video publication](../evals/examples/task-video-20260922/publication.json) binds the current Chinese Git page and revised Docker video; the introduction has separate evidence. Docker's auxiliary text remains small at 640px playback width; actual listening and human comprehension were not assessed. Temporary comparison outputs were removed after promotion; compact evidence and generation-time identities remain.

After reviewing the ANC and Git pages and obtaining local execution approval, save new browser results to a directory that does not yet exist, without overwriting archived records:

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
