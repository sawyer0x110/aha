import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { buildPack, validatePack } from '../src/core/pack.js';
import { readPack, writePack } from '../src/cli/files.js';
import { createExploration, importExploration } from '../src/core/exploration.js';
import { changedLines, teachingCheck, teachingOutcome, transitionContext } from '../src/core/teaching.js';
import type { Draft } from '../src/core/schema.js';
import { busyConfig, calmConfig, createTeachingDraft } from './helpers/teaching.js';

const fixture = createTeachingDraft;
const code = (expected: string) => (error: unknown) =>
  error instanceof Error && 'code' in error && error.code === expected;

test('synthetic teaching preserves its ledgers and four explicit states without claiming observed execution', async () => {
  const draft = await fixture();
  const original = structuredClone(draft);
  const pack = await buildPack(draft);
  for (const key of ['claims', 'evidence', 'research', 'modelSpec', 'scenarios'] as const) {
    assert.deepEqual(pack[key], original[key]);
  }
  assert.equal(pack.teaching!.basis.kind, 'source-example');
  assert.deepEqual(pack.teaching!.states.map(state => state.values.map(value => value.content)), [
    [calmConfig, ''], [calmConfig, calmConfig], [busyConfig, calmConfig], [busyConfig, busyConfig],
  ]);
  assert.equal(pack.teaching!.checks.filter(check => check.kind === 'prediction').length, 3);
  const transfer = teachingCheck(pack.teaching!, 'transfer');
  assert.equal(transfer.correctChoiceId, 'b');
  assert.match(transfer.question, /清空编辑配置/);
  assert.notEqual(transfer.question, teachingCheck(pack.teaching!, 'predict-edit').question);
  assert.equal(pack.narrative.slides[0]!.scene!.statePhase, 'after');
  const outcome = teachingOutcome(pack.teaching!);
  assert.equal(outcome.outcome.basis, 'rule-application');
  assert.equal(outcome.value.content, calmConfig);
  assert.equal(outcome.value, pack.teaching!.states[2]!.values[1]);
});

test('teaching is hashed, persisted and preserved across a source exploration import', async () => {
  const pack = await buildPack(await fixture());
  const directory = await mkdtemp(path.resolve('tests', 'teaching-core-artifacts-'));
  try {
    await writePack(path.join(directory, 'original.aha'), pack);
    const loaded = await readPack(path.join(directory, 'original.aha'));
    assert.deepEqual(loaded.teaching, pack.teaching);
    const exploration = await createExploration(loaded, [{
      scenario: loaded.scenarios[0]!, trace: loaded.traces[0]!, note: 'Synthetic automated import check.',
    }]);
    const imported = await importExploration(loaded, exploration);
    assert.deepEqual(imported.teaching, pack.teaching);
    assert.deepEqual(imported.narrative.slides, pack.narrative.slides);
    assert.equal(imported.manifest.parentHash, pack.manifest.contentHash);
    await writePack(path.join(directory, 'imported.aha'), imported, exploration);
    await readPack(path.join(directory, 'imported.aha'));
    loaded.teaching!.objective += ' changed';
    await assert.rejects(validatePack(loaded), code('PACK_HASH_MISMATCH'));
  } finally {
    await rm(directory, { recursive: true });
  }
});

test('changes distinguish unchanged entities and highlight inserted/modified rather than merely shifted lines', async () => {
  const teaching = (await fixture()).teaching!;
  const context = transitionContext(teaching, 'edit');
  assert.deepEqual(context.changes.map(change => change.changed), [true, false]);
  assert.deepEqual(context.changes[0]!.changedLines, [0, 1]);
  assert.deepEqual(changedLines('same\nlast', 'new\nsame\nlast'), [0]);
  assert.deepEqual(changedLines('first\nremoved\nlast', 'first\nlast'), []);
  assert.throws(() => transitionContext(teaching, 'missing'), code('TEACHING_REFERENCE'));
});

test('teaching rejects mismatched entities, fake copy arrows, disconnected states and uncovered claims', async () => {
  for (const [expected, change] of [
    ['TEACHING_STATE', (draft: Draft) => { draft.teaching!.states[0]!.values[1]!.entityId = 'editable-config'; }],
    ['TEACHING_SEQUENCE', (draft: Draft) => { draft.teaching!.transitions[1]!.from = 'initial'; }],
    ['TEACHING_CHANGE', (draft: Draft) => { draft.teaching!.transitions[1]!.targetEntityId = 'selected-config'; }],
    ['TEACHING_COPY', (draft: Draft) => { draft.teaching!.transitions[1]!.copyFromEntityId = 'selected-config'; }],
    ['TEACHING_REFERENCE', (draft: Draft) => { draft.teaching!.card.claimIds = ['claim-b']; }],
    ['TEACHING_REFERENCE', (draft: Draft) => { draft.teaching!.checks[0]!.claimIds = ['claim-b']; }],
    ['TEACHING_BASIS', (draft: Draft) => { draft.teaching!.basis.evidenceIds = ['missing']; }],
    ['TEACHING_CHECK', (draft: Draft) => { draft.teaching!.checks[0]!.correctChoiceId = 'missing'; }],
    ['TEACHING_CHECK', (draft: Draft) => { draft.teaching!.checks[3]!.question = draft.teaching!.checks[0]!.question; }],
    ['TEACHING_CHECK', (draft: Draft) => { draft.teaching!.checks.pop(); }],
    ['TEACHING_REFERENCE', (draft: Draft) => { draft.teaching!.outcome!.fromStateId = 'missing'; }],
    ['TEACHING_SCENE', (draft: Draft) => { delete draft.narrative.slides[0]!.scene!.statePhase; }],
    ['TEACHING_REQUIRED', (draft: Draft) => { delete draft.teaching; }],
  ] satisfies Array<[string, (draft: Draft) => void]>) {
    const draft = await fixture();
    change(draft);
    await assert.rejects(buildPack(draft), code(expected), expected);
  }
});

test('authors may choose one to twelve pages instead of stretching every topic to five', async () => {
  const draft = await fixture();
  draft.narrative.slides = [draft.narrative.slides[5]!];
  assert.equal((await buildPack(draft)).narrative.slides.length, 1);
  draft.narrative.slides = Array.from({ length: 12 }, (_, index) => ({ ...draft.narrative.slides[0]!, id: `page-${index}` }));
  assert.equal((await buildPack(draft)).narrative.slides.length, 12);
  draft.narrative.slides.push({ ...draft.narrative.slides[0]!, id: 'page-extra' });
  await assert.rejects(buildPack(draft), code('SCHEMA_INVALID'));
});
