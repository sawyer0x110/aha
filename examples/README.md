# Aha examples

**English** | [简体中文](README.zh-CN.md)

Start with the [Aha introduction](aha-introduction/README.md) or the [local gallery](index.html). There are **five example groups and twenty-one artifacts**. The introduction has restructured English and Chinese videos; its HTML, PNG and PPTX are unchanged. ANC, Greenland, CPython strings and Docker layers each have four formats. All five PPTX decks are Chinese. HTML opens in English with a Chinese switch; the other four topics' PNGs and videos are English. The introduction PNG and all topic notes are Chinese. Research reports retain their original languages.

GitHub's source preview does not run interactive HTML. Download or clone the repository and open `examples/index.html` in a browser; use the links to view or download PNG, PPTX, MP4, and subtitle files with a suitable local viewer. **Artifacts** are the reader-facing explanations. Research, receipts, hashes, approvals, and review records are **evidence** for checking sources and production history—not additional artifacts or proof that pending reviews have passed.

| Topic (notes in Chinese) | HTML | PNG | Native PPTX | Narrated video |
| --- | --- | --- | --- | --- |
| [Aha introduction · start here](aha-introduction/README.md) | [Bilingual explanation](aha-introduction/aha-introduction.html) | [Chinese · 1080×1920](aha-introduction/aha-introduction.png) | [8 slides · Chinese](aha-introduction/aha-introduction.pptx) | [English · 154.53s](aha-introduction/aha-introduction.en.mp4) / [中文 · 151.07s](aha-introduction/aha-introduction.zh.mp4) |
| [Noise-cancelling headphones](anc/README.md) | [Bilingual interactive explanation](anc/anc.html) | [1800×1600](anc/anc.png) | [7 slides · Chinese](anc/anc.pptx) | [78.53 seconds](anc/anc.mp4) |
| [Greenland and map projections](greenland/README.md) | [Bilingual interactive explanation](greenland/greenland.html) | [1800×1600](greenland/greenland.png) | [7 slides · Chinese](greenland/greenland.pptx) | [80.80 seconds](greenland/greenland.mp4) |
| [CPython strings](cpython-string/README.md) | [Bilingual interactive explanation](cpython-string/cpython-string.html) | [1800×1600](cpython-string/cpython-string.png) | [7 slides · Chinese](cpython-string/cpython-string.pptx) | [63.23 seconds](cpython-string/cpython-string.mp4) |
| [Docker image layers](docker-layers/README.md) | [Bilingual interactive explanation](docker-layers/docker-layers.html) | [1800×1600](docker-layers/docker-layers.png) | [7 slides · Chinese](docker-layers/docker-layers.pptx) | [58.30 seconds](docker-layers/docker-layers.mp4) |

The introduction videos explain the project, research methods and boundaries, Explain's formats and languages, then four real medium-specific examples and a concise installation invitation. They share updated research; unchanged HTML, PPTX and PNG retain their earlier snapshot. HTML and PPTX develop three case mechanisms; the independent portrait infographic summarizes the skills, media choices, and distinctions.

The four new infographics target desktop/document reading at least 1200px wide; they do not promise zoom-free phone reading. The unchanged introduction poster targets scrolling at approximately 390px display width; its checks remain bound in the [delivery manifest](delivery-manifest.json).

## Current directory contract

- Each topic root retains its current formats, receipts and video SRT subtitles. Single-version video uses `video-plan.json`; the introduction uses `video-plans/en.json` and `video-plans/zh.json`.
- `projects/<format>/` retains author source, metadata, local assets and research copies; QA lives under `qa/<format>/`, outside source. Language variants add `/en/` or `/zh/` to both paths.
- `research/` contains the sealed common dossier. The introduction videos use the sibling `research-video/`; unchanged formats retain their original dossier. Research scope is not a current production inventory.
- `audio/` retains the audio manifest, WAV files and provenance; introduction variants use `audio/en/` and `audio/zh/`. Original voices are Edge TTS Jenny for the four case videos, Aria for the English introduction, and Xiaoxiao for Chinese. Current `provided-audio` plans import approved recordings offline. Per-segment original synthesis plans distinguish new speech from reused recordings; import is not another synthesis.
- The single [delivery manifest](delivery-manifest.json), `schemaVersion: 2`, `layout: "topic-format-language-v1"`, indexes all twenty-one artifacts in `requestedOutputs[]`: paths, language variants, identity, provenance and QA. Format-specific properties belong to each artifact, not separate PPTX, video or language publication manifests.

Artifacts use `<topic>.html/.png/.pptx/.mp4`; multiple language versions use `<topic>.<language>.<ext>`. Receipts use `<artifact>.receipt.json`, and video subtitles use `<artifact>.srt`. Only `examples/index.html` is a gallery entry. Receipts and QA references name current files directly; metadata hashes are updated together. There are no migration maps, old publication manifests or archive dependencies. `evals/examples/` contains reusable checking tools. Metadata maintenance does not claim a new render or review. See the [shared output layout](../skills/shared/references/output-layout.md) for working tasks.

