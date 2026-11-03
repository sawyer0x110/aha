import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkMechanism, type MechanismModel } from '../src/mechanisms/model.js';

const example = new URL('../examples/mechanism-retry/', import.meta.url);
const model: MechanismModel = JSON.parse(await readFile(new URL('model.json', example), 'utf8'));
const trace = JSON.parse(await readFile(new URL('trace.json', example), 'utf8'));
const clone = () => structuredClone(model);

test('retry demo explores every reachable state, exposes omissions and replays without mutable history', async () => {
  const first = await checkMechanism(model, trace);
  assert.equal(first.status, 'checked');
  assert.deepEqual(first.exploration, {
    complete: true,
    reachable: ['queued', 'attempt-1', 'done', 'retry-ready', 'attempt-2', 'exhausted'],
    unreachable: ['over-budget'], deadEnds: ['done', 'exhausted'], examinedTransitions: 6,
  });
  assert.deepEqual(first.rules, [{ id: 'retry-budget', status: 'holds-in-model' }]);
  assert.equal(first.trace?.status, 'conforms-to-model');
  assert.equal(first.trace?.finalState, 'done');
  assert.equal(first.trace?.acceptedSteps.length, 4);
  assert.equal(first.model.provenance.kind, 'manual-teaching-model');
  assert.equal(first.provenanceVerified, false);
  assert.equal(first.sourceCodeExecuted, false);
  assert.equal(first.trace?.provenanceVerified, false);
  assert.match(first.undeclaredBehavior, /real behavior.*unknown/);
  assert.match(first.scope, /not program correctness/);
  assert.ok(first.model.omissions.length);
  const different = clone();
  different.initial = 'done';
  await checkMechanism(different);
  assert.deepEqual(await checkMechanism(model, trace), first, 'A-B-A produces identical complete results');
});

test('missing states/events, duplicate IDs and ambiguous guarded transitions are rejected', async () => {
  const missing = clone();
  missing.states = missing.states.filter(state => state.id !== 'retry-ready');
  await assert.rejects(checkMechanism(missing), /Unknown reference: retry-ready/);
  const event = clone();
  event.events = [];
  await assert.rejects(checkMechanism(event), /Unknown reference: start/);
  const duplicate = clone();
  duplicate.states.push(duplicate.states[0]!);
  await assert.rejects(checkMechanism(duplicate), /IDs must be unique/);
  const ambiguous = clone();
  ambiguous.transitions.push({ ...ambiguous.transitions[0]!, id: 'other-start', to: 'done' });
  await assert.rejects(checkMechanism(ambiguous), /Each state\/event pair/);
  const rule = clone();
  rule.rules[0]!.forbiddenStates = ['missing'];
  await assert.rejects(checkMechanism(rule), /Unknown reference: missing/);
});

test('rules report shortest counterexamples, including zero steps and finite cycles', async () => {
  const broken = clone();
  broken.transitions.push({
    id: 'retry-again', from: 'exhausted', event: 'retry', to: 'over-budget',
    basis: 'Deliberately broken teaching rule: permits a third attempt.',
  });
  const result = await checkMechanism(broken);
  assert.equal(result.status, 'violated');
  assert.deepEqual(result.rules[0]?.counterexample?.steps.map(step => step.id),
    ['start-first', 'first-failure', 'start-retry', 'retry-failure', 'retry-again']);
  const shorter = clone();
  shorter.transitions.push({
    id: 'shortcut', from: 'queued', event: 'retry', to: 'over-budget', basis: 'Synthetic one-step violation.',
  });
  shorter.rules[0]!.forbiddenStates.push('exhausted');
  assert.deepEqual((await checkMechanism(shorter)).rules[0]?.counterexample?.steps.map(step => step.id), ['shortcut']);
  shorter.initial = 'over-budget';
  assert.deepEqual((await checkMechanism(shorter)).rules[0]?.counterexample?.steps, []);
  const cyclic = clone();
  cyclic.transitions.push({ id: 'loop', from: 'done', event: 'retry', to: 'queued', basis: 'Synthetic cycle.' });
  assert.equal((await checkMechanism(cyclic)).exploration.reachable.length, 6);
  const selfLoop = clone();
  selfLoop.transitions.push({ id: 'hold', from: 'attempt-1', event: 'retry', to: 'attempt-1', basis: 'Explicit teaching self-loop.' });
  const held = await checkMechanism(selfLoop, {
    ...trace, steps: [{ event: 'start', to: 'attempt-1' }, { event: 'retry', to: 'attempt-1' }],
  });
  assert.equal(held.trace?.status, 'conforms-to-model');
  assert.equal(held.trace?.acceptedSteps[1]?.id, 'hold');
  assert.deepEqual(held.exploration.deadEnds, ['done', 'exhausted']);
});

