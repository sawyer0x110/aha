# Optional finite-state mechanism checks

Use only when an explicit finite model helps explain the mechanism. This is an optional authoring aid, not a required artifact schema, page DSL, source-code extractor, general model checker or animation engine. Research, free HTML, Mermaid, native PPTX and the existing video callback remain independent.

## Establish the basis before walking states

Distinguish **manual teaching model**, **code-derived model**, and **runtime record** visibly. The tool preserves the author's `provenance` declaration; it does not verify that declaration, read references, import source repositories or execute source material. For code-derived work, inspect actual source and bind references to file/range plus commit or content hash, preferably the Dossier's code evidence. For runtime records, retain a reviewed run ID/log location and conditions. A conforming authored trace is not an observed execution.

Each transition must explain its `basis`. Keep state and event names stable across source, prose, diagrams and controls. Express guards by splitting states/events with explicit conditions; two outcomes for the same state/event pair are rejected, not silently chosen. Missing edges mean **not allowed by this model**, not impossible in the actual program. Enumerate assumptions and omissions before interpreting a rule.

## Inert JSON interface

```text
node "<absolute installed skill>/scripts/aha.mjs" mechanism-check <model.json>
node "<absolute installed skill>/scripts/aha.mjs" mechanism-check <model.json> --trace <trace.json>
```

Both inputs are inert UTF-8 JSON, at most 4 MiB each, read through the existing regular-file/no-link checks. No `--allow-code`, imports, subprocess author code, browser, network or installation is involved. Rendering or executing authored visual code remains a separate reviewed `--allow-code` permission boundary; ordinary Node subprocesses are not OS sandboxes.

Both schemas use `schemaVersion: "1.0.0"` and reject extra fields. Installed schemas are `schemas/mechanism-model.schema.json` and `schemas/mechanism-trace.schema.json`.

| Model field | Meaning |
| --- | --- |
| `title`, `provenance` | Human title and `{ kind, description, references }`. Kind is `manual-teaching-model`, `code-derived`, or `runtime-record`; the latter two require at least one reference, without certifying it. |
| `assumptions`, `omissions` | Nonempty arrays declaring the abstraction boundary. |
| `states`, `events` | Arrays of unique `{ id, description }` objects; 1–256 states and 0–256 events. |
| `initial` | One declared state. |
| `transitions` | 0–4096 `{ id, from, event, to, basis }` objects, unique IDs and one outcome per state/event pair. All references must exist. |
| `rules` | 0–64 `{ id, description, forbiddenStates }` objects. These check only reachability of forbidden states, not arbitrary predicates, eventual completion or fairness. |

A trace has `schemaVersion`, its own `provenance`, `initial`, and 0–4096 ordered `steps: [{ event, to }]`. It must start at the model's initial state. Empty traces and unfinished prefixes can conform; conformance does not mean completion.

The CLI emits one JSON result to stdout. Exit 0 / `status: "checked"` means the graph was explored and no supplied rule/trace failed. Exit 1 / `status: "violated"` retains the result and diagnostic; malformed or over-limit input instead returns the existing `status: "failed"` error form. `sourceCodeExecuted: false` is explicit; model and trace `provenanceVerified: false` distinguish author declarations from independent authentication.

The result includes the checked `model`, `modelHash`, reachable/unreachable states, reachable `deadEnds` (no outgoing edges, not necessarily bugs), and examined transition count. Every rule returns `holds-in-model` or a shortest counterexample from the initial state, including transition IDs and bases. Breadth-first traversal counts transitions, not elapsed time; ties follow declaration order. A forbidden initial state has a zero-step counterexample. No rules means no safety property was checked.

Optional `trace` includes `traceHash`, its declared provenance, accepted transitions, final accepted state, and the first failure with a zero-based step `index`. Failure codes distinguish initial mismatch, unknown event/state, illegal edge, and wrong outcome. After failure, later steps are not checked. Loops terminate during graph exploration because each explicit state is visited once.

`exploration.complete` means only that the entire reachable supplied graph was visited. Unreachable declarations can expose a missing edge or an intentionally forbidden state; they are not automatically errors. This cannot detect a state omitted entirely from both the model and its references, certify source fidelity, prove a real program correct, or establish liveness, timing, concurrency or exactly-once effects.

## Minimal original teaching model

Save as `model.json`; this is not evidence about a real service:

```json
{
  "schemaVersion": "1.0.0",
  "title": "One completion",
  "provenance": { "kind": "manual-teaching-model", "description": "Authored illustration, not observed execution.", "references": [] },
  "assumptions": ["One job; events are sequential."],
  "omissions": ["No transport, timing or external side effects."],
  "states": [
    { "id": "waiting", "description": "Job is pending." },
    { "id": "done", "description": "Job completed." }
  ],
  "events": [{ "id": "complete", "description": "Complete the pending job." }],
  "initial": "waiting",
  "transitions": [
    { "id": "finish", "from": "waiting", "event": "complete", "to": "done", "basis": "Teaching rule: only a pending job can complete." }
  ],
  "rules": []
}
```

A trace with `initial: "waiting"` and two `complete → done` steps fails at index 1: the second completion is not a declared edge. The first step remains in `acceptedSteps`. It does not show that a real implementation prevents duplicate effects.

The source repository's `examples/mechanism-retry` contains a larger runnable two-attempt retry model, conforming trace and deliberately illegal restart; these developer examples are not bundled in the portable skill ZIP. Tests also introduce a third-attempt edge and check the shortest rule counterexample.

## Use results in free authoring

Use the returned transition sequence as data for a prose table, Mermaid labels, SVG or freely authored controls; do not inject JSON strings as raw executable HTML/JS. Keep model/trace hashes, declaration type, source references and omissions near the explanation. If incorporated into research, preserve the actual result and its inputs as reviewed provided/code evidence under the existing research contract; the command does not create, seal or automatically approve a Dossier.

For HTML, inspect each state/event/result with keyboard and both authored languages; Mermaid is still a static relationship diagram, not a simulator. For video, map a selected checked path to the existing `renderFrame` inputs and reconstruct the whole scene from frame/segment time. Repeated A-B-A frame rendering must be checked separately: a deterministic graph walk does not establish deterministic visual rendering. Do not claim that graph traversal animates Mermaid or proves a full program.
