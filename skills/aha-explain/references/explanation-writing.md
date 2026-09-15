# Explain relationships, not just conclusions

Read before styling and reuse during substantive copy revisions. Apply this to prose, headings, diagram labels, slide text and narration, not only long articles. These are editorial questions, not a required paragraph template, length limit or schema.

## Build the missing bridge

Start with the reader's question and a direct answer. For each necessary step, identify the objects, the action or comparison, the relevant condition, and the consequence. Ask what the reader would have to know to get from one sentence to the next. Supply the missing relationship or definition where it is needed; do not replace it with a list of related facts.

Words such as "match", "coordinate", "component", "effective" and "important" can hide the explanation. Specify what matches what, along which property; what is being coordinated; or how a condition changes the result. Prefer a concrete verb over a vague claim of importance. Preserve differences such as position versus timing, pressure versus perceived loudness, and textual compatibility versus program behavior.

Use a contrast, worked example or analogy when it resolves a likely misunderstanding. Bound it where the analogy stops applying. Do not invent a mechanism to make prose flow: if the bridge is not supported by the bound research, narrow the statement or return to research for a new snapshot.

For example, given evidence that a cache serves a stored response until expiry and may not observe an origin update:

| Outline-like copy | More explanatory copy |
| --- | --- |
| "Freshness is a timing problem. Expiry matters." | "After the source changes, the cache may still return its stored response until that entry expires. A request during that interval can therefore receive the older value." |
| "The right value, in the right place." | Name the stored response, the source value and the condition under which they differ; do not make the reader guess what "right" means. |

The example demonstrates a writing move, not a fact to reuse in unrelated research or a claim that every cache behaves this way.

## Make the entry point self-contained

Read the title alone, without the prompt, research notes, subtitle or diagram. Can the intended reader name the subject and the question? Create curiosity about the explanation, not about what an unexplained number, acronym or pronoun refers to. A headline can withhold the answer, but should not withhold the object needed to understand the question.

Introduce example values in the lead after naming the entity or configuration field, then describe its initial state, change and consequence. State units when supported; do not invent them to make a bare number meaningful. Revert a change, not a number; distinguish an operation from the value it affects. For example, "Why did 42 return?" hides the subject; "Why can a cache keep serving an old response?" names the mechanism and phenomenon without requiring the example first.

Apply this cold-reader check separately in each language and to browser titles, gallery labels, covers and other entry points that may appear without the body. Synchronize these surfaces after revising the main headline. Then inspect wrapping at the intended size: shorten phrasing or adjust composition without deleting the context that makes the title intelligible.

## Compress detail, not reasoning

A short title may attract attention, but its nearby explanation should resolve the question it raises. Read titles and emphasized phrases alone: do they imply a guarantee, equal split, exclusive cause or universal rule that the body later retracts? Revise the headline rather than relying on a distant caveat to undo it.

Remove author-outline fragments and process commentary from reader copy. Keep natural sources and material limitations close to the relevant claim; move audit details to QA notes. A useful caveat says what cannot be concluded and why, rather than repeatedly declaring that no promises are made.

When space is tight, remove a secondary branch or move detail into an appendix or disclosure. Keep the objects, causal or logical bridge, and material condition for the claims that remain. The same research can support an exploratory HTML, a recap image, sequential slides and a short mechanism video without identical wording, screenshots or equal coverage.

## Read without decoration, then with the visual

First read representative copy without its layout, diagram or emphasis. Can a reader at the stated knowledge level follow its claims and transitions? Labels need not become standalone essays: review them with their caption or the sentence that introduces the figure.

Then inspect the actual visual with the text. Point to the objects named in the explanation and follow each claimed relationship. Check whether arrows, state changes and labels demonstrate the explanation rather than merely decorate it. Explicitly pictorial instructions such as "compare the highlighted rows" belong in this second pass.

At final review, cover the full reader-facing copy, including interactive states and compressed summaries. A pilot review does not cover later text. Log specific confusing passages and corrections in existing QA notes with section, slide or time locators; separate explanatory clarity from factual support and visual polish. Reading aloud can reveal awkward phrasing, but silent editorial review is not audio listening or learner testing.

For bilingual work, use [language](language.md): natural independent expression first, cross-language fidelity second. A faithful translation of an unclear source can leave both languages unclear. Use [artifact QA](artifact-qa.md) for delivery acceptance and report exactly which review remains unperformed.
