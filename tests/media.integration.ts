import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildDossier, createResearchDraft, writeDossier } from '../src/research/dossier.js';
import { initArtifact } from '../src/artifacts/project.js';
import { prepareHtml } from '../src/artifacts/html.js';
import { approvePlan, prepareVideoPlan, validateVideoPlan, type VideoPlan } from '../src/media/plan.js';
import { fileHash, importAudio, readAudio } from '../src/media/audio.js';
import { createFrameRenderer, openBrowser } from '../src/media/browser.js';
import { renderVideo } from '../src/media/video.js';
import { hashValue } from '../src/core/identity.js';
import { runTool, ffmpeg } from '../src/media/process.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = `<!doctype html><html><head><style>
html,body{margin:0;width:1280px;height:720px;background:#17243a}
#dot{position:absolute;top:220px;width:160px;height:160px;background:#38e6b5}
</style></head><body><div id="dot"></div><script>
window.ahaVideo={async renderFrame({frame}) {
document.getElementById('dot').style.left=(50+frame*20)+'px';
}};</script></body></html>`;

async function fixture(directory: string): Promise<string> {
  const draft = createResearchDraft('Does the fixture move?', 'provided');
  draft.status = 'complete';
  draft.report = 'The synthetic fixture moves a square by frame number. This tests rendering, not research truth.';
  draft.stopReason = 'The supplied fixture suffices for this bounded pipeline test.';
  draft.claims = [{ id: 'Claim_1', text: 'The square moves by frame number.', evidenceIds: ['e1'], limitations: ['Synthetic test only.'] }];
  draft.evidence = [{
    id: 'e1', kind: 'provided', title: 'Synthetic fixture source', locator: 'tests/media.integration.ts',
    summary: 'Explicit frame position changes.', sourceVersion: 'fixture-v1',
  }];
  draft.subquestions = [{ id: 'q1', question: draft.question, status: 'answered', claimIds: ['Claim_1'], gapIds: [] }];
  await writeDossier(path.join(directory, 'research'), await buildDossier(draft));
  const project = path.join(directory, 'project');
  await initArtifact(path.join(directory, 'research'), 'video', project);
  const metadata = JSON.parse(await fs.readFile(path.join(project, 'artifact.json'), 'utf8'));
  metadata.status = 'authored';
  metadata.coverage = [{ id: 'motion', claimIds: ['Claim_1'] }];
  await fs.writeFile(path.join(project, 'artifact.json'), JSON.stringify(metadata));
  await fs.writeFile(path.join(project, 'html', 'index.html'), source);
  return project;
}

test('Python adapter passes only the approved narration request to an offline stub', async () => {
  const dir = await fs.mkdtemp(path.resolve('.aha-edge-adapter-'));
  try {
    const request = path.join(dir, 'request.json');
    const output = path.join(dir, 'result.json');
    await fs.writeFile(request, JSON.stringify({ text: 'approved fixture', voice: 'zh-CN-XiaoxiaoNeural', rate: '+0%' }));
    const result = spawnSync(process.env.AHA_PYTHON ?? 'python', [
      path.join(root, 'src', 'media', 'edge_speech.py'), request, output,
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

test('representative source frames change, replay identically, and hostile subtitle markup is inert', async () => {
  const browser = await openBrowser();
  try {
    const renderer = await createFrameRenderer(source, browser);
    try {
      const input = { frame: 0, fps: 30, segmentIndex: 0, segmentFrame: 0, segmentFrames: 30, text: '<script>throw Error("not text")</script>' };
      const first = await renderer.render(input, true);
      const middle = await renderer.render({ ...input, frame: 15, segmentFrame: 15 }, true);
      const replay = await renderer.render(input, true);
      assert.notEqual(first.visualHash, middle.visualHash);
      assert.equal(first.visualHash, replay.visualHash);
      assert.equal(first.png.readUInt32BE(16), 1280);
      assert.equal(first.png.readUInt32BE(20), 720);
    } finally { await renderer.close(); }
    const broken = source.replace("document.getElementById('dot').style.left=(50+frame*20)+'px';", 'throw new Error("private script error");');
    const renderer2 = await createFrameRenderer(broken, browser);
    try {
      await assert.rejects(renderer2.render({ frame: 0, fps: 30, segmentIndex: 0, segmentFrame: 0, segmentFrames: 30, text: 'Fixture.' }));
    } finally { await renderer2.close(); }
    const staticRenderer = await createFrameRenderer(source.replace("(50+frame*20)", '50'), browser);
    try {
      const input = { frame: 0, fps: 30, segmentIndex: 0, segmentFrame: 0, segmentFrames: 30, text: 'Static fixture.' };
      const first = await staticRenderer.render(input, true);
      const later = await staticRenderer.render({ ...input, frame: 15, segmentFrame: 15 }, true);
      assert.equal(first.visualHash, later.visualHash, 'Function presence alone is not visual-change evidence.');
    } finally { await staticRenderer.close(); }
    const networkRenderer = await createFrameRenderer(source.replace("document.getElementById('dot').style.left=(50+frame*20)+'px';",
      'await fetch("https://example.invalid/never-request").catch(()=>{});'), browser);
    try {
      await assert.rejects(networkRenderer.render({ frame: 0, fps: 30, segmentIndex: 0, segmentFrame: 0, segmentFrames: 30, text: 'Offline fixture.' }),
        { code: 'MEDIA_PAGE_ERROR' });
    } finally { await networkRenderer.close(); }
  } finally { await browser.close(); }
});

test('deferred packaged video scripts initialize in the offline frame renderer', async () => {
  const dir = await fs.mkdtemp(path.resolve('.aha-media-deferred-'));
  let browser: Awaited<ReturnType<typeof openBrowser>> | undefined;
  try {
    const project = await fixture(dir);
    const script = source.match(/<script>([\s\S]*)<\/script>/)![1]!;
    await fs.writeFile(path.join(project, 'html', 'animation.js'), script);
    await fs.writeFile(path.join(project, 'html', 'index.html'),
      source.replace(/<script>[\s\S]*<\/script>/, '').replace('</head>', '<script defer src="animation.js"></script></head>'));
    browser = await openBrowser();
    const renderer = await createFrameRenderer(await prepareHtml(project), browser);
    try {
      const result = await renderer.render({ frame: 0, fps: 30, segmentIndex: 0, segmentFrame: 0, segmentFrames: 2, text: 'Fixture.' });
      assert.equal(result.png.readUInt32BE(16), 1280);
    } finally { await renderer.close(); }
  } finally {
    await browser?.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('offline authored video uses measured synthetic audio and publishes verified transactional outputs', async () => {
  const dir = await fs.mkdtemp(path.resolve('.aha-media-integration-'));
  try {
    const project = await fixture(dir);
    const plan = await prepareVideoPlan(project);
    assert.equal(plan.status, 'draft');
    await assert.rejects(approvePlan(plan, await hashValue(plan)), { code: 'NARRATION_DRAFT' });
    plan.status = 'authored';
    plan.provider = 'provided-audio';
    plan.voice = 'user-provided';
    plan.duration = { minSeconds: 1, maxSeconds: 2 };
    plan.segments[0]!.text = 'Synthetic test audio, not generated speech.';
    await validateVideoPlan(project, plan);
    await assert.rejects(validateVideoPlan(project, { ...plan, segments: [{ ...plan.segments[0], claimIds: ['missing'] }] }), { code: 'VIDEO_CLAIM' });
    await assert.rejects(validateVideoPlan(project, { ...plan, segments: [{ ...plan.segments[0], claimIds: [] }] }), { code: 'VIDEO_CLAIM' });
    await runTool(ffmpeg(), ['-v', 'error', '-nostdin', '-n', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
      '-ac', '1', '-ar', '48000', path.join(dir, 'fixture.wav')]);
    const audioDir = path.join(dir, 'audio');
    await importAudio(plan, { segments: [{ id: plan.segments[0]!.id, file: 'fixture.wav' }] }, dir, audioDir);
    await assert.rejects(readAudio({ ...plan, rate: '+1%' }, audioDir), { code: 'AUDIO_PLAN_MISMATCH' });
    const manifestFile = path.join(audioDir, 'manifest.json');
    const manifestText = await fs.readFile(manifestFile, 'utf8');
    const mistimed = JSON.parse(manifestText);
    mistimed.segments[0].frames = 31;
    await fs.writeFile(manifestFile, JSON.stringify(mistimed));
    await assert.rejects(readAudio(plan, audioDir), { code: 'AUDIO_TIMING' });
    await fs.writeFile(manifestFile, manifestText);
    await assert.rejects(renderVideo(project, plan, audioDir, path.join(dir, 'no-code.mp4'), false), { code: 'AUTHOR_CODE_PERMISSION' });
    const output = path.join(dir, 'test.mp4');
    const receipt = await renderVideo(project, plan, audioDir, output, true) as Record<string, unknown>;
    const { version } = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
    assert.equal(receipt.rendererVersion, version);
    assert.equal(receipt.output, output);
    assert.equal(receipt.provider, 'provided-audio');
    assert.equal(receipt.totalFrames, 30);
    assert.equal(receipt.durationSeconds, 1);
    assert.equal(receipt.codec, 'h264');
    assert.equal(receipt.sampledVisualChange, true);
    assert.equal(receipt.artifactHash, await fileHash(output));
    assert.match(await fs.readFile(`${output}.srt`, 'utf8'), /00:00:01,000/);
    assert.equal(JSON.parse(await fs.readFile(`${output}.receipt.json`, 'utf8')).status, 'delivered');
    assert.equal(JSON.parse(await fs.readFile(`${output}.receipt.json`, 'utf8')).output, 'test.mp4');
    assert.equal(JSON.parse(await fs.readFile(`${output}.receipt.json`, 'utf8')).rendererVersion, version);
    await assert.rejects(renderVideo(project, plan, audioDir, output, true), { code: 'OUTPUT_EXISTS' });
    await fs.appendFile(path.join(project, 'html', 'index.html'), '\n<!-- visual revision -->');
    await assert.rejects(renderVideo(project, plan, audioDir, path.join(dir, 'stale.mp4'), true), { code: 'VIDEO_SOURCE_MISMATCH' });
    await assert.rejects(fs.stat(path.join(dir, 'stale.mp4')));
    const refreshed = await prepareVideoPlan(project);
    refreshed.status = 'authored';
    refreshed.provider = 'provided-audio';
    refreshed.voice = plan.voice;
    refreshed.duration = plan.duration;
    refreshed.segments = plan.segments;
    await approvePlan(refreshed, await hashValue(refreshed));
    const reusedDirectory = path.join(dir, 'reused-audio');
    await importAudio(refreshed, { segments: [{ id: refreshed.segments[0]!.id, file: path.join('audio', 'segment-001.wav') }] }, dir, reusedDirectory);
    assert.equal((await readAudio(refreshed, reusedDirectory)).planHash, await hashValue(refreshed));
    await fs.writeFile(path.join(project, 'html', 'index.html'), source);
    await fs.appendFile(path.join(audioDir, 'segment-001.wav'), 'changed');
    await assert.rejects(renderVideo(project, plan, audioDir, path.join(dir, 'tampered.mp4'), true), { code: 'AUDIO_HASH_MISMATCH' });
    await assert.rejects(fs.stat(path.join(dir, 'tampered.mp4')));
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('exact audio frame boundaries survive import, tight duration limits and normalized reimport', async () => {
  const dir = await fs.mkdtemp(path.resolve('.aha-audio-timing-'));
  try {
    for (const [samples, expectedFrames] of [[3200, 2], [3201, 3], [32000, 20]] as const) {
      const wav = Buffer.alloc(44 + samples * 2);
      wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
      wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
      wav.writeUInt32LE(48000, 24); wav.writeUInt32LE(96000, 28); wav.writeUInt16LE(2, 32);
      wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
      const file = `input-${samples}.wav`;
      await fs.writeFile(path.join(dir, file), wav);
      const plan: VideoPlan = {
        schemaVersion: '1.0.0', status: 'authored', researchHash: '1'.repeat(64), sourceHash: '2'.repeat(64),
        provider: 'provided-audio', voice: 'user-provided', rate: '+0%',
        duration: { minSeconds: expectedFrames / 30, maxSeconds: expectedFrames / 30 },
        segments: [{ id: 'sentence-1', text: 'Synthetic sample-count test.', claimIds: [] }],
      };
      const audioDir = path.join(dir, `audio-${samples}`);
      const audio = await importAudio(plan, { segments: [{ id: 'sentence-1', file }] }, dir, audioDir);
      assert.equal(audio.segments[0]!.frames, expectedFrames);
      assert.equal((await readAudio(plan, audioDir)).segments[0]!.frames, expectedFrames);
      const reimported = await importAudio(plan, {
        segments: [{ id: 'sentence-1', file: path.join(audioDir, 'segment-001.wav') }],
      }, dir, path.join(dir, `reimport-${samples}`));
      assert.equal(reimported.segments[0]!.frames, expectedFrames);
      if (samples === 3201) {
        await assert.rejects(importAudio({ ...plan, duration: { minSeconds: 1 / 30, maxSeconds: 2 / 30 } },
          { segments: [{ id: 'sentence-1', file }] }, dir, path.join(dir, 'too-short')), { code: 'VIDEO_DURATION_RANGE' });
        await assert.rejects(fs.stat(path.join(dir, 'too-short')));
      }
    }
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('a failed authored render leaves a failure receipt but no successful movie or sidecars', async () => {
  const dir = await fs.mkdtemp(path.resolve('.aha-media-failure-'));
  try {
    const project = await fixture(dir);
    await fs.writeFile(path.join(project, 'html', 'index.html'), source.replace("document.getElementById('dot').style.left=(50+frame*20)+'px';", 'throw Error("private");'));
    const plan = await prepareVideoPlan(project);
    plan.status = 'authored';
    plan.provider = 'provided-audio';
    plan.voice = 'user-provided';
    plan.duration = { minSeconds: 1, maxSeconds: 2 };
    await runTool(ffmpeg(), ['-v', 'error', '-nostdin', '-n', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', path.join(dir, 'fixture.wav')]);
    await importAudio(plan, { segments: [{ id: plan.segments[0]!.id, file: 'fixture.wav' }] }, dir, path.join(dir, 'audio'));
    const output = path.join(dir, 'failed.mp4');
    await assert.rejects(renderVideo(project, plan, path.join(dir, 'audio'), output, true));
    for (const file of [output, `${output}.srt`, `${output}.receipt.json`]) await assert.rejects(fs.stat(file));
    const failure = await fs.readFile(`${output}.failure.json`, 'utf8');
    assert.equal(JSON.parse(failure).status, 'failed');
    assert.ok(!failure.includes('private'));
    assert.ok(!(await fs.readdir(dir)).some(name => name.startsWith('.aha-video-')));
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
