import test from 'node:test';
import assert from 'node:assert/strict';
import { createDraft, createExample } from '../src/core/examples.js';
import { runScenario, stateAt } from '../src/core/engine.js';
import { canonicalize, hashValue } from '../src/core/identity.js';
import { buildPack, packHash, validatePack } from '../src/core/pack.js';
import { createExploration, importExploration } from '../src/core/exploration.js';
import { AhaError } from '../src/core/errors.js';
import type { CompoundInput, RetryInput, Scenario } from '../src/core/schema.js';

const code = (expected: string) => (error: unknown): boolean =>
  error instanceof AhaError && error.code === expected;

const retryModel = { engine: 'retry', version: '1.0.0', assumptions: [], evidenceIds: ['rules'] } as const;
function retry(input: Partial<RetryInput> = {}) {
  return runScenario({ ...retryModel, evidenceIds: ['rules'], assumptions: [] }, {
    id: 'test', title: 'test', mode: 'derived-model', claimIds: [],
    input: {
      maxRetries: 2, baseDelayMs: 250, multiplier: 2, maxDelayMs: 60000,
      outcomes: ['transient', 'transient', 'success'], retryableErrors: ['transient'],
      ...input,
    },
  });
}

function compound(input: Partial<CompoundInput> = {}) {
  return runScenario({ engine: 'compound', version: '1.0.0', assumptions: [], evidenceIds: ['rules'] }, {
    id: 'test', title: 'test', mode: 'derived-model', claimIds: [],
    input: { principal: '10000', rates: ['10', '-10'], cashflows: ['0', '0'], timing: 'end', ...input },
  });
}

test('retry distinguishes attempts, retries, logical delays and terminal reason', () => {
  const trace = retry();
  assert.deepEqual(trace.result, { attempt: 3, status: 'success', totalDelayMs: 750 });
  assert.deepEqual(trace.events.filter(event => event.kind === 'retry-scheduled').map(event => event.details.delayMs), [250, 500]);
  assert.deepEqual(trace.events.filter(event => event.kind === 'attempt-started').map(event => event.logicalTimeMs), [0, 250, 750]);
  assert.deepEqual(retry({ maxRetries: 0 }).result, { attempt: 1, status: 'retries-exhausted', totalDelayMs: 0 });
  assert.deepEqual(retry({ outcomes: ['fatal'] }).result, { attempt: 1, status: 'not-retryable', totalDelayMs: 0 });
  assert.equal(retry({ outcomes: ['success'] }).result.attempt, 1);
});

test('retry caps deliberate backoff but rejects invalid and missing inputs', () => {
  assert.equal(retry({ maxDelayMs: 300 }).result.totalDelayMs, 550);
  assert.equal(retry({ baseDelayMs: 0 }).result.totalDelayMs, 0);
  assert.throws(() => retry({ maxRetries: -1 }), code('SCHEMA_INVALID'));
  assert.throws(() => retry({ maxRetries: 0.5 }), code('SCHEMA_INVALID'));
  assert.throws(() => retry({ maxRetries: 21 }), code('SCHEMA_INVALID'));
  assert.throws(() => retry({ outcomes: ['transient'] }), code('OUTCOME_MISSING'));
});

test('forward, backward and reset recover identical states without changing traces', () => {
  const trace = retry();
  const original = canonicalize(trace);
  assert.deepEqual(stateAt(trace, 0), trace.initialState);
  assert.deepEqual(stateAt(trace, trace.events.length), trace.result);
  for (let step = trace.events.length; step > 0; step--) {
    assert.deepEqual(stateAt(trace, step), trace.events[step - 1]?.stateAfter);
  }
  assert.equal(canonicalize(trace), original);
  assert.throws(() => stateAt(trace, -1), code('STEP_RANGE'));
  assert.throws(() => stateAt(trace, 0.5), code('STEP_RANGE'));
  assert.throws(() => stateAt(trace, 500), code('STEP_RANGE'));
});

