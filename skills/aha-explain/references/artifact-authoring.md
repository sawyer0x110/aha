# Source-first artifact authoring

An artifact is a medium-specific project bound to a Research Dossier snapshot. Its editable source is the authority; metadata records identity, entry points, coverage, omissions, resources, and review results. It is not a fixed card DSL or a universal scene graph.

Use one explicit format per project; consult [format selection](format-selection.md) only for unresolved routing or multiple outputs. [Language](language.md) owns language selection and localized roots; [execution](execution.md) owns permissions and dependencies; [artifact QA](artifact-qa.md) owns final acceptance. This guide owns source identity, coverage and delivery lifecycle. Load a referenced contract at its decision point rather than copying its full checklist into each medium's plan.

## Initialize, then actually author

```text
node "<absolute installed skill>/scripts/aha.mjs" explain-init <research-directory> <html|image|pptx|video> <new-project-directory> [--language en|zh|bilingual]
node "<absolute installed skill>/scripts/aha.mjs" explain-check <project-directory>
```

Validate the Dossier before reuse and check whether its date, scope, claims, and evidence answer this request. If facts need updating, use [the research contract](research-contract.md) and create a new snapshot before authoring against it.

The initialized scaffold has `status: "draft"` and is intentionally incomplete. Read its generated files and preserve the schema version and research binding. Author the actual topic-specific source and a substantive coverage map before changing `status` to `"authored"`. Merely replacing a title, adding claim IDs, or toggling status is not an explanation. `explain-check` is a structural gate, not semantic or visual approval.

## Implemented project contract

Initialization writes `artifact.json`, a copied Dossier under `research/`, and `html/index.html` (HTML/image/video) or `pptx/main.mjs` (PPTX). There is no required `provenance.json` or shared slide schema. Keep optional content/design plans and resource/license notes as ordinary local source documents; put review notes in `qa/`.

The following `artifact.json` fields are required except `language`, which is optional for legacy compatibility; extra properties are rejected:

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Exactly `"1.0.0"`. |
| `format` | `"html"`, `"image"`, `"pptx"`, or `"video"`. |
| `language` | Optional `"en"`, `"zh"`, or `"bilingual"`; bilingual is HTML-only. New projects always include it. Absence preserves legacy single-source behavior, with effective English voice fallback, not automatic translation or bilingual conversion. |
| `researchHash` | Dossier `manifest.contentHash`, set by initialization; do not fabricate or edit to bypass identity checks. |
| `title`, `status` | Human title and `"draft"` or `"authored"`. |
| `entry` | Project-relative HTML path for visual formats or `.mjs` path for PPTX. |
| `coverage` | Array of `{ id, claimIds }`, with unique stable output-block IDs and nonempty lists of existing research claim IDs. |
| `omissions` | Array of `{ claimId, reason }`, with nonblank reasons for intentionally excluded claims. |
| `width`, `height` | Integer browser viewport/capture dimensions. Width: 320–4096; height: 240–16000 for image, at most 4096 otherwise. Video is exactly 1280 × 720. |

Every research claim must be covered or explicitly omitted. A claim may appear in multiple covered blocks, but cannot also be omitted; duplicate omission records fail. Coverage IDs are author-declared locators, not automatic proof that the source contains a claim.

After replacing the sample with actual work, remove its `AHA_UNAUTHORED_SCAFFOLD` marker and set `status` to `"authored"`. Leaving a marker anywhere in included source files rejects the project. Do not merely remove markers to pretend placeholder content is complete.

Use forward slashes in metadata paths and HTML resource URLs; these are portable paths, not native shell paths. The metadata `entry`, such as `html/index.html`, must be project-relative with no `.` or `..` segments. HTML resource URLs resolve relative to their source file: `../assets/pic.png` is allowed when the normalized target stays inside the project. No escaping the project, URL encoding, symlinks, or hardlinks. Source entries/resources cannot reference reserved `research/`, `dist/`, or `qa/` directories. Keep the copied Dossier intact.