`examples` is the current gallery, not a collection of baseline/candidate variants. Replace an artifact together with its matching source, resources, receipt and applicable QA. Do not carry superseded comparisons, failure logs or copies of old versions into the delivery. New generation does not refresh the underlying research automatically.

## Content and review boundaries

ANC illustrates ideal sound-pressure superposition at one location, not headphone measurements, decibels, or perceived loudness. Speech retaining recognizable cues does not imply that no headphones can attenuate speech.

The Aha introduction's unchanged HTML, PNG and PPTX retain the September 17 synthesis. Its two videos add a current local-document investigation of skills, research methods, language and execution boundaries, while reusing existing mechanism evidence and real example captures rather than rerunning experiments. Host document skills, Clawpilot styling, and external media tools also contributed to production, so these are not controlled experiments isolating Aha's effects.

The Greenland example explains high-latitude enlargement with spherical Mercator, using rigid rotation of real generalized boundaries on a sphere rather than two-dimensional scaling. The local fourfold area factor at 60° does not describe all of Greenland. Equal Earth's area preservation does not preserve every shape. See the topic's research report for detailed sources and the limitation that the body of the official statistics was not verified.

The CPython example compares string-object sizes and UTF-8 payloads for the specific CPython 3.11.15 implementation. U+1F600 makes the new result use a four-byte code-point representation; it does not change the original string, and the result does not apply to every emoji or Python implementation. Docker's 100 MB is an assumed payload; no build was executed. The merged view after deletion must be distinguished from immutable layer data, and the same-RUN comparison applies only to newly created temporary files.

Current PPTX records distinguish native structure and PowerPoint export/copy-edit checks from bounded agent visual observations. Localized punctuation wrapping remains recorded. Video checks include complete decoding, exact subtitles, muted playback and sampled encoded frames; **actual listening and continuous human viewing remain unconfirmed**. Human understanding studies, independent human translation review, physical-phone testing and screen-reader acceptance are incomplete.

## License and third-party boundaries

Original repository source is provided under the [MIT license](../LICENSE), subject to the coverage and exclusions in [License scope](../docs/LICENSE-SCOPE.md). This is **not a blanket relicensing of the examples directory**. Upstream files and excerpts, third-party materials, speech-service and recording rights, and font licenses do not become MIT-licensed by inclusion; their own licenses, attribution requirements, and service terms still apply. Receipts, source records, and the ability to view an artifact locally do not themselves grant those third-party rights.

## Local reproduction

Identity checks do not execute author code:

```powershell
npm run build
npm run examples:verify
```

The unified verifier checks all twenty-one artifacts, language-specific paths, scoped research copies, current receipt names and hashes, audio, recording provenance, approved plans, native edits, browser observations and sampled frames. QA is self-contained under each topic's `qa/<format>/`; regression cases reject stale identities and incorrect evidence even after resealing. Reading previews and sampled frames do not establish human acceptance. Auxiliary video labels may require a larger player than 640px; actual listening and human comprehension were not assessed.

After reviewing the four regenerated pages and obtaining local execution approval, save new browser results to a directory that does not yet exist:

```powershell
node .\evals\examples\check-html.mjs --allow-code --output artifacts\examples-browser-new --screenshots
```

For example, rebuild ANC into a new directory rather than overwriting current artifacts or receipts. Before PNG/PPT/video execution, review author source and obtain separate local execution approval:

```powershell
node .\dist\cli\aha.mjs render-html .\examples\anc\projects\html .\artifacts\anc\runs\rebuild-01\outputs\anc.html
node .\dist\cli\aha.mjs render-image .\examples\anc\projects\image .\artifacts\anc\runs\rebuild-01\outputs\anc.png --allow-code
node .\dist\cli\aha.mjs render-pptx .\examples\anc\projects\pptx .\artifacts\anc\runs\rebuild-01\outputs\anc.pptx --allow-code
node .\dist\cli\aha.mjs video-plan-check .\examples\anc\projects\video .\examples\anc\video-plan.json
```

When source, narration, and research bindings are unchanged, video can be rendered again offline using the check's current `planHash` and current `audio/`. Code or text changes require a new plan and corresponding approval; the command-line `--approve` flag is not authorization itself. Online narration requires separate disclosure and approval of the complete narration, provider, voice, rate, and scope of data sent externally.

On Windows, the pinned media environment can live at `%LOCALAPPDATA%\Aha\media-venv`. Install the repository's locked `requirements-media.txt` and point the user-level `AHA_PYTHON` variable at its `Scripts\python.exe`. Reuse an existing environment rather than deleting it when switching worktrees or cleaning production intermediates; only new processes automatically inherit updated user environment variables. Do not commit machine environments.

`examples/.gitattributes` and `evals/examples/.gitattributes` disable automatic line-ending conversion so Windows checkout does not change the exact bytes of research, source, artifacts, or review records.
