# Advisory copy-check contract

Load when running standalone `explain-lint`, checking exported copy, or interpreting diagnostics. For ordinary authoring, use [explanation editing](explanation-writing.md#use-advisory-copy-checks-not-a-compliance-gate) and the feedback already returned by project/plan checks.

## Choose input and medium

`explain-check` includes `readability` feedback on static HTML/image/video source. `video-plan-check` also checks actual `segments[].text` narration. To check copy before a project is authored, or exported PPTX text without running its author module:

```text
node "<absolute installed skill>/scripts/aha.mjs" explain-lint <source.html>
node "<absolute installed skill>/scripts/aha.mjs" explain-lint <copy.md> --format image
node "<absolute installed skill>/scripts/aha.mjs" explain-lint <visible-slide-copy.txt> --format pptx
node "<absolute installed skill>/scripts/aha.mjs" explain-lint <plan.json>
```

The format defaults to `html`, except `.json` input selects `video` and must satisfy the video-plan contract. Explicit `--format` accepts only html/image/pptx/video. Standalone input is a bounded local UTF-8 `.txt`, `.md`, `.html`/`.htm` file or video-plan `.json` (4 MiB maximum); JavaScript modules and binary media are refused. No network, author execution, rewrite or dependency installation occurs. Run the packaged installed entry, not an assumed working-directory script.

## Interpret feedback

The result is warning-only: `mode: "advisory"`, `blocksChecked`, `warningCount`, and `warnings` containing `rule`, `language`, `location`, `excerpt`, `message`, and `suggestion`. A location identifies a source block by file/line/column where available, or a JSON segment locator; it is not necessarily the exact offending word. At most 200 warnings are returned; `truncated` and the full count disclose omitted records. `status: "not-checked"` with zero extracted blocks means no reviewable copy was found, not that the writing passed. Invalid files/options still fail normally. There is no strict mode or readability-based render rejection.

These are **STE-inspired editorial heuristics, not ASD-STE100 compliance**. No complete approved dictionary, word-sense/part-of-speech validation or full standard rules are implemented. Chinese thresholds and wording hints are Aha heuristics, not requirements of the English standard.

| Medium | Body sentence review threshold (English words / Han characters plus other words) | Sentences per paragraph/block |
| --- | --- | --- |
| HTML | 35 / 60 | 6 |
| Image | 22 / 38 | 3 |
| Native PPTX copy | 24 / 42 | 3 |
| Video narration | 28 / 50 | 4 |

Titles/control/SVG text labels use 12 / 24, or 10 / 20 for image copy. These are review triggers, not layout capacity, accessibility standards or reader-tested limits. Plain copy has no implicit label role; Markdown headings and HTML labels supply it. English/Chinese receive a small set of indirect-wording and possible naming-drift hints; other declared HTML languages receive length hints only. A possible drift such as "log in"/"sign in" requires checking whether both actually name the same action.

## Know extraction limits

Static HTML extraction includes both localized branches and text/alt/accessibility/title labels. It excludes script/style/code/preformatted blocks, Mermaid DSL, templates and quotations; it does not compute CSS visibility, inspect external SVG text or recover dynamically generated labels. Markdown extraction checks prose/headings/lists/tables while excluding frontmatter, fenced/inline code and block quotations; it is not a full Markdown renderer. Export generated interaction text and diagram labels separately when needed. PPTX author modules are explicitly **not checked as prose**: export visible copy to UTF-8 text, separate paragraphs/slides with blank lines, and check reader-facing speaker notes separately. A video plan check does not listen to audio or inspect frames.

Apply the [editorial judgment](explanation-writing.md#use-advisory-copy-checks-not-a-compliance-gate), not a blanket shortening rule. Keep necessary conditions, negation, units, terminology and evidence uncertainty; record justified retained warnings in existing QA notes. Copy diagnostics do not replace actual medium/reader acceptance under [artifact QA](artifact-qa.md).
