# Worked provided-material research example

Consult this only on first draft authoring or when troubleshooting the [research contract](research-contract.md). This is an explicitly synthetic example, not actual research or an account of tool operations.

## Supplied material and an evolving question

Imagine the user supplies two fictional notes and asks, in English, “When is the pilot review, and is the pilot approved?”

- **Scheduling note, revision 1, entire text:** “The pilot review is Monday. Approval is still pending.”
- **Correction, revision 2, entire text:** “Correction: the pilot review is Tuesday, not Monday. This corrects the review day only.”

Start with two questions: the current review day and whether approval is established. Before the correction, Monday is a provisional answer, not a fact to protect. Reading the correction changes the first answer to Tuesday. Preserve revision 1 as counterevidence and explain why revision 2 supersedes only its day; the correction does not establish approval. Leave approval unresolved with an explicit gap and next step instead of inferring that a scheduled review means approval.

No external search or repository execution belongs in this provided-only example. `researchLog` is empty because there are no real tool operations to record. Source versions identify the supplied notes; timestamps and hashes are unnecessary for these provided texts.

## Initialize and check unfinished work

Use a new draft path:

```text
node "<absolute installed skill>/scripts/aha.mjs" research-init "When is the pilot review, and is the pilot approved?" pilot-draft.json --kind provided
node "<absolute installed skill>/scripts/aha.mjs" research-check pilot-draft.json --draft
```

The initializer is unfinished: inspect `pending` and author the report and ledger. A successful draft check returns `status: "draft-checked"` and `ready: false`, not a sealed Dossier. Retain `status: "draft"` while researching; do not fill gaps with guessed evidence to clear pending items.

## One complete authored draft

For this fictional demonstration only, replace the initialized draft with the JSON below. For real work, author the user's actual materials and findings instead.

```json
{
  "schemaVersion": "1.0.0",
  "id": "pilot-review",
  "title": "Pilot review: corrected day and unresolved approval",
  "question": "When is the pilot review, and is the pilot approved?",
  "kind": "provided",
  "language": "en",
  "status": "complete",
  "report": "# Pilot review\n\nThis is a synthetic example using fictional supplied notes, not actual research.\n\n## Answer\nThe supplied correction changes the review day from Monday to Tuesday. Pilot approval is not established by these materials.\n\n## Scope and method\nPurpose: answer the requester's scheduling and approval questions. Audience: the requester, with no additional assumed background. Scope and time horizon: the current state described by two supplied revisions; no calendar date, timezone, or later status is supplied. Budget: read both short notes only; no external search or execution. The question tree separates scheduling (q-day) from approval (q-approval), because scheduling a review does not establish its outcome.\n\n## Evidence and revision\nThe entire scheduling note (e-original, revision 1) says Monday and that approval is pending. The entire correction (e-correction, revision 2) explicitly says Tuesday, not Monday, and limits the change to the review day. The initial Monday assumption is therefore revised, not repeated as independent support. Revision 1 remains visible counterevidence resolved by the narrower, later supplied correction.\n\n## Limits and semantic review\nReverse-check: c-day follows the correction's exact scope, without adding a date or approval outcome. Neither note establishes approval. q-approval remains unresolved; obtain an authorized approval decision to close g-approval. Structural validity is separate from this source-support review. No execution, external verification, or human acceptance is claimed.\n\n## Stopping reason\nThe supplied-material budget is exhausted: the review day is answered, but approval needs material not supplied.",
  "claims": [
    {
      "id": "c-day",
      "text": "The supplied correction sets the pilot review day to Tuesday rather than Monday.",
      "kind": "fact",
      "evidenceIds": ["e-original", "e-correction"],
      "limitations": ["This establishes a corrected weekday only, not a calendar date, timezone, or approval outcome."],
      "subquestionIds": ["q-day"]
    }
  ],
  "evidence": [
    {
      "id": "e-original",
      "kind": "provided",
      "title": "Fictional scheduling note",
      "locator": "Supplied scheduling note, revision 1, entire text",
      "summary": "The entire supplied note says Monday and approval pending. Its weekday is contradicted and superseded by the correction.",
      "sourceVersion": "Supplied revision 1",
      "content": "The pilot review is Monday. Approval is still pending."
    },
    {
      "id": "e-correction",
      "kind": "provided",
      "title": "Fictional scheduling correction",
      "locator": "Supplied correction, revision 2, entire text",
      "summary": "The entire correction explicitly replaces Monday with Tuesday and changes only the review day; it supplies no approval decision.",
      "sourceVersion": "Supplied revision 2",
      "content": "Correction: the pilot review is Tuesday, not Monday. This corrects the review day only."
    }
  ],
  "subquestions": [
    {
      "id": "q-day",
      "question": "What review day do the current supplied notes establish?",
      "status": "answered",
      "claimIds": ["c-day"],
      "gapIds": []
    },
    {
      "id": "q-approval",
      "question": "Do the supplied notes establish pilot approval?",
      "status": "unresolved",
      "claimIds": [],
      "gapIds": ["g-approval"]
    }
  ],
  "researchLog": [],
  "gaps": [
    {
      "id": "g-approval",
      "description": "No approval decision was supplied. A scheduled review does not establish approval; obtain the authorized decision before relying on approval status.",
      "subquestionIds": ["q-approval"]
    }
  ],
  "stopReason": "Both supplied notes have been considered; the review day is answered, while approval remains a documented material-access gap."
}
```

## Strict check and new snapshot

After authoring and semantic review, run the normal check and build; these do not accept unfinished drafts:

```text
node "<absolute installed skill>/scripts/aha.mjs" research-check pilot-draft.json
node "<absolute installed skill>/scripts/aha.mjs" research-build pilot-draft.json pilot-research-v1
node "<absolute installed skill>/scripts/aha.mjs" research-validate pilot-research-v1
```

The builder creates the manifest/hash and preserves the report verbatim. An unresolved question can remain in complete research when honestly represented by a gap and stopping reason. A later approval decision belongs in a revised editable draft and a new snapshot, not a hand-edited sealed report.
