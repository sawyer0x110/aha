# Artifact language

Language is an artifact authoring choice, not a research transformation. Keep the bound Dossier and its original language, evidence, and identity unchanged. The agent authors translations; Aha packages them without online automatic translation.

## Select language explicitly

```text
node "<absolute installed skill>/scripts/aha.mjs" explain-init <research-directory> <html|image|pptx|video> <new-project-directory> [--language en|zh|bilingual]
```

| New artifact | Default | Explicit choices |
| --- | --- | --- |
| HTML | `bilingual`, initially English, with built-in English/中文 buttons | `en`, `zh`, `bilingual` |
| Image, PPTX, video | `en` | `en`, `zh`; `bilingual` is rejected |

A Chinese question or Chinese research does not select Chinese output. Honor an explicit Chinese-output request with `--language zh`; otherwise use the format default. Do not infer a viewer preference. Single-language HTML is supported without the bilingual switch.

Every newly initialized `artifact.json` includes `language`. The field is optional for compatibility: absent legacy metadata retains the old single-source behavior, without requiring bilingual branches or translating content; its effective voice fallback is English. Do not add the field or restructure a legacy source merely to pass validation. The enum is `en`, `zh`, or `bilingual`, with the format restriction above.

## Author bilingual HTML

Provide exactly two nonnested localized `section` roots inside the body, one for each language. Neutral layout wrappers may surround them; diagrams must be children, not replacements for the language roots:

```html
<section data-aha-lang="en" lang="en" data-aha-title="English title">
  <!-- Author the complete English explanation here. -->
</section>
<section data-aha-lang="zh" lang="zh-CN" data-aha-title="中文标题">
  <!-- Author the complete Chinese explanation here. -->
</section>
```

This is the root contract, not finished content. Author nonempty explanations and nonblank localized titles. The generated scaffold remains `draft`; filling metadata or passing structural checks does not certify translation accuracy.

Layouts and styles remain author-controlled. Accurately translate headings, prose, chart and diagram labels, Mermaid controls/captions, accessibility labels, limitations, and reader-facing citations. Preserve evidence, claim IDs, quantities, units, negation, conditions, and uncertainty across branches; citation targets still refer to the same evidence. Use unique DOM IDs and branch-local interaction targets where needed. Neutral diagrams/assets may be shared, but leave no untranslated reader-facing prose outside the localized roots.

The runtime validates the two nonempty branches and their titles, injects offline English/中文 buttons, starts in English, and updates the document's `html lang` and title when switching. It hides the inactive branch and its focus targets using `hidden` plus CSS; author styles must not defeat that hiding. Mermaid runtime labels follow their branch/root language. Do not add a competing translation or language-switching layer.

Optional author interactions can react to `window` events dispatched as `CustomEvent('aha:languagechange', { detail: { language } })`, where `language` is either `'en'` or `'zh'`. Use the active branch for geometry-sensitive interactions and verify diagrams after switching. There is no `localStorage`, network translation, or language URL parameter, and no inferred or persisted language preference.

## Single-language media and narration

Author all reader-facing image/PPTX/video content in the selected language, including chart labels, citations, captions, limitations, and accessibility text where applicable. Do not copy a Chinese research title or claim verbatim into an English artifact as a substitute for authoring.

For new video plans, `prepare-video` chooses `en-US-JennyNeural` for `en` or absent legacy language, and `zh-CN-XiaoxiaoNeural` for `zh`. The plan still stores an explicit `voice`; existing authored plans are not rewritten. Draft claim suggestions are not translated scripts. Author `segments[].text` in the target language and review voice suitability.

Translating narration changes the plan hash and requires validation and fresh approval under [execution](execution.md). Captions and SRT derive from authored segment text; neither is automatically translated. Keep source/audio identity checks intact.

## Write naturally in each language

Work from the same supported meaning, not a sentence-by-sentence English template. Each language may use different sentence order, headings, punctuation and paragraph breaks while preserving the same substantive explanation and conditions. Introduce specialist terms at the reader's level; keep code identifiers intact. A literal translation is not always an intelligible explanation.

Review each branch independently first, without consulting the other: are the referents clear, the phrasing natural, and the transitions understandable? Then compare both against the research for fidelity, especially quantities, negation, conditions and uncertainty. Do not use fluency as permission to add facts or strengthen claims. If the source-language copy is vague, revise both versions rather than polishing only the translation.

For example, in beginner Git prose, "branch tip" can be introduced as "分支的最新提交", not the unexplained literal "尖端". "Expiry matters" needs its consequence explained in either language; "过期很重要" is not a repair. These are examples of contextual choices, not a mandatory glossary. Apply [explanation editing](explanation-writing.md) to headings, labels, dynamic feedback and narration as well as paragraphs.

## Verify both meaning and rendering

At review, load the full language acceptance checklist in [artifact QA](artifact-qa.md). It covers switching both branches, keyboard/focus behavior, fonts/layouts, and semantic fidelity against the same research. Translation review is separate from schema and render success; report unreviewed content honestly.

The approved `browser-check` also visits both language branches for its existing runtime, image, and clipping checks. Its `checkedLanguages` diagnostics report the visited languages, not semantic translation review or complete visual acceptance.
