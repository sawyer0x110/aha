import { Type, type Static } from '@sinclair/typebox';

const objectOptions = { additionalProperties: false } as const;
const Id = Type.String({ pattern: '^[a-z][a-z0-9-]{0,63}(?![\\s\\S])' });
const Text = Type.String({ minLength: 1, maxLength: 4000 });
const Texts = Type.Array(Text, { maxItems: 50 });
const Ids = Type.Array(Id, { maxItems: 100, uniqueItems: true });
const Hash = Type.String({ pattern: '^[a-f0-9]{64}(?![\\s\\S])' });
const Decimal = Type.String({ pattern: '^-?(0|[1-9][0-9]{0,11})(\\.[0-9]{1,6})?(?![\\s\\S])' });
const ErrorKind = Type.Union([
  Type.Literal('transient'), Type.Literal('fatal'), Type.Literal('success'),
]);
export const EngineSchema = Type.Union([
  Type.Literal('retry'), Type.Literal('compound'), Type.Literal('evidence'),
]);
export const ModeSchema = Type.Union([
  Type.Literal('derived-model'), Type.Literal('source-based'),
  Type.Literal('observed'), Type.Literal('illustrative'),
]);
export const RetryInputSchema = Type.Object({
  maxRetries: Type.Integer({ minimum: 0, maximum: 20 }),
  baseDelayMs: Type.Integer({ minimum: 0, maximum: 60000 }),
  multiplier: Type.Integer({ minimum: 1, maximum: 4 }),
  maxDelayMs: Type.Integer({ minimum: 0, maximum: 3600000 }),
  outcomes: Type.Array(ErrorKind, { minItems: 1, maxItems: 21 }),
  retryableErrors: Type.Array(Type.Union([Type.Literal('transient'), Type.Literal('fatal')]), {
    maxItems: 2, uniqueItems: true,
  }),
}, objectOptions);
export const CompoundInputSchema = Type.Object({
  principal: Decimal,
  rates: Type.Array(Decimal, { minItems: 1, maxItems: 120 }),
  cashflows: Type.Array(Decimal, { minItems: 1, maxItems: 120 }),
  timing: Type.Union([Type.Literal('beginning'), Type.Literal('end')]),
}, objectOptions);
export const EvidenceInputSchema = Type.Object({ evidenceIds: Ids }, objectOptions);
export const InputSchema = Type.Union([RetryInputSchema, CompoundInputSchema, EvidenceInputSchema]);
export const TeachingVisualSchema = Type.Object({
  layout: Type.Union([Type.Literal('cards'), Type.Literal('steps')]),
  title: Type.String({ minLength: 1, maxLength: 80 }),
  items: Type.Array(Type.Object({
    label: Type.String({ minLength: 1, maxLength: 40 }),
    body: Type.String({ minLength: 1, maxLength: 160 }),
  }, objectOptions), { minItems: 2, maxItems: 4 }),
  claimIds: Type.Array(Id, { minItems: 1, maxItems: 100, uniqueItems: true }),
}, objectOptions);
const ReaderConditions = Type.Array(Type.String({ minLength: 1, maxLength: 180 }), { maxItems: 6 });
const TeachingIds = Type.Array(Id, { minItems: 1, maxItems: 100, uniqueItems: true });
export const TeachingSchema = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 90 }),
  objective: Type.String({ minLength: 1, maxLength: 240 }),
  misconception: Type.String({ minLength: 1, maxLength: 240 }),
  basis: Type.Object({
    kind: Type.Union([Type.Literal('recorded-example'), Type.Literal('source-example')]),
    note: Type.String({ minLength: 1, maxLength: 180 }),
    evidenceIds: TeachingIds,
  }, objectOptions),
  entities: Type.Array(Type.Object({
    id: Id, label: Type.String({ minLength: 1, maxLength: 40 }),
    description: Type.String({ minLength: 1, maxLength: 100 }),
  }, objectOptions), { minItems: 2, maxItems: 3 }),
  states: Type.Array(Type.Object({
    id: Id, label: Type.String({ minLength: 1, maxLength: 60 }),
    values: Type.Array(Type.Object({
      entityId: Id, label: Type.String({ minLength: 1, maxLength: 40 }),
      content: Type.String({ maxLength: 300 }),
    }, objectOptions), { minItems: 2, maxItems: 3 }),
  }, objectOptions), { minItems: 2, maxItems: 7 }),
  transitions: Type.Array(Type.Object({
    id: Id, from: Id, to: Id, targetEntityId: Id,
    copyFromEntityId: Type.Optional(Id),
    action: Type.String({ minLength: 1, maxLength: 60 }),
    command: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
    explanation: Type.String({ minLength: 1, maxLength: 240 }),
    predictionId: Id, claimIds: TeachingIds,
  }, objectOptions), { minItems: 1, maxItems: 6 }),
  checks: Type.Array(Type.Object({
    id: Id, kind: Type.Union([Type.Literal('prediction'), Type.Literal('transfer')]),
    question: Type.String({ minLength: 1, maxLength: 240 }),
    choices: Type.Array(Type.Object({
      id: Id, text: Type.String({ minLength: 1, maxLength: 120 }),
      feedback: Type.String({ minLength: 1, maxLength: 240 }),
    }, objectOptions), { minItems: 2, maxItems: 4 }),
    correctChoiceId: Id, claimIds: TeachingIds,
  }, objectOptions), { minItems: 2, maxItems: 8 }),
  card: Type.Object({
    headline: Type.String({ minLength: 1, maxLength: 90 }),
    summary: Type.String({ minLength: 1, maxLength: 180 }),
    transitionIds: Type.Array(Id, { minItems: 1, maxItems: 4, uniqueItems: true }),
    takeaway: Type.String({ minLength: 1, maxLength: 150 }),
    claimIds: TeachingIds,
  }, objectOptions),
  outcome: Type.Optional(Type.Object({
    fromStateId: Id, sourceEntityId: Id,
    action: Type.String({ minLength: 1, maxLength: 100 }),
    label: Type.String({ minLength: 1, maxLength: 80 }),
    explanation: Type.String({ minLength: 1, maxLength: 240 }),
    basis: Type.Literal('rule-application'),
    claimIds: TeachingIds,
  }, objectOptions)),
}, objectOptions);
export const TeachingSceneSchema = Type.Object({
  kind: Type.Union([
    Type.Literal('hook'), Type.Literal('transition'), Type.Literal('mechanism'),
    Type.Literal('transfer'), Type.Literal('answer'), Type.Literal('outcome'), Type.Literal('takeaway'),
  ]),
  transitionId: Type.Optional(Id),
  checkId: Type.Optional(Id),
  statePhase: Type.Optional(Type.Union([Type.Literal('before'), Type.Literal('after')])),
}, objectOptions);
export const ExplanationSchema = Type.Object({
  takeaway: Type.String({ minLength: 1, maxLength: 240 }),
  analogy: Type.Optional(Type.Object({
    text: Type.String({ minLength: 1, maxLength: 300 }),
    limitations: Type.String({ minLength: 1, maxLength: 300 }),
  }, objectOptions)),
  glossary: Type.Array(Type.Object({
    term: Type.String({ minLength: 1, maxLength: 60 }),
    meaning: Type.String({ minLength: 1, maxLength: 200 }),
  }, objectOptions), { maxItems: 8 }),
  checkQuestion: Type.String({ minLength: 1, maxLength: 240 }),
  answer: Type.Optional(Type.String({ minLength: 1, maxLength: 400 })),
  conditions: Type.Optional(ReaderConditions),
  visual: Type.Optional(TeachingVisualSchema),
}, objectOptions);
export const BriefSchema = Type.Object({
  topic: Text, question: Text, audience: Text, language: Type.Literal('zh-CN'),
  prerequisites: Texts, scope: Texts, exclusions: Texts,
  explanation: Type.Optional(ExplanationSchema),
}, objectOptions);
export const ResearchSchema = Type.Object({
  question: Text,
  kind: Type.Union([Type.Literal('codebase'), Type.Literal('public'), Type.Literal('mixed'), Type.Literal('provided')]),
  queries: Type.Array(Type.Object({ query: Text, purpose: Text }, objectOptions), { minItems: 1, maxItems: 40 }),
  findings: Type.Array(Type.Object({
    claimId: Id, evidenceIds: Ids,
    assessment: Type.Union([Type.Literal('supported'), Type.Literal('contested'), Type.Literal('unresolved')]),
    rationale: Text,
  }, objectOptions), { maxItems: 100 }),
  gaps: Texts, stopReason: Text,
}, objectOptions);
export const EvidenceSchema = Type.Object({
  id: Id,
  kind: Type.Union([
    Type.Literal('model-spec'), Type.Literal('document'), Type.Literal('code'),
    Type.Literal('web'), Type.Literal('provided-trace'),
  ]),
  title: Text, locator: Text, summary: Text,
  sourceVersion: Text,
  retrievedAt: Type.Optional(Type.String({ maxLength: 100 })),
  contentHash: Type.Optional(Hash),
  url: Type.Optional(Type.String({ pattern: '^https?://[^\\s]+(?![\\s\\S])', maxLength: 2000 })),
}, objectOptions);
export const ClaimSchema = Type.Object({
  id: Id, text: Text, scope: Text,
  type: Type.Union([
    Type.Literal('source-claim'), Type.Literal('model-result'),
    Type.Literal('inference'), Type.Literal('unresolved'), Type.Literal('observation'),
  ]),
  evidenceIds: Ids, assumptions: Texts, limitations: Texts,
}, objectOptions);
export const ModelSpecSchema = Type.Object({
  engine: EngineSchema, version: Type.Literal('1.0.0'),
  assumptions: Texts, evidenceIds: Ids,
}, objectOptions);
export const ScenarioSchema = Type.Object({
  id: Id, title: Text, input: InputSchema, mode: ModeSchema, claimIds: Ids,
}, objectOptions);
const State = Type.Record(Type.String({ maxLength: 80 }), Type.Union([
  Type.String({ maxLength: 4000 }), Type.Number(), Type.Boolean(), Type.Null(),
]));
export const EventSchema = Type.Object({
  eventId: Id, step: Type.Integer({ minimum: 1, maximum: 1000 }),
  kind: Id, logicalTimeMs: Type.Integer({ minimum: 0, maximum: 86400000 }),
  stateBefore: State, stateAfter: State, details: State, evidenceIds: Ids,
}, objectOptions);
export const TraceSchema = Type.Object({
  scenarioId: Id, engine: EngineSchema, engineVersion: Type.Literal('1.0.0'),
  mode: ModeSchema, input: InputSchema, initialState: State,
  events: Type.Array(EventSchema, { maxItems: 1000 }),
  result: State,
}, objectOptions);
export const SlideSchema = Type.Object({
  id: Id, title: Text, body: Text, notes: Type.String({ maxLength: 8000 }),
  claimIds: Ids, scenarioId: Type.Optional(Id),
  eventStep: Type.Optional(Type.Integer({ minimum: 0, maximum: 1000 })),
  conditions: Type.Optional(ReaderConditions),
  visual: Type.Optional(TeachingVisualSchema),
  scene: Type.Optional(TeachingSceneSchema),
}, objectOptions);
export const NarrativeSchema = Type.Object({
  version: Type.Integer({ minimum: 1 }),
  slides: Type.Array(SlideSchema, { minItems: 1, maxItems: 12 }),
}, objectOptions);
export const ManifestSchema = Type.Object({
  schemaVersion: Type.Literal('0.1.0'), packId: Id,
  revision: Type.Integer({ minimum: 1 }),
  visibility: Type.Union([Type.Literal('private'), Type.Literal('public')]),
  contentHash: Hash,
  parentHash: Type.Optional(Hash),
}, objectOptions);
export const PackSchema = Type.Object({
  manifest: ManifestSchema, brief: BriefSchema,
  claims: Type.Array(ClaimSchema, { maxItems: 100 }),
  evidence: Type.Array(EvidenceSchema, { minItems: 1, maxItems: 100 }),
  modelSpec: ModelSpecSchema,
  scenarios: Type.Array(ScenarioSchema, { minItems: 1, maxItems: 20 }),
  traces: Type.Array(TraceSchema, { minItems: 1, maxItems: 20 }),
  narrative: NarrativeSchema,
  research: Type.Optional(ResearchSchema),
  teaching: Type.Optional(TeachingSchema),
}, { ...objectOptions, $schema: 'http://json-schema.org/draft-07/schema#', $id: 'https://aha.invalid/schemas/pack-0.1.0.json' });
export const DraftSchema = Type.Object({
  schemaVersion: Type.Literal('0.1.0'), packId: Id,
  visibility: Type.Union([Type.Literal('private'), Type.Literal('public')]),
  brief: BriefSchema,
  claims: Type.Array(ClaimSchema, { maxItems: 100 }),
  evidence: Type.Array(EvidenceSchema, { minItems: 1, maxItems: 100 }),
  modelSpec: ModelSpecSchema,
  scenarios: Type.Array(ScenarioSchema, { minItems: 1, maxItems: 20 }),
  narrative: NarrativeSchema,
  research: Type.Optional(ResearchSchema),
  teaching: Type.Optional(TeachingSchema),
}, { ...objectOptions, $schema: 'http://json-schema.org/draft-07/schema#', $id: 'https://aha.invalid/schemas/draft-0.1.0.json' });
export const ExplorationCaseSchema = Type.Object({
  scenario: ScenarioSchema, trace: TraceSchema, traceHash: Hash,
  note: Type.String({ maxLength: 4000 }),
}, objectOptions);
export const ExplorationSchema = Type.Object({
  schemaVersion: Type.Literal('0.1.0'),
  packId: Id, packHash: Hash, engineVersion: Type.Literal('1.0.0'),
  cases: Type.Array(ExplorationCaseSchema, { minItems: 1, maxItems: 10 }),
}, { ...objectOptions, $schema: 'http://json-schema.org/draft-07/schema#', $id: 'https://aha.invalid/schemas/exploration-0.1.0.json' });

