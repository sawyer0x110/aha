# Aha usage and CLI workflow

[English](USAGE.md) | [简体中文](USAGE.zh-CN.md) · [Documentation](README.md) · [Install](INSTALL.md) · [Contributing](../.github/CONTRIBUTING.md)

This guide covers research, source-first authoring, rendering, permissions, and review. Install the complete package using [INSTALL](INSTALL.md) first; installation and actual host acceptance are separate.

Runtime **0.3.3** and research/artifact schemas **1.0.0** are independent version lines. Unsupported protocols or commands fail explicitly; the CLI does not silently convert data or delete user work. Check [Releases](https://github.com/sawyer0x110/aha/releases) for actual publication and available downloads.

## Choose the deliverable, not a template

Use `aha-research` for a report or investigation. Use `aha-explain` for a visual deliverable, including questions requiring research first. Ordinary text Q&A should not become a research archive or media production. Do not assume the host automatically dispatches from one skill to the other.

Research preserves conclusions, evidence, a report, and identity independently of the medium. Each medium has its own authored source and content coverage:

- HTML can be a diagram-led single screen, comparison, interactive exploration, long article, or a mixture, using tables, SVG, Mermaid, and local interactions under the offline contract.
- PNG gets a composition for its intended dimensions, not a screenshot of an entire article.
- PPTX uses native editable objects, with as many pages as the explanation needs.
- Video uses authored HTML/SVG/canvas scenes that change by frame, not a loop of static cards.

Share facts, not a fixed layout. Scaffolds are unfinished starting points. A different topic or structure should not require a topic-specific field in the shared schema.

**Generate only the requested formats.** “Web page / HTML” means HTML, “infographic / poster” means PNG, “presentation / PPT” means native PPTX, and “explainer video” means video. Explicit “web slides” still means HTML. If a visual explanation is requested without a format or decisive context, default to HTML and state that briefly; do not apply this default to text-only or research-only requests. Ask only about ambiguity affecting purpose, cost, or permissions. Multiple formats need an explicit request and separate authoring. The CLI always requires one explicit format; there is no `auto` or `all`. See [format selection](../skills/aha-explain/references/format-selection.md).

Use [visual design](../skills/aha-explain/references/visual-design.md) and the relevant [theme recipe](../skills/aha-explain/references/design-themes.md): editorial research, engineering diagrams, evidence/data, high-contrast mechanisms, presentation narrative, or the Clawpilot baseline. User/project branding takes precedence; Clawpilot is a fallback, not a mandatory aesthetic. These are original design guides, not copied upstream templates or an accepted portfolio.

For HTML, `--cp-*` variables provide runtime chart/control color roles and can be redefined in author CSS. Handle both light/dark selectors and keep body/Mermaid fonts consistent. Authors can set `data-theme="light"` or `"dark"` on `html`. A valid `scoutTheme=light|dark` query parameter takes priority, followed by the author setting, then system preference. No theme-switching UI is automatically added.

Read references at the relevant stage: source route during research, selected medium during authoring, selected theme section during composition, and full QA at acceptance—not every reference at startup.

## Command paths and setup

**Installed users:** resolve the absolute script path from the installed skill, regardless of the current working directory:

```powershell
node "C:\your-project\.agents\skills\aha-research\scripts\aha.mjs" doctor --for research
node "C:\your-project\.agents\skills\aha-explain\scripts\aha.mjs" doctor --for html
```

**Source checkout:** the following workflow examples use `node .\dist\cli\aha.mjs` from the repository root after a source build. Installed users must replace that prefix with `node "<absolute-installed-skill>\scripts\aha.mjs"`. Keep task outputs in your own authorized workspace. The research CLI is available in both skills; use the installation your host actually loaded.

Use Windows-style paths in PowerShell and corresponding forward-slash paths in POSIX shells. Windows has been exercised; macOS/Linux are not verified. These path examples are not a cross-platform support claim.

## 1. Complete the research

```powershell
node .\dist\cli\aha.mjs research-init "How does this codebase handle request failures?" ".\artifacts\topic.draft.json" --kind codebase
```

Initialization creates an incomplete draft; it does **not** research anything. `--kind` accepts `public`, `codebase`, `mixed`, or `provided`, reflecting materials actually used. Follow the research workflow to read sources and author the report, subquestions, claims, evidence, logs, counterevidence, gaps, and honest stopping reason. Research language follows the request independently of artifact defaults. Exact fields are in generated `schemas\research-draft.schema.json` and the [research contract](../skills/shared/references/research-contract.md); do not invent schema fields.

While authoring:

```powershell
node .\dist\cli\aha.mjs research-check ".\artifacts\topic.draft.json" --draft
```

Structurally sound but unfinished work returns `status: "draft-checked"`, `ready: false`, and `pending`, without a snapshot or content hash. Unknown references, duplicate IDs, invalid dates/logs/source metadata, and mismatched hashes still fail. This check does not modify the draft and cannot replace final validation.

The [worked research example](../skills/shared/references/research-example.md) uses explicitly fictional materials and a correction; it is not real research evidence. After actually completing and reviewing the content, run strict checks and seal a new snapshot:

```powershell
node .\dist\cli\aha.mjs research-check ".\artifacts\topic.draft.json"
node .\dist\cli\aha.mjs research-build ".\artifacts\topic.draft.json" ".\artifacts\topic.research"
node .\dist\cli\aha.mjs research-validate ".\artifacts\topic.research"
```

Stop on a failure before running dependent commands. `topic.research` contains `manifest.json`, `research.json`, and `report.md`; the report must match the research report string verbatim. The manifest binds `schemaVersion`, `researchId`, and `contentHash`. Keep the editable draft outside the sealed directory. Never hand-edit a sealed report or hash: revise the draft and build a new directory. Existing artifacts stay bound to the old research identity until deliberately recreated.

No experiment engine, scenarios, slides, or model selection are prerequisites. `research-check` checks structure and references; it does not search, supply evidence, certify actual reading, or award a “facts verified” status. The host agent performs research and semantic review. The CLI does not execute the repository being studied.

## 2. Author a medium-specific project

```powershell
node .\dist\cli\aha.mjs explain-init ".\artifacts\topic.research" html ".\artifacts\topic-html"
```

Choose `html`, `image`, `pptx`, or `video`. Validate the research snapshot's freshness and scope before reuse. In the new project, edit the entry named by `artifact.json`; replace placeholders with actual explanatory content, map covered claim IDs to output locations, and record reasoned omissions. Every claim must be covered or explicitly omitted, not both. Only then set status to `authored` and remove the scaffold marker. Layout changes do not rewrite the bound research.

Initialization writes `artifact.json`, a copied Dossier in `research/`, and `html/index.html` (HTML/image/video) or `pptx/main.mjs`. The artifact schema is `1.0.0`; its `researchHash` binds the independent Dossier. Source identity includes authored files and metadata, excluding `research/`, `dist/`, and `qa/`; research is checked separately. Render receipts bind source, research, and output hashes—not truth or visual quality. New evidence requires a new snapshot and newly initialized project, not replacing the old project's research or editing hashes. See [source-first authoring](../skills/aha-explain/references/artifact-authoring.md).

### Media language defaults

Syntax: `explain-init <research-directory> <html|image|pptx|video> <new-project-directory> [--language en|zh|bilingual]`.

| New project | Without a language option | Explicit choices |
| --- | --- | --- |
| HTML | `bilingual`, initially English, with an English/中文 switch | `en`, `zh`, `bilingual` |
| image / pptx / video | `en`, even for Chinese questions or research | `en`, `zh`; `bilingual` is rejected |

For explicitly requested Chinese output, use `--language zh`; do not infer output preference solely from the question's language. New projects always write `artifact.language`. The schema permits the field to be absent for older single-source projects: absence does not convert them to bilingual, and the effective video voice fallback is English.

Language affects only the artifact. The agent authors translations; the CLI neither translates/changes bound research nor calls an online translation service.

Bilingual HTML must contain exactly two non-nested top-level localization roots, each closed and complete:

```html
<section data-aha-lang="en" lang="en" data-aha-title="English title">
  <!-- Complete authored English content -->
</section>
<section data-aha-lang="zh" lang="zh-CN" data-aha-title="中文标题">
  <!-- 完整编写的中文内容 -->
</section>
```

Titles, prose, diagrams, Mermaid controls/captions, accessibility labels, limitations, and citations must correspond accurately. Preserve evidence, claim IDs, units, negation, and uncertainty. Neutral graphics/assets may be shared; do not leave untranslated reader-facing prose outside the roots. Layout remains freely authored.

The runtime checks both branches and titles are nonempty, injects offline buttons, switches `html lang` and document title, hides the inactive branch and its focus targets using `hidden` plus CSS, and dispatches `aha:languagechange` on `window` with `detail.language` equal to `en` or `zh`. Mermaid labels follow their branch/root. There is no `localStorage`, network, language URL parameter, or inferred/persisted language preference. Theme parameters are independent. Single-language HTML is allowed and needs no bilingual switch. See [language contract](../skills/aha-explain/references/language.md).

The scaffold is still a draft: actually author both languages before acceptance. Schema validity is not translation certification. Switch branches and check keyboard access, Chinese fonts, longer English labels, and fidelity of units, negation, uncertainty, and citations.

### Check and render

```powershell
node .\dist\cli\aha.mjs explain-check ".\artifacts\topic-html"
node .\dist\cli\aha.mjs render-html ".\artifacts\topic-html" ".\artifacts\topic.html"
```

HTML packaging does not execute scripts. It embeds local resources and local Mermaid, with no CDN fallback. The default delivery is a standalone offline file, not a page containing the entire research archive.

Create and author each requested medium separately. The following paths denote **already authored** projects; they are not produced by the preceding HTML initializer:

```powershell
# Review authored code and obtain explicit execution permission first.
# --allow-code is not a sandbox.
node .\dist\cli\aha.mjs browser-check ".\artifacts\topic-html" --allow-code
node .\dist\cli\aha.mjs render-image ".\artifacts\topic-image" ".\artifacts\topic.png" --allow-code
node .\dist\cli\aha.mjs render-pptx ".\artifacts\topic-pptx" ".\artifacts\topic.pptx" --allow-code
```

PNG captures a purpose-built infographic, not an article-length screenshot. The PPTX entry receives a runtime-provided PptxGenJS instance to create native text, shapes, charts, and slides. Successful file creation does not prove native editability and every page's appearance were reviewed in a presentation application.

## 3. Edge TTS and dynamic video

A video project defines `window.ahaVideo.renderFrame({ frame, fps, segmentIndex, segmentFrame, segmentFrames, text })`. The runtime calls it frame by frame using measured audio duration, captures dynamic scenes, and encodes them with FFmpeg. This is not Remotion or a static-card loop. Use deterministic time calculations; tools cannot make arbitrary author scripts deterministic.

```powershell
node .\dist\cli\aha.mjs doctor --for video
node .\dist\cli\aha.mjs prepare-video ".\artifacts\topic-video" ".\artifacts\video-plan.json"
node .\dist\cli\aha.mjs video-plan-check ".\artifacts\topic-video" ".\artifacts\video-plan.json"
```

`prepare-video` creates a plan with `status: "draft"`. Author complete narration in `segments[].text`, per-segment sources, voice, rate, and target duration. Set the plan to `"authored"` only after completion and rerun `video-plan-check`. Show the full plan and current `planHash` to the user. **Only after approval of this exact text and external processing**:

```powershell
node .\dist\cli\aha.mjs synthesize ".\artifacts\topic-video" ".\artifacts\video-plan.json" ".\artifacts\audio-v1" --approve "<approved-planHash>" --allow-network
node .\dist\cli\aha.mjs render-video ".\artifacts\topic-video" ".\artifacts\video-plan.json" ".\artifacts\audio-v1" ".\artifacts\topic.mp4" --approve "<approved-planHash>" --allow-code
```

The render command separately requires reviewed local code-execution permission. Stop if an earlier check or synthesis failed.

New plans choose `en-US-JennyNeural` for `en` or absent artifact language, and `zh-CN-XiaoxiaoNeural` for `zh`. Plans explicitly retain `voice`; existing authored plans are not rewritten. Suggested claims in a draft are not automatically translated narration. Online speech uses exactly `edge-tts==7.2.8`, sending only approved narration and voice parameters. User-supplied per-segment audio uses `import-audio` with the explicit `provided-audio` provider; never label it successful online synthesis. See CLI `help` for arguments.

Translating narration changes the plan hash: recheck and obtain full approval of the current narration, provider, voice, rate, and outbound scope. Burned-in captions and SRT use authored `segments[].text`; they are not automatically translated.

Output is 720p30 H.264/AAC with sentence-level burned-in captions, SRT, and receipts. Timing comes from real audio; exceeding the approved range fails rather than silently stretching speech rate. Source/plan identity mismatches prevent direct reuse. Reapprove a new plan; never edit audio hashes.

For visual-only revisions retaining narration, old audio can be reimported as `provided-audio` into a new audio directory after approving the new plan. This avoids another network synthesis, but is not a fresh Edge synthesis.

Make a short sample before expanding the full film. Encoding success is not listening or visual acceptance. Before online narration, run `doctor --for speech`; it checks local tools only, not service availability or synthesis. Actual online use and complete listening review remain separate acceptance steps.

## Diagnose only the current step

| Command | Optional tools actually probed |
| --- | --- |
| `doctor`, `doctor --for research`, `--for html`, `--for pptx` | None; runtime integrity only. Actual PPTX visual acceptance still needs a presentation application |
| `doctor --for browser`, `--for image` | Installed browser |
| `doctor --for video` | Browser, FFmpeg, ffprobe; not speech dependencies |
| `doctor --for speech` | FFmpeg, ffprobe, Python/Edge TTS; not browser |
| `doctor --media` | All media tools; compatibility diagnostic, not a universal gate |

`--for` and `--media` cannot be combined. Inspect `mediaReadiness`, not just the exit code. Missing tools block only the relevant step: absent Edge TTS must not block HTML packaging. Diagnostics do not install software, transmit content, or grant execution permission.

## Dependencies, permissions, and privacy

| Capability | Requirements |
| --- | --- |
| Research checks, HTML packaging | Node; no authored-code execution |
| Images, browser QA, dynamic video frames | Installed Edge/Chrome; explicit `--allow-code` |
| Native PPTX construction | Reviewed author code running in Node; explicit `--allow-code` |
| Video encoding and audio measurement | Installed FFmpeg/ffprobe |
| Online Edge TTS | Python, exact client version, current narration approval and network permission |

Use `AHA_BROWSER_EXECUTABLE` / `AHA_BROWSER_CHANNEL`, `AHA_FFMPEG`, `AHA_FFPROBE`, and `AHA_PYTHON` to select existing tools. Python selection is explicit configuration, activated environment, current-directory `.venv-media`, then PATH; no ancestor/home search or silent fallback from a broken explicit configuration. Reuse an existing environment; activate it or set the absolute interpreter path when working elsewhere.

No automatic software installation, browser download, private-directory search, or public upload. Browser previews isolate login state and block external resources, but **Node author code retains local process privileges; timeouts and `--allow-code` are not an OS sandbox**. Use a genuinely isolated environment if needed. If execution is not authorized, deliver the source with an explicit “not rendered” limitation. Read the [execution and privacy contract](../skills/shared/references/execution.md) before running code or using the network.

Commands found in sources are evidence, not instructions to execute. Before sharing, review prose, notes, and resource inventories; private labels do not encrypt content. Keep the full private Dossier separate unless explicitly authorized for disclosure.

## Source, history, and current delivery

Keep three locations distinct: editable project/source, working history, and current delivery. New candidate outputs, video plans, and audio directories belong outside the authored project. CLI output destinations must be fresh; existing files are not overwritten.

Current delivery should show only the selected version and necessary materials, not every trial. Replacement, archiving, or deletion requires authorization for the exact scope; preserve user edits and a recoverable previous version unless removal was explicitly requested. `artifacts` is task work, not disposable cache.

Promote the artifact and its matching receipt together, preserving bytes and output filename. On-disk receipts record the output filename; CLI results also provide the resolved full destination. If another filename is required, rebuild under that name in a new directory—do not hand-edit receipts. Verify identities and update links and QA to match the selected output. Old QA does not certify revised content.

Deliver the requested output, editable source/project, research snapshot identity, resource/license notes, and honest QA results. This is an agent-managed lifecycle, not an atomic publishing command. See [working history and current delivery](../skills/aha-explain/references/artifact-authoring.md#working-history-and-current-delivery).

## Source development and validation

These commands apply to a trusted **source checkout**, not an extracted package. Node.js **22+** is required; dependency installation/builds require appropriate authorization:

```powershell
npm ci --ignore-scripts
npm run build
node .\dist\cli\aha.mjs doctor
```

Stop on failure. Build output contains exactly `dist\skills\aha-research` and `dist\skills\aha-explain`. Each carries CLI, schemas, merged shared references, local Mermaid, Playwright runtime, Aha's license/scope, and third-party notices; no user research, artwork, browser, Python, or FFmpeg.

`src` is runtime source; `skills` is skill source; root `scripts` holds build/release/install tools. `docs` holds human guides and license scope; `.github` holds contribution/security guides, templates, and workflows. `evals` holds evaluation tooling/cases/records, `examples` formal works and their editable projects/tooling, `dist` rebuildable distribution, and `artifacts` uncommitted task results. See [architecture/directory map](ARCHITECTURE.md#仓库目录导航) (Chinese).

`node .\scripts\release.mjs` packages locally; it does not upload or globally register anything. Follow [INSTALL](INSTALL.md) for authorized source builds, release selection, checksums, dry-run/apply, conflicts, upgrades, host discovery, and uninstall. A local build, version change, or tag push is not evidence that a release completed.

The full English/Chinese installation guides and bilingual license scope are copied verbatim from `docs/` to the package root under their basenames, alongside root `LICENSE`. CLI and new video receipts derive runtime version from `package.json`; sealed examples and historical receipts are not rewritten.

Source validation commands:

```powershell
npm run typecheck
npm test
npm run test:browser
npm run test:media
```

Unit/distribution/CLI, browser interaction, and media integration checks are separate. Media integration uses local test audio, not real Edge TTS acceptance or human listening. PPTX package inspection does not replace visual review in a presentation application.

`npm run eval:prepare -- <arguments>` prepares evaluation inputs but does not run a model. `npm run examples:verify` checks example identities without executing artwork and does not replace browser/media/human review.

Final quality requires checking important claims against sources, medium-specific coverage, layout and interactions at actual viewing size, and complete video playback. Static skill text checks or a successful exit code cannot establish these results.

The [evaluation protocol](EVALUATION.md) (Chinese) fixes original materials and concrete code fixtures, separates author inputs from scoring answers, and compares candidate/baseline under equal conditions. Content and process evidence are scored separately; rewrite regressions do not prove proactive reasoning or stable skill gains. Real readers should explain unseen cases and justify answers; without human data, keep that outcome unverified. Store evaluation outputs separately from the current `examples` gallery.

## Further reading

- [Product requirements](PRD.md), [architecture](ARCHITECTURE.md), [research protocol](RESEARCH.md), [evaluation protocol](EVALUATION.md): existing advanced human-facing documents, **Chinese**.
- [Examples](../examples/README.md) has an English/Chinese overview. The primary [Aha introduction](../examples/aha-introduction/README.md) has **bilingual HTML**, **Chinese PPTX and PNG**, and the unchanged **English video**. Topic notes are Chinese; each artifact keeps its own language and review limits.
- [Contributing](../.github/CONTRIBUTING.md) / [中文](../.github/CONTRIBUTING.zh-CN.md), [Security](../.github/SECURITY.md) / [中文](../.github/SECURITY.zh-CN.md), [MIT license](../LICENSE), and bilingual [license scope](LICENSE-SCOPE.md).

Historical reports, receipts, and skill references are preserved rather than presented as newly translated or revalidated evidence.
