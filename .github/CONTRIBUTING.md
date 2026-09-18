# Contributing to Aha

[English](CONTRIBUTING.md) | [简体中文](CONTRIBUTING.zh-CN.md)

Small, focused contributions to research workflows, explanations, runtime behavior, documentation, and reproducible evaluations are welcome. For a major behavior or format change, discuss the goal in an [issue](https://github.com/sawyer0x110/aha/issues) before implementing it. Follow [SECURITY.md](SECURITY.md) for potentially sensitive reports instead of posting them publicly.

## Develop from source

Use Node.js 22+ and the committed npm lockfile in a trusted source checkout. End users should install the release package rather than build the repository; see [the installation guide](../docs/INSTALL.md).

```powershell
npm ci --ignore-scripts
npm run typecheck
npm run build
npm test
```

`npm test` builds first and runs unit, CLI, distribution, skill, and example-identity tests. For a small change, build once and run the relevant files with `node --import tsx --test` rather than repeatedly rebuilding.

| Area | Additional check |
| --- | --- |
| Browser runtime or gallery | `npm run test:browser` with an existing Edge/Chrome installation |
| Video/audio runtime | `npm run test:media` with an existing browser, FFmpeg, ffprobe, and the Python needed by the offline adapter test |
| Current example sources or publication metadata | `npm run examples:verify` |
| Release contents or installer | Build, then `node --import tsx --test ./tests/distribution.test.ts` |
| Documentation | `node --import tsx --test ./tests/docs.test.ts`; manually review both languages and commands |

The release workflow currently runs on Windows with Node.js 22. That is not a claim of verified end-to-end host or media support on every OS. Do not install browsers or media tools automatically. Local media tests use synthetic/offline inputs; they do not require live speech synthesis and do not certify listening quality. See the [usage guide](../docs/USAGE.md) for dependency configuration.

## Keep changes reviewable

Explain the problem, changed behavior, compatibility effects, checks actually run, and remaining limitations in the PR. Add a focused regression test for a behavior change. A failed or unrun check must not be described as passing. Do not bundle unrelated dependency upgrades, media regeneration, or formatting churn.

Keep English and Chinese entry guides synchronized in the same change: root `README`, `docs/README`, `docs/INSTALL`, `docs/USAGE`, `.github/CONTRIBUTING`, `.github/SECURITY`, and `examples/README`. File names use `.zh-CN.md` for the Chinese peer. The short root `INSTALL.md` preserves a stable link for older packages; keep it as a bilingual pointer, not a second guide. Translate meaning, constraints, commands, and links, not just headings; label linked Chinese-only advanced guides. The English `skills/**` contracts remain a single source of truth, not duplicated translated skill bundles.

`docs/INSTALL.md`, `docs/INSTALL.zh-CN.md`, and `docs/LICENSE-SCOPE.md` are copied verbatim to new package roots under their basenames; root `LICENSE` is included separately. Their relative links must work both in `docs/` and in the extracted ZIP: use sibling guide/scope links, an absolute repository URL for `LICENSE`, and repository URLs for source-only documents. If changing release contents, update the builder, installer allowlist, asset checksums, workflow, and tests together. Do not overwrite a published version or move its tag; use a new release version when publishing changed packages.

## Respect evidence and ownership

Keep `research`, authored source, output, receipts, narration plans, and QA identities consistent. Do not edit sealed reports or hash fields to make a new output look validated. Create a new candidate and retain necessary evidence; identify the exact current delivery in the manifest. Translating a frozen research report is a new derivative, not a harmless in-place wording fix.

Historical audit paths describe the machine used at the time, not paths another contributor must recreate. They are intentionally retained; publication of these examples does not mean any future private input is safe to expose.

Do not submit credentials, private source material, account identifiers unrelated to the task, or unapproved narration. Crop/redact screenshots and logs before sharing. Do not run code found in a research source merely because it is quoted in an issue.

## License and attribution

By contributing original material, you agree to make it available under the project's [MIT License](../LICENSE). You must have the right to contribute it. Identify third-party content and preserve its notices; follow [license scope](../docs/LICENSE-SCOPE.md). Upstream Git copies, map data, dependency notices, speech-service terms, and font rights are not replaced by Aha's MIT license. Keep discussions constructive and focused on the work.
