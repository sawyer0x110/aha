# Codebase and diff research

Read [the shared workflow](research-workflow.md) first. Authorization to read a repository is not authorization to execute it.

## Establish the actual version

- Fix repository identity, commit, branch when useful, and both diff endpoints. For a dirty workspace distinguish committed, staged, unstaged, and relevant untracked contents; record content hashes and locators for the material actually read.
- Start from the user's question and related entry points, not a whole-repository dump. Prefer available code intelligence, then LSP, then narrow file and text searches. State navigation/tool limitations rather than automatically installing tools.
- Trace definitions, callers, state transitions, data flow, configuration, and invariants. Check failure, retry, cancellation, cleanup, concurrency, and boundary behavior when relevant. Separate independent subquestions; do not require delegation support.
- Cross-check tests, docs, configuration, and relevant history. A comment, test name, or commit message is a lead, not proof of current behavior. Follow assertions and actual code paths.
- Record precise file/line or symbol locators and version/content identity for supporting and opposing evidence. External documentation does not prove a dirty local implementation matches it.

## Claims and observations

Distinguish “source implies,” “test asserts,” “command was run,” and “runtime was observed.” Reading a test does not mean it passed. Source reading cannot establish live latency, production frequency, or environment-specific behavior.

If an authorized experiment is necessary, first review the command and inputs, obtain explicit execution approval, and use an appropriately restricted environment. Record environment, input, exact command, output, and limitations. Do not execute untrusted source repository scripts, hooks, package installs, or binaries merely to improve research confidence. Without adequate permission/isolation, remain read-only and mark the missing observation.

Reverse-check the central path and a plausible counterexample before concluding. Preserve scope gaps and version mismatches; do not merge incompatible observations into one apparently verified mechanism.
