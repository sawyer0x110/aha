import assert from 'node:assert/strict';
import { readFile, access, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { readDossier } from '../../src/research/dossier.ts';
import { checkArtifact, sourceHash } from '../../src/artifacts/project.ts';
import { checkPlan, validateVideoPlan, checkAudioTiming, subtitles } from '../../src/media/plan.ts';
import { hashValue } from '../../src/core/identity.ts';

const base = process.argv[3] ? path.resolve(process.argv[3]) : path.dirname(fileURLToPath(import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async name => JSON.parse(await readFile(path.join(base, name), 'utf8'));
const core = await readDossier(path.join(base, 'research'));
const examples = await readDossier(path.join(base, 'research-v2'));
const result = { createdAt: new Date().toISOString(), researchHashes: { core: core.manifest.contentHash, examples: examples.manifest.contentHash }, formats: {} };
for (const [format, filename] of [['html', 'index.html'], ['image', 'overview.png'], ['pptx', 'overview.pptx']]) {
  const project = path.join(base, 'projects', format);
  await checkArtifact(project);
  const receipt = await json(`${filename}.receipt.json`);
  const bytes = await readFile(path.join(base, filename));
  assert.equal(receipt.researchHash, (format === 'html' ? examples : core).manifest.contentHash);
  assert.equal(receipt.sourceHash, await sourceHash(project));
  assert.equal(receipt.output, filename);
  assert.equal(receipt.outputHash, sha(bytes));
  if (format === 'image') {
    assert.equal(bytes.readUInt32BE(16), 1080);
    assert.equal(bytes.readUInt32BE(20), 1800);
  }
  if (format === 'pptx') {
    const zip = await JSZip.loadAsync(bytes);
    const slides = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name));
    assert.equal(slides.length, 9);
    for (const file of slides) assert.match(await zip.file(file).async('string'), /<p:(sp|graphicFrame)\b/);
    const gifs = Object.keys(zip.files).filter(name => /^ppt\/media\/.*\.gif$/.test(name));
    assert.equal(gifs.length, 1);
    assert.deepEqual(await zip.file(gifs[0]).async('nodebuffer'), await readFile(path.join(base, 'projects', 'pptx', 'assets', 'motion-preview.gif')));
  }
  result.formats[format] = { researchHash: receipt.researchHash, outputHash: receipt.outputHash, sourceHash: receipt.sourceHash };
}
const videoProject = path.join(base, 'projects', 'video');
await checkArtifact(videoProject);
const plan = await validateVideoPlan(videoProject, await json('video-plan.json'));
const audio = checkAudioTiming(plan, await json('audio\\manifest.json'));
for (const segment of audio.segments) assert.equal(sha(await readFile(path.join(base, 'audio', segment.filename))), segment.sha256);
assert.equal(plan.provider, 'provided-audio');
assert.equal(audio.provider, 'provided-audio');
const originalPlan = checkPlan(await json('audio-origin\\video-plan.json'));
const originalAudio = checkAudioTiming(originalPlan, await json('audio-origin\\manifest.json'));
assert.equal(originalPlan.provider, 'edge-tts');
assert.equal(originalAudio.planHash, await hashValue(originalPlan));
assert.deepEqual(plan.segments, originalPlan.segments, 'Offline import must preserve the complete original narration.');
for (const segment of originalAudio.segments) assert.equal(sha(await readFile(path.join(base, 'audio-origin', segment.filename))), segment.sha256);
const reuse = await json('qa\\audio-reuse.json');
assert.equal(reuse.originalPlanHash, originalAudio.planHash);
assert.equal(reuse.importedPlanHash, audio.planHash);
assert.equal(reuse.checks.length, audio.segments.length);
for (const [index, check] of reuse.checks.entries()) {
  assert.equal(check.id, audio.segments[index].id);
  assert.equal(check.originalHash, originalAudio.segments[index].sha256);
  assert.equal(check.importedHash, audio.segments[index].sha256);
  assert.equal(check.originalSamplesUnchanged, true);
}
const video = await json('overview.mp4.json');
assert.equal(video.researchHash, examples.manifest.contentHash);
assert.equal(video.sourceHash, await sourceHash(videoProject));
assert.equal(video.planHash, await hashValue(plan));
assert.equal(video.audioManifestHash, await hashValue(audio));
assert.equal(video.artifactHash, sha(await readFile(path.join(base, 'overview.mp4'))));
assert.equal(video.subtitleHash, sha(await readFile(path.join(base, 'overview.mp4.srt'))));
assert.equal(await readFile(path.join(base, 'overview.mp4.srt'), 'utf8'), subtitles(plan, audio));
assert.equal(video.totalFrames, audio.segments.reduce((sum, s) => sum + s.frames, 0));
result.formats.video = { researchHash: video.researchHash, outputHash: video.artifactHash, sourceHash: video.sourceHash, seconds: video.durationSeconds, frames: video.totalFrames };
const motion = await json('motion-preview.json');
const motionProject = path.join(base, 'projects', 'motion-preview');
await checkArtifact(motionProject);
assert.equal(motion.sourceHash, await sourceHash(motionProject));
assert.equal(motion.outputHash, sha(await readFile(path.join(base, 'motion-preview.gif'))));
const runtime = await json('qa\\runtime.json');
const review = await json('qa\\review.json');
for (const format of ['html', 'image', 'video']) assert.equal(runtime.sourceHashes[format], result.formats[format].sourceHash);
assert(runtime.checks.every(check => check.passed === true));
assert.equal(runtime.checks.filter(check => check.id.startsWith('video-scene-')).length, 6);
for (const format of ['html', 'image', 'pptx', 'video']) {
  assert.equal(review[format].sourceHash, result.formats[format].sourceHash);
  assert.equal(review[format].outputHash, result.formats[format].outputHash);
}
const captions = await json('qa\\caption-layout.json');
assert.equal(captions.sourceHash, video.sourceHash);
assert.equal(captions.planHash, video.planHash);
assert.deepEqual(captions.checks.map(check => check.id), plan.segments.map(segment => segment.id));
assert(captions.checks.every(check => check.passed === true));
const playback = await json('qa\\playback.json');
assert.equal(playback.artifactHash, video.artifactHash);
assert.equal(playback.ended, true);
assert.equal(playback.error, null);
assert(Math.abs(playback.seconds - video.durationSeconds) < .1);
const timingSource = await readFile(path.join(videoProject, 'html', 'narration-timing.js'), 'utf8');
const prefix = 'window.ahaNarrationTiming = ';
assert(timingSource.startsWith(prefix) && timingSource.trimEnd().endsWith(';'));
const timing = JSON.parse(timingSource.trimEnd().slice(prefix.length, -1));
const wordEvidence = await json('qa\\word-timings.json');
const alignment = await json('qa\\alignment.json');
const cueSheet = await json('qa\\cue-sheet.json');
assert.deepEqual(cueSheet.segments, timing.segments.map(({ envelope, ...segment }) => segment));
assert.equal(alignment.sourceHash, video.sourceHash);
assert.equal(timing.fps, 30);
assert.equal(timing.segments.length, plan.segments.length);
let cueCount = 0;
for (const [index, segment] of timing.segments.entries()) {
  assert.equal(segment.id, plan.segments[index].id);
  assert.equal(segment.narration, plan.segments[index].text);
  assert.equal(segment.audioHash, originalAudio.segments[index].sha256);
  assert.equal(segment.audioHash, wordEvidence.segments[index].audioHash);
  assert.equal(segment.envelope.length, originalAudio.segments[index].frames);
  assert(segment.envelope.every(value => value >= 0 && value <= 1));
  for (const cue of segment.cues) {
    assert(wordEvidence.segments[index].words.some(word => word.word === cue.word && Math.abs(word.start - cue.wordStart) < .0001));
    const result = alignment.checks[cueCount++];
    assert.equal(result.segment, segment.id);
    assert.equal(result.word, cue.word);
    assert.equal(result.frame, cue.frame);
    assert.equal(result.property, cue.property);
    assert.equal(result.value, cue.value);
    assert.equal(result.boundaryAndReplay, true);
    assert(result.offsetSeconds >= -1e-7 && result.offsetSeconds < 1 / 30 + 1e-7);
  }
}
assert.equal(alignment.checks.length, cueCount);
const examplesEvidence = await json('qa\\example-assets.json');
assert.equal(examplesEvidence.assets.length, 7);
for (const asset of examplesEvidence.assets) {
  const bytes = await readFile(path.join(base, asset.path));
  assert.equal(sha(bytes), asset.sha256);
  assert.equal(bytes.readUInt32BE(16), asset.width);
  assert.equal(bytes.readUInt32BE(20), asset.height);
  assert.equal(asset.capture.language, 'en');
  if (!asset.crop) assert.equal(asset.sha256, asset.capture.sha256);
}
for (const filename of ['README.md', 'index.html', '..\\README.md', '..\\index.html']) {
  const full = path.join(base, filename);
  const text = await readFile(full, 'utf8');
  const links = [...text.matchAll(/\]\(([^)]+)\)|href="([^"]+)"/g)].map(match => match[1] || match[2]);
  for (const link of links) {
    if (/^(https?:|mailto:|#)/.test(link)) continue;
    await access(path.resolve(path.dirname(full), link.split('#')[0]));
  }
}
if (process.argv[2]) await writeFile(path.resolve(process.argv[2]), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ status: 'passed', ...result }));
