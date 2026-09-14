# Source-first artifact authoring

An artifact is a medium-specific project bound to a Research Dossier snapshot. Its editable source is the authority; metadata records identity, entry points, coverage, omissions, resources, and review results. It is not a fixed card DSL or a universal scene graph.

Use one explicit format per project; consult [format selection](format-selection.md) only for unresolved routing or multiple outputs. When authoring metadata or bilingual content, load [language](language.md), the authority for defaults, localized roots, and translation behavior. Keep artifact translations separate from the bound Dossier so presentation choices do not change evidence identity.

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

Source identity covers included project files, including `artifact.json`; `research/`, `dist/`, and `qa/` are excluded from this source hash, with research checked by its separate identity. Source budgets are 16 MiB per file and 64 MiB total. Do not put rendered files or audio/plan outputs into the source tree: choose new sibling destinations outside the project. Render receipts bind source, research, and output hashes, not truth or visual acceptance.

## Content plan

Identify the question the work answers, required claims and mechanisms, concrete examples/data, essential conditions, and intentional omissions with reasons. Match depth to the audience's known background, not a job-title stereotype. Add definitions where needed. Use bounded analogies only when they help; do not substitute them for evidence.

Map stable output blocks, diagram parts, pages, or scenes to existing research claims. Include numerical units and data provenance, preserve uncertainty, and keep reader-facing citations natural. Internal IDs and review notes are not the explanation itself. Coverage and omissions must agree with the source and do not certify the truth of either.

New substantive assertions go back through research and source review. A layout-only revision need not reopen approval for unchanged research, but executable changes still require review and any necessary execution consent.

## Design and source

At composition, use [visual design](visual-design.md) for hierarchy, reading path, relationships, typography, and runtime `--cp-*` compatibility. Read only a chosen [theme recipe section](design-themes.md), if useful. User/project branding takes precedence over optional recipes and the Clawpilot fallback. No mandatory cards, teaching tests, simulator, or uniform page count.

Use full HTML/CSS/JS, Mermaid source, SVG, PptxGenJS author modules, or deterministic video scene code as appropriate. Load only [HTML](html.md), [image](image.md), [PPTX](pptx.md), or [video](video.md) guidance for the requested output. Do not force every medium through one HTML screenshot or shared slide representation.

Before executing source, apply [the execution contract](execution.md), including reviewed approval, local resource provenance, escaping, and Node privileges. Loading an authoring guide grants no execution permission.

## Check, revise, preserve

Run `explain-check` after actual authoring. Then use the medium's render command and perform [source-grounded fact checking and actual QA](artifact-qa.md). Record static checks, source support review, runtime observations, and visual/native review separately.

Edit the source when revising; do not leave a one-off patched output that cannot be reproduced. Publish to new destinations and retain the old work. Deliver requested output, editable project/source, research snapshot identity, resources/license notes, and candid QA results. Do not include the full private Dossier in the public output unless explicitly authorized.