export type Engine = Static<typeof EngineSchema>;
export type Mode = Static<typeof ModeSchema>;
export type RetryInput = Static<typeof RetryInputSchema>;
export type CompoundInput = Static<typeof CompoundInputSchema>;
export type EvidenceInput = Static<typeof EvidenceInputSchema>;
export type Input = Static<typeof InputSchema>;
export type Evidence = Static<typeof EvidenceSchema>;
export type Claim = Static<typeof ClaimSchema>;
export type ModelSpec = Static<typeof ModelSpecSchema>;
export type Scenario = Static<typeof ScenarioSchema>;
export type TraceEvent = Static<typeof EventSchema>;
export type Trace = Static<typeof TraceSchema>;
export type State = Trace['initialState'];
export type Narrative = Static<typeof NarrativeSchema>;
export type Pack = Static<typeof PackSchema>;
export type Draft = Static<typeof DraftSchema>;
export type Exploration = Static<typeof ExplorationSchema>;
export type Research = Static<typeof ResearchSchema>;
export type TeachingVisual = Static<typeof TeachingVisualSchema>;
export type Teaching = Static<typeof TeachingSchema>;
export type TeachingTransition = Teaching['transitions'][number];
export type TeachingState = Teaching['states'][number];
export type TeachingCheck = Teaching['checks'][number];
