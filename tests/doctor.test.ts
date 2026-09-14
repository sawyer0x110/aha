import assert from 'node:assert/strict';
import test from 'node:test';
import { doctorRequirements, probeRequirements, type Probe } from '../src/cli/doctor.js';

test('dependency probes are scoped to the operation, not all supported formats', () => {
  for (const target of [undefined, 'research', 'html', 'pptx']) assert.deepEqual(doctorRequirements(target), []);
  for (const target of ['browser', 'image']) assert.deepEqual(doctorRequirements(target), ['browser']);
  assert.deepEqual(doctorRequirements('video'), ['browser', 'ffmpeg', 'ffprobe']);
  assert.deepEqual(doctorRequirements('speech'), ['ffmpeg', 'ffprobe', 'edgeTts']);
  assert.deepEqual(doctorRequirements(undefined, true), ['browser', 'ffmpeg', 'ffprobe', 'edgeTts']);
  for (const target of ['unknown', '', '__proto__']) assert.throws(() => doctorRequirements(target), /Doctor --for/);
  assert.throws(() => doctorRequirements('html', true), /not both/);
});

test('unrelated missing speech tools are never invoked and required failures remain explicit', async () => {
  const called: Probe[] = [];
  const probes = {
    browser: async () => { called.push('browser'); },
    ffmpeg: async () => { called.push('ffmpeg'); throw new Error('missing ffmpeg fixture'); },
    ffprobe: async () => { called.push('ffprobe'); },
    edgeTts: async () => { called.push('edgeTts'); throw new Error('missing speech fixture'); },
  };
  assert.deepEqual(await probeRequirements(doctorRequirements('html'), probes), {});
  assert.equal(called.length, 0);
  assert.deepEqual(await probeRequirements(doctorRequirements('image'), probes), { browser: 'ready' });
  assert.deepEqual(called, ['browser']);
  const video = await probeRequirements(doctorRequirements('video'), probes);
  assert.equal(video.ffmpeg, 'unavailable: missing ffmpeg fixture');
  assert.equal(video.ffprobe, 'ready');
  assert.equal(video.edgeTts, undefined);
  assert.equal(called.includes('edgeTts'), false);
});
