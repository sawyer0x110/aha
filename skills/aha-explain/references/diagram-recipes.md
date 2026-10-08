# Optional relationship-first diagram recipes

Load only a matching recipe when it saves authoring effort. These are original, illustrative source fragments, not a page DSL, factual evidence or mandatory sections. Rename objects, replace conditions with the bound research, add nearby sources/limitations and explain the relationship in prose. Do not invent data or an interaction just to use a recipe.

| Reader needs to see | Starting point |
| --- | --- |
| Messages between actors in time | Sequence |
| How an event changes an object's state | State transition |
| Trade-offs under the same conditions | Comparison table |

## Select the relationship before the component

| Question the reader must answer | Visual relationship | Avoid |
| --- | --- | --- |
| Who sends what, and when? | Sequence with actors and message order | A folder tree standing in for runtime behavior |
| Which condition chooses the next step? | Branching flow with explicit conditions | Unlabeled arrows or an invented path |
| What changes from one state to another? | State transition with event/guard labels | Treating cancellation as immediate cleanup without evidence |
| What contains or depends on what? | Hierarchy/tree or topology | Inferring a call chain from directory nesting |
| How did the situation change over time? | Timeline with actual dates and scoped events | Chronology that does not explain the result |
| Which alternative fits the same requirement? | Aligned comparison with limitations | Different units, scopes or missing evidence presented as a verdict |
| How much changes under a supported condition? | Data chart with units, denominator and source | Invented numbers to fill a chart or slider |
| Why should this conclusion follow? | Claim/evidence/condition relationship, in prose or an argument diagram | Replacing the reasoning bridge with decorative boxes |

Choose only the relationship needed for the reader's task, then use the matching source fragment or freely author another. No graph, dashboard or interaction is required merely because it appears in this table.

For HTML, put the fragment inside the correct localized root; author each language independently. The bundled local Mermaid runtime lays out diagrams and supplies zoom/pan/expansion controls. Use `.mermaid`, not a CDN or a second initialization script; wait for `window.ahaMermaidReady` when inspecting. This reuses the [HTML contract](html.md), not a new renderer. Diagrams still need geometry and relationship QA. Use free SVG or another composition when a recipe cannot carry the argument.

## Sequence

```html
<figure>
  <pre class="mermaid">
sequenceDiagram
  participant R as Reader
  participant C as Cache
  participant O as Origin
  R->>C: Request
  alt Entry is available and eligible
    C-->>R: Stored response
  else Entry is unavailable or ineligible
    C->>O: Request
    O-->>C: Response
    C-->>R: Response
  end
  </pre>
  <figcaption>Illustrative only: the eligibility condition determines the path.</figcaption>
</figure>
```

The arrows distinguish requests from replies; the condition explains why a path is chosen. A real cache may have different eligibility, refresh or error behavior: establish it from sources before adapting the figure. Do not use an architecture box diagram as a substitute for this temporal relationship.

## State transition

```html
<figure>
  <pre class="mermaid">
stateDiagram-v2
  [*] --> Waiting
  Waiting --> Completed: Result arrives
  Waiting --> Cancelled: Cancellation takes effect
  </pre>
  <figcaption>Illustrative terminal states; cancellation timing is not established by this diagram.</figcaption>
</figure>
```

Keep state names stable across diagram, prose and controls. Draw cleanup or a race separately when it changes the explanation; an arrow labeled "cancel" does not prove pending work stops immediately.

## Comparison

```html
<table>
  <caption>Illustrative structure: compare alternatives under the same condition.</caption>
  <thead><tr><th scope="col">Condition</th><th scope="col">Alternative A</th><th scope="col">Alternative B</th></tr></thead>
  <tbody><tr><th scope="row">Evidence needed</th><td>Author supported consequence and limitation.</td><td>Author supported consequence and limitation.</td></tr></tbody>
</table>
```

Use the same comparison dimensions, units and scope on both sides. Separate current observations from proposals; unsupported values stay unknown, not a checkmark or zero. For prose-heavy mobile reviews, group each condition with its evidence and recommendation vertically instead of shrinking the table.

For image output, compose the chosen relationship for reading size rather than capturing a whole article. For PPTX, translate it into native text, shapes/connectors or tables when editability matters; Mermaid SVG is not a native editable diagram. For video, use the relationship to plan deterministic state changes and holds, not an assertion that static Mermaid automatically becomes an animation. Follow the chosen medium's existing authoring and QA guide.
