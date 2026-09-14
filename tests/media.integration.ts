import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runTool, ffmpeg } from '../src/media/process.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(root, 'dist', 'cli', 'aha.mjs');
test('packaged Python adapter does not shadow edge_tts and passes only the narration request', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aha-edge-adapter-'));
  try {
    const request = path.join(dir, 'request.json');
    const output = path.join(dir, 'result.json');
    await fs.writeFile(request, JSON.stringify({ text: 'approved fixture', voice: 'zh-CN-XiaoxiaoNeural', rate: '+0%' }));
    const result = spawnSync(process.env.AHA_PYTHON ?? 'python', [
      path.join(root, 'dist', 'assets', 'media', 'edge_speech.py'), request, output,
    ], { env: { ...process.env, PYTHONPATH: path.join(root, 'tests', 'fixtures') }, encoding: 'utf8', timeout: 30000 });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(await fs.readFile(output, 'utf8'));
    assert.deepEqual(Object.keys(payload).sort(), ['options', 'text', 'voice']);
    assert.equal(payload.text, 'approved fixture');
    assert.equal(payload.options.rate, '+0%');
    assert.equal(payload.options.connect_timeout, 15);
    assert.equal(payload.options.receive_timeout, 45);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

function invoke(cwd: string, args: string[], status = 0, entry = cli) {
  const result = spawnSync(process.execPath, [entry, ...args], { cwd, encoding: 'utf8', timeout: 180000 });
  if (result.error) throw result.error;
  assert.equal(result.status, status, `${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

test('actual offline PNG and H.264/AAC workflow preserves speech approval, timing and identity', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aha-media-integration-'));
  try {
    invoke(dir, ['example', 'compound', 'topic.aha']);
    invoke(dir, ['render-image', 'topic.aha', 'card.png']);
    const png = await fs.readFile(path.join(dir, 'card.png'));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), 1080);
    assert.ok(png.readUInt32BE(20) <= 2400);
    invoke(dir, ['prepare-video', 'topic.aha', 'plan.json']);
    const plan = JSON.parse(await fs.readFile(path.join(dir, 'plan.json'), 'utf8'));
    plan.duration = { minSeconds: 5, maxSeconds: 7 };
    plan.segments = [plan.segments.find((segment: { text: string }) => segment.text.includes('10800.00'))];
    plan.segments[0].text = 'Offline synthetic tone fixture, not generated speech.';
    await fs.writeFile(path.join(dir, 'plan.json'), JSON.stringify(plan));
    const approved = invoke(dir, ['video-plan-check', 'topic.aha', 'plan.json']).planHash;
    await runTool(ffmpeg(), [
      '-v', 'error', '-nostdin', '-n', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6',
      '-ac', '1', '-ar', '48000', path.join(dir, 'fixture.wav'),
    ]);
    await fs.writeFile(path.join(dir, 'audio-files.json'), JSON.stringify({
      segments: [{ id: plan.segments[0].id, file: 'fixture.wav' }],
    }));
    invoke(dir, ['import-audio', 'topic.aha', 'plan.json', 'audio-files.json', 'audio', '--approve', approved]);
    assert.equal(invoke(dir, ['render-video', 'topic.aha', 'plan.json', 'audio', 'rejected.mp4', '--approve', 'bad'], 1).error.code, 'NARRATION_APPROVAL_REQUIRED');
    const receipt = invoke(dir, ['render-video', 'topic.aha', 'plan.json', 'audio', 'test.mp4', '--approve', approved]);
    assert.equal(receipt.provider, 'provided-audio');
    assert.equal(receipt.totalFrames, 180);
    assert.equal(receipt.durationSeconds, 6);
    assert.equal(receipt.codec, 'h264');
    assert.equal(receipt.subtitles, 'sentence-level-burned-and-srt');
    assert.match(await fs.readFile(path.join(dir, 'test.mp4.srt'), 'utf8'), /00:00:06,000/);
    assert.equal(invoke(dir, ['render-video', 'topic.aha', 'plan.json', 'audio', 'test.mp4', '--approve', approved], 1).error.code, 'OUTPUT_EXISTS');
    await fs.appendFile(path.join(dir, 'audio', 'segment-001.wav'), Buffer.from('changed'));
    assert.equal(invoke(dir, ['render-video', 'topic.aha', 'plan.json', 'audio', 'tampered.mp4', '--approve', approved], 1).error.code, 'AUDIO_HASH_MISMATCH');
    await assert.rejects(fs.stat(path.join(dir, 'tampered.mp4')));
    const isolated = path.join(dir, 'isolated-skill');
    await fs.cp(path.join(root, 'dist', 'skills', 'aha-story'), isolated, { recursive: true });
    invoke(dir, ['render-image', 'topic.aha', 'isolated.png'], 0, path.join(isolated, 'scripts', 'aha.mjs'));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
