# Explain relationships, not just conclusions

Read before styling and during copy revisions. Apply these editorial questions to prose, headings, diagram labels, slide text and narration, not only articles. They are not a required paragraph template, length limit or schema.

## Build the missing bridge

Start with the reader's question and a direct answer. For each necessary step, identify the objects, the action or comparison, the relevant condition, and the consequence. Ask what the reader would have to know to get from one sentence to the next. Supply the missing relationship or definition where it is needed; do not replace it with a list of related facts.

Words such as "match", "coordinate", "component", "effective" and "important" can hide the explanation. Specify what matches what, along which property; what is being coordinated; or how a condition changes the result. Prefer a concrete verb over a vague claim of importance. Preserve differences such as position versus timing, pressure versus perceived loudness, and textual compatibility versus program behavior.

Use contrasts, examples or bounded analogies to resolve misunderstandings. Do not invent mechanisms for fluency: if the bound research does not support the bridge, narrow the statement or return to research for a new snapshot.

For example, given evidence that a cache serves a stored response until expiry and may not observe an origin update:

| Outline-like copy | More explanatory copy |
| --- | --- |
| "Freshness is a timing problem. Expiry matters." | "After the source changes, the cache may still return its stored response until that entry expires. A request during that interval can therefore receive the older value." |
| "The right value, in the right place." | Name the stored response, the source value and the condition under which they differ; do not make the reader guess what "right" means. |

This illustrates editing, not evidence about every cache.

## Keep one name for one concept

Choose a canonical name for each recurring object, action or specialist concept, following established project/source terminology. Introduce it with a plain-language definition and any needed abbreviation; then reuse that name or introduced abbreviation. Do not rotate synonyms merely to avoid repetition. Vary sentence structure, not concept names, across prose, headings, diagram labels, controls, captions, slides and narration.

Keep distinct concepts distinct. Preserve quoted source/UI wording and code identifiers; explain their correspondence to the chosen name rather than silently renaming them. For example, a cache entry is not interchangeable with its stored response. Track ambiguous aliases in existing authoring/QA notes, not a mandatory reader-facing glossary. Apply [bilingual term mapping](language.md#write-naturally-in-each-language) when translating.

## Make the entry point self-contained

Read the title alone, without the prompt, notes, subtitle or diagram. Can the intended reader identify the subject and question? Create curiosity about the explanation, not an unexplained number, acronym or pronoun. Withhold the answer, not the subject.

Introduce values after naming the entity or configuration field, then describe its initial state, change and consequence. State supported units; do not invent them. Revert a change, not a number. For example, replace "Why did 42 return?" with "Why can a cache keep serving an old response?"

Check entry points separately in each language, including browser titles, gallery labels and covers. Synchronize them after headline revisions. Inspect wrapping at intended size without deleting necessary context.

## Compress detail, not reasoning

Nearby text should resolve the title's question. Read titles and emphasized phrases alone: do they imply a guarantee, equal split, exclusive cause or universal rule that the body later retracts? Revise the headline rather than relying on a distant caveat to undo it.

Remove author-outline fragments and process commentary from reader copy. Keep natural sources and material limitations close to the relevant claim; move audit details to QA notes. A useful caveat says what cannot be concluded and why, rather than repeatedly declaring that no promises are made.

When space is tight, remove a secondary branch or move detail into an appendix or disclosure. Keep the objects, causal or logical bridge, and material condition for the claims that remain. The same research can support an exploratory HTML, a recap image, sequential slides and a short mechanism video without identical wording, screenshots or equal coverage.

## Use advisory copy checks, not a compliance gate

Review `readability` from `explain-check` and `video-plan-check`. These are **STE-inspired editorial heuristics, not ASD-STE100 compliance**. They neither rewrite text nor block rendering; zero warnings do not establish clarity.

Edit only when a warning improves the explanation. Preserve objects, causal links, conditions, negation, units and uncertainty. Record justified long sentences or distinct terms in existing QA notes. Do not ban passive voice, blindly replace technical vocabulary or turn "may", a supported range or an unknown count into invented precision. Hints cannot reliably identify missing reasoning; editorial review remains required.

Review diagram labels and generated interaction text manually when extraction misses them. Load [the copy-check contract](readability-checks.md) only at that step when using standalone `explain-lint`, exported copy or diagnostics, not before ordinary writing.

## Read without decoration, then with the visual

Read representative copy without decoration. Can the intended reader follow its claims and transitions? Review labels with their caption or introductory sentence, not as standalone essays.

Then inspect the actual visual with the text. Point to the objects named in the explanation and follow each claimed relationship. Check whether arrows, state changes and labels demonstrate the explanation rather than merely decorate it. Explicitly pictorial instructions such as "compare the highlighted rows" belong in this second pass.

At final review, cover the full reader-facing copy, including interactive states and summaries; a pilot does not cover later text. Log confusing passages and corrections in existing QA notes with section, slide or time locators. Separate clarity, factual support and visual polish; silent editorial review is not audio listening or learner testing.

For bilingual work, use [language](language.md): natural independent expression first, cross-language fidelity second. A faithful translation of an unclear source can leave both languages unclear. Use [artifact QA](artifact-qa.md) for delivery acceptance and report exactly which review remains unperformed.
