import { Type, type Static } from '@sinclair/typebox';

const text = (maxLength = 20_000) => Type.String({ minLength: 1, maxLength, pattern: '\\S' });
const id = Type.String({ pattern: '^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$' });
const ids = () => Type.Array(id, { maxItems: 2_000, uniqueItems: true });
const object = { additionalProperties: false } as const;
const hash = Type.String({ pattern: '^[a-f0-9]{64}$' });

export const ResearchKindSchema = Type.Union([
  Type.Literal('public'), Type.Literal('codebase'), Type.Literal('mixed'), Type.Literal('provided'),
]);
export type ResearchKind = Static<typeof ResearchKindSchema>;

export const ClaimSchema = Type.Object({
  id,
  text: text(),
  evidenceIds: ids(),
  limitations: Type.Array(text(), { maxItems: 100 }),
  kind: Type.Optional(Type.Union([
    Type.Literal('fact'), Type.Literal('inference'), Type.Literal('unresolved'),
  ])),
  subquestionIds: Type.Optional(ids()),
}, object);

export const EvidenceSchema = Type.Object({
  id,
  kind: Type.Union([Type.Literal('web'), Type.Literal('code'), Type.Literal('provided')]),
  title: text(1_000),
  locator: text(4_000),
  summary: text(),
  sourceVersion: text(1_000),
  url: Type.Optional(text(4_000)),
  retrievedAt: Type.Optional(text(100)),
  contentHash: Type.Optional(hash),
  // Code snapshots are inert text; sealing checks their exact UTF-8 SHA-256.
  content: Type.Optional(Type.String({ maxLength: 1_000_000 })),
}, object);

export const SubquestionSchema = Type.Object({
  id,
  question: text(),
  status: Type.Union([
    Type.Literal('answered'), Type.Literal('partial'), Type.Literal('unresolved'), Type.Literal('out-of-scope'),
  ]),
  claimIds: ids(),
  gapIds: ids(),
}, object);

export const ResearchLogSchema = Type.Object({
  id,
  action: Type.Union([Type.Literal('search'), Type.Literal('read'), Type.Literal('failure')]),
  outcome: Type.Union([Type.Literal('success'), Type.Literal('failure')]),
  occurredAt: text(100),
  summary: text(),
  evidenceIds: ids(),
  subquestionIds: ids(),
  query: Type.Optional(text()),
  locator: Type.Optional(text(4_000)),
  readRange: Type.Optional(text(4_000)),
}, object);

export const ResearchDraftSchema = Type.Object({
  schemaVersion: Type.Literal('1.0.0'),
  id,
  title: text(1_000),
  question: text(),
  kind: ResearchKindSchema,
  language: text(100),
  status: Type.Union([Type.Literal('draft'), Type.Literal('complete')]),
  report: Type.String({ maxLength: 2_000_000 }),
  claims: Type.Array(ClaimSchema, { maxItems: 2_000 }),
  evidence: Type.Array(EvidenceSchema, { maxItems: 2_000 }),
  subquestions: Type.Array(SubquestionSchema, { minItems: 1, maxItems: 2_000 }),
  researchLog: Type.Array(ResearchLogSchema, { maxItems: 5_000 }),
  gaps: Type.Array(Type.Object({
    id,
    description: text(),
    subquestionIds: ids(),
  }, object), { maxItems: 2_000 }),
  stopReason: Type.String({ maxLength: 20_000 }),
}, object);
export type ResearchDraft = Static<typeof ResearchDraftSchema>;

export const DossierSchema = Type.Object({
  manifest: Type.Object({
    schemaVersion: Type.Literal('1.0.0'),
    researchId: id,
    contentHash: hash,
  }, object),
  research: ResearchDraftSchema,
}, object);
export type Dossier = Static<typeof DossierSchema>;
