import test from 'node:test';
import assert from 'node:assert/strict';
import { AhaError } from '../src/core/errors.js';
import { hashValue } from '../src/core/identity.js';
import { approvePlan, checkPlan, subtitles, type VideoPlan, type AudioManifest } from '../src/media/plan.js';
import { importAudio, synthesize } from '../src/media/audio.js';
import { runTool } from '../src/media/process.js';

const code = (expected: string) => (error: unknown): boolean => error instanceof AhaError && error.code === expected;
function fixture(): VideoPlan {
  return {
    schemaVersion: '1.0.0', status: 'authored', researchHash: '1'.repeat(64), sourceHash: '2'.repeat(64),
    provider: 'edge-tts', voice: 'zh-CN-XiaoxiaoNeural', rate: '+0%',
    duration: { minSeconds: 1, maxSeconds: 600 },
    segments: [{ id: 'sentence-1', text: 'A narrated claim, not a slide.', claimIds: ['claim-1'] }],
  };
}

test('approval binds exact authored text, provider, voice, source and research', async () => {
  const plan = fixture();
  const hash = await hashValue(plan);
  assert.equal(await approvePlan(plan, hash), hash);
  await assert.rejects(approvePlan(plan, undefined), code('NARRATION_APPROVAL_REQUIRED'));
  for (const change of [
    { voice: 'en-US-AriaNeural' }, { provider: 'provided-audio' as const },
    { sourceHash: '3'.repeat(64) }, { researchHash: '4'.repeat(64) },
    { segments: [{ ...plan.segments[0]!, text: 'Changed narration.' }] },
  ]) await assert.rejects(approvePlan({ ...plan, ...change }, hash), code('NARRATION_APPROVAL_REQUIRED'));
  await assert.rejects(approvePlan({ ...plan, status: 'draft' }, hash), code('NARRATION_DRAFT'));
});

test('schema rejects duplicate segments, control characters, old slide fields and unbounded plans', () => {
  const plan = fixture();
  assert.equal(checkPlan(plan).duration.maxSeconds, 600);
  assert.throws(() => checkPlan({ ...plan, segments: [plan.segments[0], plan.segments[0]] }), code('VIDEO_SEGMENT_ID'));
  for (const text of ['line\nbreak', 'x'.repeat(1001), '\u000b', '\u2028', ' ']) {
    assert.throws(() => checkPlan({ ...plan, segments: [{ ...plan.segments[0], text }] }));
  }
  assert.throws(() => checkPlan({ ...plan, segments: [{ ...plan.segments[0], slideId: 'slide-1' }] }), code('SCHEMA_INVALID'));
  assert.throws(() => checkPlan({ ...plan, duration: { minSeconds: 10, maxSeconds: 2 } }), code('VIDEO_DURATION_RANGE'));
  assert.throws(() => checkPlan({ ...plan, duration: { minSeconds: 1, maxSeconds: 601 } }), code('SCHEMA_INVALID'));
  assert.throws(() => checkPlan({ ...plan, sourceHash: undefined }), code('SCHEMA_INVALID'));
});

test('audio methods reject provider mismatch, draft and absent network opt-in before dependencies or writes', async () => {
  const plan = fixture();
  await assert.rejects(synthesize(plan, 'must-not-create-anything', false), code('TTS_NETWORK_PERMISSION'));
  await assert.rejects(synthesize({ ...plan, provider: 'provided-audio' }, 'must-not-create-anything', true), code('AUDIO_PROVIDER'));
  await assert.rejects(synthesize({ ...plan, status: 'draft' }, 'must-not-create-anything', true), code('NARRATION_DRAFT'));
  await assert.rejects(importAudio(plan, {}, '.', 'must-not-create-anything'), code('AUDIO_PROVIDER'));
});

test('subtitles preserve cumulative measured timing and escape markup without executing it', async () => {
  const plan = fixture();
  plan.provider = 'provided-audio';
  plan.segments[0]!.text = '<script>alert("x")</script> & a claim';
  plan.segments.push({ id: 'sentence-2', text: 'Second sentence.', claimIds: [] });
  const audio: AudioManifest = {
    schemaVersion: '1.0.0', planHash: await hashValue(plan), provider: plan.provider, voice: plan.voice,
    segments: [
      { id: 'sentence-1', filename: 'segment-001.wav', sha256: '0'.repeat(64), frames: 31 },
      { id: 'sentence-2', filename: 'segment-002.wav', sha256: '0'.repeat(64), frames: 60 },
    ],
  };
  const srt = subtitles(plan, audio);
  assert.match(srt, /00:00:00,000 --> 00:00:01,033/);
  assert.match(srt, /00:00:01,033 --> 00:00:03,033/);
  assert.match(srt, /&lt;script&gt;alert\("x"\)&lt;\/script&gt; &amp;/);
  assert.throws(() => subtitles(plan, { ...audio, segments: audio.segments.toReversed() }), code('AUDIO_SEGMENTS'));
  assert.throws(() => subtitles(plan, { ...audio, provider: 'edge-tts' }), code('AUDIO_PLAN_MISMATCH'));
});

test('process runner reports bounded failures without exposing provider output', async () => {
  await assert.rejects(runTool('aha-definitely-missing-executable', []), code('MEDIA_TOOL_MISSING'));
  await assert.rejects(runTool(process.execPath, ['-e', 'console.error("SECRET NARRATION");process.exit(2)']),
    (error: unknown) => code('MEDIA_TOOL_FAILED')(error) && !(error as Error).message.includes('SECRET'));
  await assert.rejects(runTool(process.execPath, ['-e', 'setTimeout(()=>{},10000)'], { timeoutMs: 50 }), code('MEDIA_TIMEOUT'));
  await assert.rejects(runTool(process.execPath, ['-e', 'console.log("a".repeat(1000))'], { maxOutput: 20 }), code('MEDIA_OUTPUT_LIMIT'));
});
