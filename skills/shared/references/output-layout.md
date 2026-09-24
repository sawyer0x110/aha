# Task and delivery layout

Read when choosing working paths or preparing a delivery. Use the user's explicit destination and filenames when supplied; otherwise use the conventions below. These are agent-managed directory conventions, not a new CLI command or permission to move existing user files.

## Working task

Choose a descriptive lower-case kebab-case task name. In a source checkout, use `artifacts/<task>/`; elsewhere choose an authorized writable workspace. Keep research, source, attempts and selected delivery separate:

```text
<task>/
  research.draft.json
  research/                   # Sealed manifest.json, research.json, report.md
  projects/<format>/          # artifact.json, research/ and authored entry
  runs/<run-id>/              # A fresh attempt, for example round-01
    outputs/<task>.<ext>
    outputs/<task>.<ext>.receipt.json
    video-plan.json           # Video only
    audio/                    # Video only
    qa/<format>/              # Observations, screenshots, review notes
  delivery/
    delivery-manifest.json
    <task>.<ext>
    <task>.<ext>.receipt.json
    qa/<format>/
```

Create only needed directories and requested media. Research-only work stops with the report and sealed Dossier; it does not need empty media projects. Each format has its own source project. The internal entry remains `html/index.html` for HTML/image/video or `pptx/main.mjs` for PPTX, independently of the published filename. User-directed comparative evaluations may use their evaluator's `iteration/eval/condition` layout instead of ordinary task runs; keep them outside the current delivery.

Render every candidate to a fresh path outside its source project. Put new QA under the run's `qa/<format>/`, not inside source. Legacy project `qa/` remains excluded from source hashing for compatibility; that exclusion is not the recommended storage location. Do not put generated audio, plans or outputs into a source tree. Do not relocate old task histories without permission.

## Selected delivery

Use the same stem across formats: `<task>.html`, `<task>.png`, `<task>.pptx`, `<task>.mp4`. Reserve `index.html` for a gallery/navigation entry. Use `<artifact>.receipt.json` for all new render receipts, including video; video subtitles are `<artifact>.srt`. Keep approved plans, audio manifests, licensed assets and recording provenance when needed for reproduction.

Maintain one `delivery-manifest.json` for the selected delivery, not separate current publication indexes by format or production round. Each artifact entry identifies its topic/task, format, file, source project and research report; records byte count and output/source/research/receipt hashes; and indexes provenance, format properties and current QA. Use `qa.directory`, hash-bound `qa.evidence` references, and explicit limitations. Native edit checks, browser interactions and audio timing need different evidence, not different top-level manifest files. Do not claim a check was performed merely to fill a common field.

When a format has multiple requested language versions, publish `<task>.<language>.<ext>` (for example `aha-introduction.en.mp4` and `aha-introduction.zh.mp4`). Both are current artifacts, not production rounds. Use `projects/<format>/<language>/` and `qa/<format>/<language>/`; video plans live in `video-plans/<language>.json` and recordings in `audio/<language>/`. Keep single-version formats at their unsuffixed paths. A bilingual HTML remains one artifact, not two language versions.

Research belongs to the artifact's actual evidence, not a forced topic-wide revision. Retain `research/` for the common dossier; if a refreshed format uses a different snapshot, place that snapshot alongside it at `research-<format>/` and identify its exact report and hash in each affected entry. A sealed dossier contains exactly its three regular files, so never nest another dossier inside it. Translated variants may share a dossier without rewriting the sealed report. Source projects retain matching research copies. This does not assert that unchanged formats have been researched or rendered again.

For this repository's gallery, the manifest uses `schemaVersion: 2`, `layout: "topic-format-language-v1"` and `requestedOutputs[]`. Each topic is published at `examples/<topic>/`, following these single-version and language-version paths. Entries for language versions include `language`; video variants also identify `videoPlan` and `audioDirectory`. Only `examples/index.html` is the gallery. `evals/examples/` contains reusable checking tools, not publication archives. The gallery verifier checks the exact requested topic/format/language inventory and format-specific evidence; it is not a general CLI validator for arbitrary user task manifests.

For imported speech assembled from multiple approved recordings, provenance binds each current segment's text, WAV hash, frame count and original synthesis plan. Preserve the original provider, voice, rate and approval separately from the current `provided-audio` plan. Intermediate imports are not new synthesis. Original speech plans needed to establish permission and identity are necessary provenance, not superseded reader-facing artifacts.

## Preserve identity during promotion

Promote the selected output, matching receipt and applicable QA together. Prefer rendering with the final stem from the outset. When the user authorizes filename/layout normalization, update receipt location fields and QA references to current relative paths. Keep output/source/research identities, actual observation times, methods and findings truthful; recompute receipt and evidence hashes and every dependent reference after metadata edits. A metadata update is not a new render or fresh visual/human acceptance. Never change identity hashes merely to make a different source or output appear reviewed.

If source or output bytes change, render and review a new candidate. Keep the current delivery self-contained: no previous-path fields, relocation tables, parallel publication indexes or archive-dependent QA. Remove superseded versions, comparison records and failure logs when the user approves cleanup; keep necessary research, licenses, recording provenance and current review limitations. A missing current review stays unperformed, not a rewritten success. Keep private research and machine-specific records out of shared delivery unless their disclosure is authorized.

Cleanup requires explicit scope and approval. `artifacts/` is ignored task work, not disposable cache; do not delete it wholesale or silently erase unsuccessful runs.
