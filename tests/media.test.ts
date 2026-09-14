import test from 'node:test';
import assert from 'node:assert/strict';
import { createExample } from '../src/core/examples.js';
import { AhaError } from '../src/core/errors.js';
import { hashValue } from '../src/core/identity.js';
import { approvePlan, prepareVideoPlan, subtitles, validateVideoPlan, type AudioManifest } from '../src/media/plan.js';
import { synthesize } from '../src/media/audio.js';
import { runTool } from '../src/media/process.js';

const code = (expected: string) => (error: unknown): boolean => error instanceof AhaError && error.code === expected;

test('narration binds pack, ordered sentences and voice; edits revoke matching approval', async () => {
  const pack = await createExample('compound');
  const plan = prepareVideoPlan(pack);
  const hash = await hashValue(plan);
  assert.deepEqual(await approvePlan(pack, plan, hash), plan);
  assert.equal(plan.voice, 'zh-CN-XiaoxiaoNeural');
  assert.ok(plan.segments.some(segment => segment.text.includes('10800.00')));
  await assert.rejects(approvePlan(pack, plan, ''), code('NARRATION_APPROVAL_REQUIRED'));
  const changed = structuredClone(plan);
  changed.segments[0]!.text += '改变';
  await assert.rejects(approvePlan(pack, changed, hash), code('NARRATION_APPROVAL_REQUIRED'));
  changed.packHash = '0'.repeat(64);
  assert.throws(() => validateVideoPlan(pack, changed), code('VIDEO_PACK_MISMATCH'));
  const voice = { ...plan, voice: 'zh-CN-XiaoxiaoNeural\n' };
  assert.throws(() => validateVideoPlan(pack, voice), code('SCHEMA_INVALID'));
});

test('narration rejects unknown references, lost claim links, injection and unbounded segments', async () => {
  const pack = await createExample('retry');
  const plan = prepareVideoPlan(pack);
  const bad = structuredClone(plan);
  bad.segments[0]!.slideId = 'missing';
  assert.throws(() => validateVideoPlan(pack, bad), code('VIDEO_SLIDE'));
  const duplicate = structuredClone(plan);
  duplicate.segments.push(duplicate.segments[0]!);
  assert.throws(() => validateVideoPlan(pack, duplicate), code('VIDEO_SEGMENT_ID'));
  for (const text of ['<script>', 'line\nbreak', 'x'.repeat(85), '\u000b']) {
    const invalid = structuredClone(plan);
    invalid.segments[0]!.text = text;
    assert.throws(() => validateVideoPlan(pack, invalid), code('SCHEMA_INVALID'));
  }
});

test('synthesis without network opt-in fails before any dependencies, directory or service call', async () => {
  const plan = prepareVideoPlan(await createExample('evidence'));
  await assert.rejects(synthesize(plan, 'must-not-create-anything', false), code('TTS_NETWORK_PERMISSION'));
});

test('sentence subtitles use measured cumulative frames, not estimated character length', async () => {
  const plan = prepareVideoPlan(await createExample('compound'));
  plan.segments = plan.segments.slice(0, 2);
  const audio: AudioManifest = {
    schemaVersion: '0.2.0', planHash: await hashValue(plan), provider: 'provided-audio', voice: 'fixture',
    segments: [
      { id: plan.segments[0]!.id, filename: 'segment-001.wav', sha256: '0'.repeat(64), frames: 31 },
      { id: plan.segments[1]!.id, filename: 'segment-002.wav', sha256: '0'.repeat(64), frames: 60 },
    ],
  };
  const srt = subtitles(plan, audio);
  assert.match(srt, /00:00:00,000 --> 00:00:01,033/);
  assert.match(srt, /00:00:01,033 --> 00:00:03,033/);
  assert.ok(srt.includes(plan.segments[1]!.text));
});

test('media process runner reports missing tools, failure, timeout and bounded output', async () => {
  await assert.rejects(runTool('aha-definitely-missing-executable', []), code('MEDIA_TOOL_MISSING'));
  await assert.rejects(runTool(process.execPath, ['-e', 'process.exit(2)']), code('MEDIA_TOOL_FAILED'));
  await assert.rejects(runTool(process.execPath, ['-e', 'setTimeout(()=>{},10000)'], { timeoutMs: 50 }), code('MEDIA_TIMEOUT'));
  await assert.rejects(runTool(process.execPath, ['-e', 'console.log("a".repeat(1000))'], { maxOutput: 20 }), code('MEDIA_OUTPUT_LIMIT'));
});