test('compound preserves order invariance without intermediate rounding', () => {
  assert.equal(compound().result.balance, '9900.00');
  assert.equal(compound({ rates: ['-10', '10'] }).result.balance, '9900.00');
  const a = compound({ principal: '0.01', rates: ['50', '-50'] });
  const b = compound({ principal: '0.01', rates: ['-50', '50'] });
  assert.equal(a.result.exactBalance, '3/400');
  assert.equal(a.result.exactBalance, b.result.exactBalance);
  assert.equal(a.result.balance, '0.01');
});

test('compound gives known cashflow and timing results with half-up display', () => {
  assert.equal(compound({ cashflows: ['1000', '0'] }).result.balance, '10800.00');
  assert.equal(compound({ rates: ['-10', '10'], cashflows: ['1000', '0'] }).result.balance, '11000.00');
  assert.equal(compound({ rates: ['10'], cashflows: ['1000'], timing: 'beginning' }).result.balance, '12100.00');
  assert.equal(compound({ rates: ['10'], cashflows: ['1000'], timing: 'end' }).result.balance, '12000.00');
  assert.equal(compound({ principal: '0.005', rates: ['0'], cashflows: ['0'] }).result.balance, '0.01');
  assert.equal(compound({ rates: ['-100'], cashflows: ['0'] }).result.balance, '0.00');
});

test('compound rejects out-of-domain values instead of truncating or coercing', () => {
  assert.throws(() => compound({ principal: '-1' }), code('PRINCIPAL_RANGE'));
  assert.throws(() => compound({ principal: '1e3' }), code('SCHEMA_INVALID'));
  assert.throws(() => compound({ principal: '100\n' }), code('SCHEMA_INVALID'));
  assert.throws(() => compound({ principal: '1.0000001' }), code('SCHEMA_INVALID'));
  assert.throws(() => compound({ rates: ['-100.000001'], cashflows: ['0'] }), code('RATE_RANGE'));
  assert.throws(() => compound({ rates: ['1001'], cashflows: ['0'] }), code('RATE_RANGE'));
  assert.throws(() => compound({ cashflows: ['0'] }), code('CASHFLOW_LENGTH'));
  assert.throws(() => compound({ cashflows: ['-20000', '0'] }), code('BALANCE_RANGE'));
  assert.throws(() => compound({ cashflows: ['-20000', '0'], timing: 'beginning' }), code('BALANCE_RANGE'));
});

test('maximum supported model inputs remain bounded and deterministic', () => {
  const input: Partial<CompoundInput> = {
    principal: '999999999999.999999',
    rates: Array.from({ length: 120 }, () => '999.999999'),
    cashflows: Array.from({ length: 120 }, () => '999999999999.999999'),
  };
  const durations: number[] = [];
  const expected = compound(input);
  for (let index = 0; index < 25; index++) {
    const start = performance.now();
    const result = compound(input);
    durations.push(performance.now() - start);
    assert.deepEqual(result.result, expected.result);
  }
  assert.equal(expected.events.length, 120);
  durations.sort((a, b) => a - b);
  assert.ok(durations[23]! < 200, `P95 model computation took ${durations[23]}ms`);
  const retries = retry({
    maxRetries: 20, multiplier: 4, maxDelayMs: 3600000,
    outcomes: [...Array.from({ length: 20 }, () => 'transient' as const), 'success'],
  });
  assert.equal(retries.result.attempt, 21);
  assert.ok(retries.events.length <= 42);
});

test('all demo packs have reproducible identities and correctly classified modes', async () => {
  for (const engine of ['retry', 'compound', 'evidence'] as const) {
    const first = await createExample(engine);
    assert.equal(first.manifest.contentHash, (await createExample(engine)).manifest.contentHash);
    assert.equal((await validatePack(first)).modelSpec.engine, engine);
    assert.ok(first.scenarios.every(scenario => scenario.mode === (engine === 'evidence' ? 'source-based' : 'derived-model')));
    if (engine === 'evidence') assert.equal(first.traces[0]?.events.length, 0);
  }
});

test('canonical hashing ignores key order but not content', async () => {
  assert.equal(await hashValue({ b: 1, a: 2 }), await hashValue({ a: 2, b: 1 }));
  assert.notEqual(await hashValue({ a: 2 }), await hashValue({ a: 3 }));
  assert.throws(() => canonicalize({ a: undefined }), code('JSON_VALUE'));
  assert.throws(() => canonicalize(Number.NaN), code('JSON_VALUE'));
});

