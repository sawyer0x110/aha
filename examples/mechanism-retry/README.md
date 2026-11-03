# Checkable retry teaching model

[English](README.md) | [简体中文](README.zh-CN.md)

This original **manual teaching model** describes one job with at most two attempts. It is not extracted from the evaluation worker or a real service, and neither trace is an observed execution. It is developer input data, not a rendered gallery artifact or a new required artifact schema.

From a built source checkout:

```powershell
node .\dist\cli\aha.mjs mechanism-check ".\examples\mechanism-retry\model.json" --trace ".\examples\mechanism-retry\trace.json"
node .\dist\cli\aha.mjs mechanism-check ".\examples\mechanism-retry\model.json" --trace ".\examples\mechanism-retry\illegal-trace.json"
```

The first returns exit 0 / `checked`: start → first failure → retry → success reaches `done`. Six states are reachable; `over-budget` is intentionally unreachable. The rule `retry-budget` holds only in the declared graph. `done` and `exhausted` are dead ends by design.

The second returns exit 1 / `violated`: its two accepted steps reach `done`; index 2 tries `start` again, an `ILLEGAL_TRANSITION`. The result retains the accepted prefix and each transition's basis. A prefix can conform without completing a job.

To see a rule counterexample, on a separate copy add a transition from `exhausted` on `retry` to `over-budget`, with a new ID and an explicit deliberately broken teaching basis. The shortest violation then has five steps: start, failure, retry, failure, retry. `tests/mechanisms.test.ts` exercises this mutation, missing-state references, ambiguous outcomes, wrong trace outcomes, cycles, bounds and repeatable A-B-A checks.

The model assumes sequential events and one active attempt. It omits timing, overlap, cleanup, cancellation, backoff and external side effects. Traversal cannot establish exactly-once delivery, liveness or real program correctness; an entirely omitted implementation state cannot be discovered by this checker. Code-derived models and runtime-record declarations require source/run references but are not authenticated.

Results contain the checked model, hashes, states, transitions, bases and counterexamples as data for free prose, diagrams or controls. No visual template, automatic animation or code extraction is included. Rendering authored visual code remains a separate execution approval, and Node is not an OS sandbox. See the [input/result contract](../../skills/aha-explain/references/mechanism-checks.md).
