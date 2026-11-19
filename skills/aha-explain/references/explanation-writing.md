# Explain relationships, not just conclusions

Read before styling and during copy revisions. Apply these editorial questions to prose, headings, diagram labels, slide text and narration, not only articles. They are not a required paragraph template, length limit or schema.

## Sound like someone explaining this

Match the reader's knowledge and purpose, not a generic friendly persona. Begin with the situation or question they recognize, then explain what happens and why. Name an unfamiliar concept after making it graspable; expert readers may need the established term immediately.

Let each paragraph answer something the previous one leaves open. Remove sentences that only announce the itinerary, praise the topic or restate the conclusion. Vary sentence length around the reasoning, not a quota. Plain language is not baby talk: forced jokes, suspense, rhetorical questions and "let's dive in" can sound as templated as a textbook.

After drafting, ask what each sentence adds: a cause, distinction, consequence or necessary limit. If removing it loses none, cut it. Work definitions into that reasoning rather than inserting glossary entries. Do not repeat the opening answer or scope at the end unless it resolves a remaining misunderstanding or changes what the reader should do.

These are illustrative rewrites, not new evidence or prescribed openings:

| Stiff copy | Reader-facing copy |
| --- | --- |
| "缓存新鲜度受过期策略影响。" | "源数据改了，缓存里却可能还是旧值。条目没过期时，请求仍可能拿到这个旧值。" |
| "本轮未执行性能实验。" | In QA notes, keep the production status. Beside an illustrative result, say "这里的数字用来演示过程，不是实测提速。" |

Use the second rewrite only when those numbers really are illustrative. Keep material uncertainty and scope with the claim; do not make fluency sound like stronger evidence.

## Build the missing bridge

Answer the reader's question directly. Identify the objects, action or comparison, condition and consequence. Supply the missing relationship or definition needed between sentences, not a list of related facts.

Specify what "matches" what, along which property, or how a condition changes the result. Preserve differences such as position versus timing, pressure versus perceived loudness, and textual compatibility versus program behavior.

Use examples, contrasts or bounded analogies when they explain something; none is compulsory. If the bound research does not support the bridge, narrow the statement or return to research.

For the cache example above, "expiry matters" is not enough: connect the source update, stored response and interval in which the older value can still be returned. This is not a claim about every cache.

## Keep one name for one concept

Choose a canonical name using established project/source terminology. Give a plain-language definition and any needed abbreviation; reuse that name or introduced abbreviation. Do not rotate synonyms for variety. Vary sentence structure, not concept names, across prose, headings, diagram labels, controls, captions, slides and narration.

Keep distinct concepts distinct. Preserve quoted source/UI wording and code identifiers; explain their correspondence to the chosen name rather than silently renaming them. For example, a cache entry is not interchangeable with its stored response. Track ambiguous aliases in existing authoring/QA notes, not a mandatory reader-facing glossary. Apply [bilingual term mapping](language.md#write-naturally-in-each-language) when translating.

## Make the entry point self-contained

Read the title alone, without the prompt, subtitle or diagram. Can the reader identify the subject and question, not just an unexplained number, acronym or pronoun? Withhold the answer, not the subject.

Introduce values after naming the entity or configuration field; explain its initial state, change and consequence. State supported units; do not invent them. Revert a change, not a number.

Check browser titles, gallery labels and covers separately in each language. Synchronize headline revisions and inspect wrapping without deleting context.

## Compress detail, not reasoning

Resolve the title's question nearby. Check whether titles or emphasized phrases imply guarantees or universal rules the body retracts; fix the headline, not a distant disclaimer.

Remove author-outline fragments and process commentary. Keep sources and material limitations near the relevant claim; move audit details to QA notes. Say what cannot be concluded and why, not repeatedly that no promises are made.

When space is tight, remove a secondary branch or move detail into a disclosure. Retain the objects, reasoning and material conditions. Different media need not share wording or equal coverage.

## Use advisory copy checks, not a compliance gate

Review `readability` from `explain-check` and `video-plan-check`. These are **STE-inspired editorial heuristics, not ASD-STE100 compliance**. They neither rewrite text nor block rendering; zero warnings do not establish clarity.

Edit when it improves the explanation, preserving causal links, conditions, negation, units and uncertainty. Record justified warnings in existing QA notes. Do not ban passive voice, blindly replace technical vocabulary or turn "may" into invented precision. Hints cannot identify all missing reasoning or certify natural voice.

Review diagram labels and generated interaction text manually when extraction misses them. Load [the copy-check contract](readability-checks.md) only at that step when using standalone `explain-lint`, exported copy or diagnostics, not before ordinary writing.

## Read without decoration, then with the visual

Read representative copy without decoration. Could this reader follow the claims and transitions without the author's notes? Review labels with their caption, not as standalone essays. For narration, mentally rehearse the complete script: repair breathless clauses, abrupt topic changes and repetitive cadences. This is text review, not actual listening.

Then inspect the visual: point to named objects and follow claimed relationships. Arrows, states and labels should demonstrate them. Instructions such as "compare the highlighted rows" belong in this pass.

Cover the full reader-facing copy, including interactive states and summaries; a pilot does not cover later text. Log confusing passages and corrections with locators in existing QA notes. Separate clarity, factual support and visual polish; silent editorial review is not audio listening or learner testing.

For bilingual work, use [language](language.md): natural independent expression first, fidelity second. Use [artifact QA](artifact-qa.md) for acceptance; report unperformed review.