test('references, unknown properties, source identities and mode confusion are rejected', async () => {
  const draft = createDraft('retry');
  draft.claims[0]!.evidenceIds = ['nonexistent'];
  await assert.rejects(buildPack(draft), code('REFERENCE_UNKNOWN'));
  draft.claims[0]!.evidenceIds = [];
  await assert.rejects(buildPack(draft), code('EVIDENCE_MISSING'));
  draft.claims[0]!.evidenceIds = ['rules'];
  draft.scenarios[0]!.mode = 'observed';
  await assert.rejects(buildPack(draft), code('MODE_UNSUPPORTED'));
  draft.scenarios[0]!.mode = 'derived-model';
  draft.narrative.slides[0]!.eventStep = 2;
  await assert.rejects(buildPack(draft), code('NARRATIVE_REFERENCE'));
  const clean = createDraft('retry');
  await assert.rejects(buildPack({ ...clean, arbitraryScript: 'evil()' }), code('SCHEMA_INVALID'));
  clean.evidence[0]!.kind = 'code';
  await assert.rejects(buildPack(clean), code('SOURCE_IDENTITY'));
});

test('a recomputed malicious hash does not hide a fabricated model trace', async () => {
  const pack = await createExample('retry');
  pack.traces[0]!.result.attempt = 999;
  await assert.rejects(validatePack(pack), code('PACK_HASH_MISMATCH'));
  pack.manifest.contentHash = await packHash(pack);
  await assert.rejects(validatePack(pack), code('TRACE_MISMATCH'));
});

test('exploration binds exact original snapshot and creates a new immutable revision', async () => {
  const pack = await createExample('compound');
  const original = canonicalize(pack);
  const scenario: Scenario = {
    id: 'user-case', title: 'A changed input', claimIds: ['rule'], mode: 'derived-model',
    input: { principal: '10000', rates: ['10', '-10'], cashflows: ['0', '0'], timing: 'end' },
  };
  const trace = runScenario(pack.modelSpec, scenario);
  const note = 'My guess is NOT a fact.';
  const exploration = await createExploration(pack, [{ scenario, trace, note }]);
  const next = await importExploration(pack, exploration);
  assert.equal(next.manifest.revision, 2);
  assert.equal(next.manifest.parentHash, pack.manifest.contentHash);
  assert.notEqual(next.manifest.contentHash, pack.manifest.contentHash);
  assert.equal(next.traces.at(-1)?.result.balance, '9900.00');
  assert.equal(canonicalize(pack), original);
  assert.ok(!canonicalize(next.claims).includes(note));
  assert.ok(!canonicalize(next.narrative).includes(note));
  assert.equal(exploration.cases[0]?.note, note);
  await assert.rejects(importExploration(next, exploration), code('EXPLORATION_PACK_MISMATCH'));
});

test('exploration tampering is rejected even when its trace hash is recalculated', async () => {
  const pack = await createExample('retry');
  const exploration = await createExploration(pack, [{
    scenario: pack.scenarios[0]!, trace: pack.traces[0]!, note: '',
  }]);
  exploration.cases[0]!.trace.result.attempt = 100;
  exploration.cases[0]!.traceHash = await hashValue(exploration.cases[0]!.trace);
  await assert.rejects(importExploration(pack, exploration), code('EXPLORATION_TRACE_MISMATCH'));
});

test('Story import includes every selected case or rejects an oversized selection explicitly', async () => {
  const pack = await createExample('retry');
  const cases = Array.from({ length: 5 }, (_, index) => {
    const scenario = { ...pack.scenarios[0]!, id: `selected-${index + 1}` };
    return { scenario, trace: runScenario(pack.modelSpec, scenario), note: '' };
  });
  const four = await createExploration(pack, cases.slice(0, 4));
  const next = await importExploration(pack, four);
  assert.equal(next.narrative.slides.length, 8);
  assert.equal(next.narrative.slides.filter(slide => slide.scenarioId).length, 4);
  const five = await createExploration(pack, cases);
  await assert.rejects(importExploration(pack, five), code('STORY_CASE_LIMIT'));
});