test('trace stops at the first illegal event or mismatched outcome and preserves the accepted prefix', async () => {
  const cases = [
    { event: 'retry', to: 'attempt-2', code: 'ILLEGAL_TRANSITION' },
    { event: 'start', to: 'done', code: 'OUTCOME_MISMATCH' },
    { event: 'invented', to: 'done', code: 'UNKNOWN_EVENT' },
    { event: 'start', to: 'missing', code: 'UNKNOWN_STATE' },
  ];
  for (const { event, to, code } of cases) {
    const result = await checkMechanism(model, { ...trace, steps: [{ event, to }] });
    assert.equal(result.status, 'violated');
    assert.equal(result.trace?.failure?.code, code);
    assert.equal(result.trace?.failure?.index, 0);
    assert.equal(result.trace?.acceptedSteps.length, 0);
  }
  const duplicateRun = await checkMechanism(model, {
    ...trace, steps: [...trace.steps, { event: 'start', to: 'attempt-1' }],
  });
  assert.equal(duplicateRun.trace?.failure?.index, 4);
  assert.equal(duplicateRun.trace?.finalState, 'done');
  assert.equal(duplicateRun.trace?.acceptedSteps.length, 4);
  const wrongStart = await checkMechanism(model, { ...trace, initial: 'attempt-2' });
  assert.equal(wrongStart.trace?.failure?.code, 'INITIAL_MISMATCH');
  assert.equal(wrongStart.trace?.finalState, 'queued');
  const empty = await checkMechanism(model, { ...trace, steps: [] });
  assert.equal(empty.trace?.status, 'conforms-to-model', 'A prefix is not a completion/liveness claim');
});

test('bounded inert input requires basis/provenance and does not infer a real execution', async () => {
  const noBasis = clone();
  noBasis.transitions[0]!.basis = ' ';
  await assert.rejects(checkMechanism(noBasis), /Expected string to match/);
  await assert.rejects(checkMechanism({ ...model, states: Array.from({ length: 257 }, () => model.states[0]) }), /256/);
  await assert.rejects(checkMechanism(model, { ...trace, steps: Array.from({ length: 4097 }, () => trace.steps[0]) }), /4096/);
  await assert.rejects(checkMechanism({ ...model, executable: 'process.exit()' }), /Unexpected property/);
  const declared = clone();
  declared.provenance.kind = 'code-derived';
  await assert.rejects(checkMechanism(declared), /need snapshot\/run references/);
  declared.provenance.references = ['worker.mjs:1-40 at a manually reviewed snapshot'];
  const result = await checkMechanism(declared);
  assert.equal(result.provenanceVerified, false);
  assert.notEqual(result.modelHash, (await checkMechanism(model)).modelHash);
  await assert.rejects(checkMechanism(model, {
    ...trace, provenance: { ...trace.provenance, kind: 'runtime-record' },
  }), /need snapshot\/run references/);
});

test('exact state/event/edge/rule/trace budgets work and exceeding each budget fails explicitly', async () => {
  const maximum: MechanismModel = {
    ...clone(), initial: 's0',
    states: Array.from({ length: 256 }, (_, index) => ({ id: `s${index}`, description: 'Synthetic bounded state.' })),
    events: Array.from({ length: 256 }, (_, index) => ({ id: `e${index}`, description: 'Synthetic bounded event.' })),
    transitions: Array.from({ length: 4096 }, (_, index) => ({
      id: `edge-${index}`, from: `s${Math.floor(index / 256)}`, event: `e${index % 256}`,
      to: `s${(Math.floor(index / 256) + 1) % 16}`, basis: 'Synthetic bounded cycle.',
    })),
    rules: Array.from({ length: 64 }, (_, index) => ({
      id: `rule-${index}`, description: 'Synthetic unreachable state.', forbiddenStates: ['s16'],
    })),
  };
  const result = await checkMechanism(maximum, {
    ...trace, initial: 's0',
    steps: Array.from({ length: 4096 }, (_, index) => ({ event: 'e0', to: `s${(index + 1) % 16}` })),
  });
  assert.equal(result.status, 'checked');
  assert.equal(result.exploration.examinedTransitions, 4096);
  assert.equal(result.exploration.reachable.length, 16);
  assert.equal(result.trace?.acceptedSteps.length, 4096);
  for (const [collection, maximumLength] of [['events', 256], ['transitions', 4096], ['rules', 64]] as const) {
    const over = { ...maximum, [collection]: [...maximum[collection], maximum[collection][0]] };
    await assert.rejects(checkMechanism(over), new RegExp(String(maximumLength)));
  }
});

test('built and independently bundled CLIs expose inert mechanism checks without code permission', () => {
  for (const entry of ['../dist/cli/aha.mjs', '../dist/skills/aha-explain/scripts/aha.mjs']) {
    const result = spawnSync(process.execPath, [
      fileURLToPath(new URL(entry, import.meta.url)),
      'mechanism-check', fileURLToPath(new URL('model.json', example)),
      '--trace', fileURLToPath(new URL('trace.json', example)),
    ], { encoding: 'utf8', timeout: 30000 });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const output = JSON.parse(result.stdout);
    assert.equal(output.status, 'checked');
    assert.equal(output.sourceCodeExecuted, false);
    assert.equal(output.trace.finalState, 'done');
    const invalid = spawnSync(process.execPath, [
      fileURLToPath(new URL(entry, import.meta.url)),
      'mechanism-check', fileURLToPath(new URL('model.json', example)),
      '--trace', fileURLToPath(new URL('model.json', example)),
    ], { encoding: 'utf8', timeout: 30000 });
    assert.equal(invalid.status, 1);
    assert.equal(JSON.parse(invalid.stdout).status, 'failed');
    const illegal = spawnSync(process.execPath, [
      fileURLToPath(new URL(entry, import.meta.url)),
      'mechanism-check', fileURLToPath(new URL('model.json', example)),
      '--trace', fileURLToPath(new URL('illegal-trace.json', example)),
    ], { encoding: 'utf8', timeout: 30000 });
    assert.equal(illegal.status, 1);
    const violation = JSON.parse(illegal.stdout);
    assert.equal(violation.status, 'violated');
    assert.equal(violation.trace.failure.index, 2);
    assert.equal(violation.trace.failure.code, 'ILLEGAL_TRANSITION');
  }
});