Source identity covers included project files, including `artifact.json`; `research/`, `dist/`, and `qa/` are excluded from this source hash, with research checked by its separate identity. Source budgets are 16 MiB per file and 64 MiB total. Put rendered files and audio/plan outputs outside the project, using the delivery lifecycle below. Render receipts bind source, research, and output hashes, not truth or visual acceptance.

## Content plan

Identify the question the work answers, required claims and mechanisms, concrete examples/data, essential conditions, and intentional omissions with reasons. Match depth to the audience's known background, not a job-title stereotype. Add definitions where needed. Use bounded analogies only when they help; do not substitute them for evidence.

Before layout, use [explanation editing](explanation-writing.md) to review the direct answer and a representative mechanism passage. Preserve the reasoning between claims, not just their coverage IDs. Compress secondary detail rather than leaving disconnected outline fragments; review the complete authored copy again at final QA.

Map stable output blocks, diagram parts, pages, or scenes to existing research claims. Include numerical units and data provenance, preserve uncertainty, and keep reader-facing citations natural. Internal IDs and review notes are not the explanation itself. Coverage and omissions must agree with the source and do not certify the truth of either.

New substantive assertions require research and source review. When the snapshot changes, initialize a new project against it. Port reusable authored source and licensed assets, retaining the new initializer's research binding; do not overwrite its metadata or research directory with the old project's copies. Reconcile coverage and omissions against the new claims. Review the revised source and obtain applicable local execution and changed-narration permissions under [execution](execution.md), including separate external speech-processing consent where needed; previous approval does not automatically cover revised code or narration. Then check, render, and review the revised output. Preserve the previous project and delivery; old receipts and QA do not certify the new version.

A layout-only revision need not reopen approval for unchanged research, but executable changes still require review and any necessary execution consent.

## Design and source

At composition, use [visual design](visual-design.md) for hierarchy, reading path, relationships, typography, and runtime `--cp-*` compatibility. Read only a chosen [theme recipe section](design-themes.md), if useful. User/project branding takes precedence over optional recipes and the Clawpilot fallback. No mandatory cards, teaching tests, simulator, or uniform page count.

Use full HTML/CSS/JS, Mermaid source, SVG, PptxGenJS author modules, or deterministic video scene code as appropriate. Load only [HTML](html.md), [image](image.md), [PPTX](pptx.md), or [video](video.md) guidance for the requested output. Do not force every medium through one HTML screenshot or shared slide representation.

Before executing source, apply [the execution contract](execution.md), including reviewed approval, local resource provenance, escaping, and Node privileges. Loading an authoring guide grants no execution permission.

## Check, revise, preserve

Run `explain-check` after actual authoring, then the medium's render command and [artifact QA](artifact-qa.md). Edit the source when revising; do not leave a one-off patched output that cannot be reproduced.

## Working history and current delivery

Separate three locations, without adding schema fields or a new CLI mode:

- **Editable project:** authoritative source and the bound research copy.
- **Working history:** new render destinations outside the project, with receipts and useful revision/failure notes. Keep these outside a user-facing gallery by default.
- **Current delivery:** only the selected current output, its matching receipt, source/research references, necessary licensed resources and current QA. A gallery is not an archive of every attempt.

Render into a fresh working destination; the CLI still rejects overwrites. Review that candidate before updating a current delivery. For replacement, archiving or deletion, establish the exact files and user-authorized scope first. Preserve user edits and the recoverable previous version unless the user explicitly requested its removal. Never clear a directory or delete user files merely because this guide recommends tidy delivery.

Promote the output and its receipt together, preserving their bytes and original output filename; the on-disk receipt records that filename, while the CLI result also reports the resolved destination. If a different published filename is needed, render a fresh candidate with that name in a new directory rather than editing the receipt. Update gallery links and QA bindings to the selected version, and verify hashes and local links after promotion. Do not hand-edit receipt identities or present stale QA as current. This is an agent-managed workflow, not an atomic publishing feature of the CLI.

Deliver requested output, editable project/source, research snapshot identity, resources/license notes, and candid QA results. Keep the full private Dossier separate from public output unless explicitly authorized. If cleanup was not authorized, leave the history intact and identify the current version clearly rather than silently removing it.
