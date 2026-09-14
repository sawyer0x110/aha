# Research draft and Dossier contract

The research schema is `1.0.0`, independent of the runtime release version (`0.3.0`). Use the initializer; do not invent fields from design sketches or reuse older data as though it were this schema.

```text
node "<absolute installed skill>/scripts/aha.mjs" doctor --for research
node "<absolute installed skill>/scripts/aha.mjs" research-init "<question>" <new-draft.json> --kind public
node "<absolute installed skill>/scripts/aha.mjs" research-check <draft.json> --draft
node "<absolute installed skill>/scripts/aha.mjs" research-check <draft.json>
node "<absolute installed skill>/scripts/aha.mjs" research-build <draft.json> <new-research-directory>
node "<absolute installed skill>/scripts/aha.mjs" research-validate <research-directory>
```

`--kind` accepts `public`, `codebase`, `mixed`, or `provided`; choose the material actually used. Initialization creates an incomplete draft, not research. Author it through [the workflow](research-workflow.md). On first authoring or troubleshooting, use [the synthetic provided-material example](research-example.md).

`research-check <draft.json> --draft` is an intermediate authoring check. Structurally sound unfinished work returns exit 0 with `status: "draft-checked"`, `ready: false`, and `pending: [{ code, message, location? }]`; it emits no manifest or content hash. Incomplete report, coverage, evidence, gaps, and missing required reads are pending work, not evidence of completion. Unknown references, duplicate IDs, malformed dates/logs/source metadata, and invalid or mismatched hashes still fail. Fix these errors before relying on the pending list.

Normal `research-check` and `research-build` remain strict: they require completed content and consistent references, not just parseable JSON. A draft check cannot authorize delivery or bypass strict validation.

## Editable draft

Objects reject extra properties. Required top-level fields:

| Field | Contract |
| --- | --- |
| `schemaVersion` | Exactly `"1.0.0"`. |
| `id`, `title`, `question`, `kind`, `language` | Stable research identity, human title, central question, material kind, and research report language following the user's request, independent of artifact defaults. |
| `status` | `"draft"` while working; `"complete"` only after writing and reviewing the report and ledger. Complete does not mean every question was resolved. |
| `report` | Markdown string. Include direct answer, explicit scope/inclusions/exclusions, purpose/audience, time horizon and budget, question-tree rationale, argument, sources, counterevidence, limitations, and semantic review notes as appropriate. There is no separate `scope` or `brief` field. |
| `claims`, `evidence`, `subquestions`, `researchLog`, `gaps` | Arrays described below; at least one subquestion. Completed research needs claims, a nonempty report, and an honest stop reason. |
| `stopReason` | Actual coverage, access, tool, or budget reason for stopping; not a fabricated success statement. |

IDs start with an alphanumeric character and use only alphanumerics, `_`, and `-` (maximum 128 characters). Research, claim, evidence, question, log, and gap IDs must be globally unique within the draft.

### Ledger objects

- **Claim:** required `id`, `text`, `evidenceIds`, `limitations`; optional `kind` (`"fact"`, `"inference"`, `"unresolved"`) and `subquestionIds`. Ordinary claims need evidence. An unresolved claim needs explicit limitations and linked gaps, and cannot answer a subquestion. Every claim must be linked from a subquestion; optional reverse links must agree.
- **Evidence:** required `id`, `kind` (`"web"`, `"code"`, `"provided"`), `title`, `locator`, `summary`, `sourceVersion`; optional `url`, `retrievedAt`, `contentHash`, `content`. Describe support versus contradiction and actual read context in `summary` and the report; there is no invented polarity field.
- **Subquestion:** `id`, `question`, `status` (`"answered"`, `"partial"`, `"unresolved"`, `"out-of-scope"`), `claimIds`, `gapIds`. Answered/partial questions require non-unresolved claims. Every non-answered question needs a gap. Encode the tree/dependencies in report prose and stable question references; no unsupported `parentId` field.
- **Gap:** `id`, `description`, `subquestionIds`. State what remains unknown, why it matters, and a next step. Gap/question links must agree in both directions.
- **Research log:** required `id`, `action` (`"search"`, `"read"`, `"failure"`), `outcome` (`"success"`, `"failure"`), `occurredAt`, `summary`, `evidenceIds`, `subquestionIds`; optional `query`, `locator`, `readRange`. Search needs its actual query; read needs locator and actual read range. Successful reads cite evidence. Failures cite no established evidence, have failure outcome, and identify a query or locator. Every entry relates to a subquestion. Keep planned actions in the report, not fake executed logs.

Timestamps use a real RFC 3339 date/time with timezone. Web evidence needs an absolute HTTP(S) URL without credentials and actual `retrievedAt`. Web/code evidence each needs a successful read log; discovery snippets alone do not satisfy reading.

Provided-material research may legitimately have no web/search logs. Describe the supplied material and actual read scope without fabricating tool operations to fill a ledger. The schema stores a flat subquestion list; any conceptual question tree belongs in report prose, not nested JSON objects.

Code evidence includes inert UTF-8 `content` and its actual SHA-256 `contentHash`. Its `sourceVersion` is a full commit hash (optionally `commit:` prefixed), `dirty:<sha256>`, or `diff:<40-character-base>..<40-character-head>`. Identify actual files/ranges in `locator` and preserve the relevant snapshot; never fabricate hashes. A content hash must match stored text, including whitespace.

## Immutable delivery snapshot

The built directory contains `manifest.json`, `research.json`, and `report.md`; `report.md` must equal the `report` string in `research.json` verbatim. The in-memory Dossier is:

```text
{
  manifest: { schemaVersion: "1.0.0", researchId, contentHash },
  research: <the complete research draft>
}
```

The builder derives content identity. Do not hand-edit manifest hashes or the sealed report to evade validation. Keep the editable draft outside the built snapshot; revise that draft and build into a new directory. Existing artifacts remain bound to the old research identity until deliberately recreated against a new snapshot.

The implementation limits each document to 4 MiB and the total Dossier to 10 MiB. It rejects overwrites and linked paths, including linked ancestors. Preserve only the necessary authorized excerpts/snapshots; do not silently truncate evidence or bypass the limits.

Validation checks structure, references, declared coverage, source metadata, and content identity. It does not prove actual reading occurred, that evidence supports wording, or that a human accepted the research. Perform and report semantic source review separately.