test('source selections do not replace or expand the teaching narrative and still obey Pack limits', async () => {
  const pack = await createExample('evidence');
  const cases = Array.from({ length: 10 }, (_, index) => {
    const scenario = { ...pack.scenarios[0]!, id: `reading-${index + 1}` };
    return { scenario, trace: runScenario(pack.modelSpec, scenario), note: '个人学习笔记' };
  });
  const exploration = await createExploration(pack, cases);
  const next = await importExploration(pack, exploration);
  assert.deepEqual(next.narrative.slides, pack.narrative.slides);
  assert.equal(next.scenarios.length, pack.scenarios.length + 10);
  assert.equal(next.traces.length, pack.traces.length + 10);
  await assert.rejects(importExploration(next, await createExploration(next, cases)), code('SCENARIO_LIMIT'));
});

test('bad links, duplicate IDs and out-of-range narrative states cannot enter a Pack', async () => {
  const draft = createDraft('retry');
  draft.evidence[0]!.url = 'https://user:secret@example.com';
  await assert.rejects(buildPack(draft), code('SOURCE_URL'));
  draft.evidence[0]!.url = 'https://[';
  await assert.rejects(buildPack(draft), code('SOURCE_URL'));
  delete draft.evidence[0]!.url;
  draft.narrative.slides[2]!.eventStep = 999;
  await assert.rejects(buildPack(draft), code('NARRATIVE_REFERENCE'));
  delete draft.narrative.slides[2]!.eventStep;
  draft.claims.push({ ...draft.claims[0]! });
  await assert.rejects(buildPack(draft), code('DUPLICATE_ID'));
  const newline = createDraft('retry');
  newline.scenarios[0]!.id = 'baseline\n';
  await assert.rejects(buildPack(newline), code('SCHEMA_INVALID'));
});

test('valid empty or long metadata remains importable without losing the original metadata', async () => {
  for (const items of [[], Array.from({ length: 5 }, () => 'a'.repeat(1000))]) {
    const draft = createDraft('retry');
    draft.brief.scope = items;
    draft.brief.exclusions = items;
    draft.modelSpec.assumptions = items;
    const pack = await buildPack(draft);
    const exploration = await createExploration(pack, [{
      scenario: pack.scenarios[0]!, trace: pack.traces[0]!, note: '',
    }]);
    const next = await importExploration(pack, exploration);
    assert.deepEqual(next.brief.scope, items);
    assert.deepEqual(next.modelSpec.assumptions, items);
    assert.ok(next.narrative.slides.every(slide => slide.body.length > 0 && slide.body.length <= 4000));
  }
});

test('teaching visuals require valid claim links and retain their identity through evidence import', async () => {
  const draft = createDraft('evidence');
  draft.brief.explanation!.visual = {
    layout: 'cards', title: '两种解释',
    items: [{ label: '车辆', body: '车辆更多' }, { label: '客流', body: '乘客更少' }],
    claimIds: ['missing'],
  };
  await assert.rejects(buildPack(draft), code('REFERENCE_UNKNOWN'));
  draft.brief.explanation!.visual.claimIds = [draft.claims[0]!.id];
  draft.narrative.slides[0]!.visual = structuredClone(draft.brief.explanation!.visual);
  draft.narrative.slides[0]!.visual.claimIds = ['missing'];
  await assert.rejects(buildPack(draft), code('REFERENCE_UNKNOWN'));
  draft.narrative.slides[0]!.visual.claimIds = [draft.claims[0]!.id];
  const pack = await buildPack(draft);
  const exploration = await createExploration(pack, [{ scenario: pack.scenarios[0]!, trace: pack.traces[0]!, note: '学习者笔记不是新结论' }]);
  const next = await importExploration(pack, exploration);
  assert.deepEqual(next.narrative.slides, pack.narrative.slides);
  assert.equal(next.narrative.version, pack.narrative.version + 1);
  assert.deepEqual(next.brief.explanation!.visual, pack.brief.explanation!.visual);
  assert.equal(next.scenarios.length, pack.scenarios.length + 1);
  assert.equal(next.manifest.parentHash, pack.manifest.contentHash);
  assert.ok(!JSON.stringify(next.narrative).includes('学习者笔记'));
});
