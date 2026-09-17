import assert from 'node:assert/strict';
import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { readDossier } from '../../src/research/dossier.ts';
import { checkArtifact, sourceHash } from '../../src/artifacts/project.ts';
import { checkPlan, validateVideoPlan, checkAudioTiming, subtitles } from '../../src/media/plan.ts';
import { audioTiming } from '../../src/media/duration.ts';
import { hashValue } from '../../src/core/identity.ts';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const topics = {
  anc: { basename: 'anc', width: 1800, height: 1200, slides: 9, frames: 3813 },
  'git-merge': { basename: 'git-merge', width: 1800, height: 1200, slides: 10, frames: 3788 },
  'project-overview': { basename: 'overview', width: 1080, height: 1800, slides: 10, frames: 4453 },
  greenland: { basename: 'greenland', formats: ['video'], frames: 3472, provider: 'edge-tts' },
  'cpython-string': { basename: 'pilot', formats: ['video'], frames: 644, provider: 'edge-tts' },
  'docker-layers': { basename: 'pilot', formats: ['video'], frames: 638, provider: 'edge-tts' },
  'aha-introduction': { basename: 'overview-v5', formats: ['video'], frames: 3582, provider: 'provided-audio' },
};
export const formatsFor = topic => topics[topic].formats ?? ['html', 'image', 'pptx', 'video'];
const multiFormatTopics = Object.keys(topics).filter(topic => formatsFor(topic).includes('html'));
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const optionalJson = async file => json(file).catch(error => {
  if (error.code !== 'ENOENT') throw error;
});
const equal = (actual, expected, label) => assert.equal(actual, expected, label);

function wavFrames(bytes) {
  equal(bytes.toString('ascii', 0, 4), 'RIFF', 'Audio must be RIFF WAV');
  equal(bytes.toString('ascii', 8, 12), 'WAVE', 'Audio must be WAV');
  equal(bytes.readUInt32LE(4) + 8, bytes.length, 'Complete WAV container');
  let format, dataSize;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const id = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    assert(start + size <= bytes.length, 'Truncated WAV chunk');
    if (id === 'fmt ') {
      assert(size >= 16);
      format = {
        codec: bytes.readUInt16LE(start), channels: bytes.readUInt16LE(start + 2),
        rate: bytes.readUInt32LE(start + 4), block: bytes.readUInt16LE(start + 12),
        bits: bytes.readUInt16LE(start + 14),
      };
    }
    if (id === 'data') { assert.equal(dataSize, undefined); dataSize = size; }
    offset = start + size + (size % 2);
  }
  assert.deepEqual(format, { codec: 1, channels: 1, rate: 48000, block: 2, bits: 16 });
  assert(dataSize > 0 && dataSize % 2 === 0, 'Audio must contain complete PCM samples');
  return audioTiming('0', dataSize / 2, '1/48000').frames;
}

export async function verifyOutput(base, entry) {
  const { topic, format } = entry;
  assert(Object.hasOwn(topics, topic), `Unknown topic: ${topic}`);
  assert(['html', 'image', 'pptx', 'video'].includes(format), `Unknown format: ${format}`);
  assert(formatsFor(topic).includes(format), `Unrequested format: ${topic}/${format}`);
  const spec = topics[topic];
  const filename = format === 'html' ? 'index.html' : `${spec.basename}.${{ image: 'png', pptx: 'pptx', video: 'mp4' }[format]}`;
  equal(entry.file, `${topic}/${filename}`, 'Canonical output path');
  equal(entry.sourceProject, `${topic}/projects/${format}`, 'Canonical source path');
  equal(entry.report, `${topic}/research/report.md`, 'Canonical report path');
  equal(entry.receipt, `${entry.file}.${format === 'video' ? 'json' : 'receipt.json'}`, 'Canonical receipt path');
  const directory = path.join(base, topic);
  const project = path.join(directory, 'projects', format);
  const dossier = await readDossier(path.join(directory, 'research'));
  assert.deepEqual(await readDossier(path.join(project, 'research')), dossier, 'Mirrored dossier must match canonical research');
  // Compare the sealed dossier files as bytes too: equal JSON values alone would permit conversion.
  for (const name of ['manifest.json', 'research.json', 'report.md']) {
    assert.deepEqual(await readFile(path.join(project, 'research', name)), await readFile(path.join(directory, 'research', name)));
  }
  await checkArtifact(project);
  const metadata = await json(path.join(project, 'artifact.json'));
  equal(metadata.format, format, 'Project format');
  const source = await sourceHash(project);
  const research = dossier.manifest.contentHash;
  const receipt = await json(path.join(base, entry.receipt));
  const bytes = await readFile(path.join(base, entry.file));
  const output = sha(bytes);
  equal(entry.bytes, bytes.length, `${entry.file}: byte count`);
  equal(entry.sha256, output, `${entry.file}: manifest output hash`);
  equal(entry.sourceHash, source, `${entry.file}: manifest source hash`);
  equal(entry.researchHash, research, `${entry.file}: manifest research hash`);
  equal(receipt.status, 'delivered', 'Receipt delivery status');
  equal(receipt.format, format === 'video' ? 'mp4' : format, 'Receipt format');
  equal(receipt.sourceHash, source, `${entry.file}: receipt source hash`);
  equal(receipt.researchHash, research, `${entry.file}: receipt research hash`);
  equal(format === 'video' ? receipt.artifactHash : receipt.outputHash, output, `${entry.file}: receipt output hash`);
  // Receipt output is the original render basename, not the subsequently published filename.
  if (format !== 'video') assert(typeof receipt.output === 'string' && receipt.output.length > 0);
  if (format === 'html') {
    equal(receipt.selfContained, true, 'Packaged HTML is self-contained');
    equal(metadata.language, 'bilingual', 'HTML language contract');
    for (const language of ['en', 'zh']) assert(bytes.includes(Buffer.from(`data-aha-lang="${language}"`)));
  }
  if (format === 'image') {
    assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    equal(bytes.readUInt32BE(16), spec.width, 'PNG width');
    equal(bytes.readUInt32BE(20), spec.height, 'PNG height');
    for (const key of ['width', 'height']) {
      equal(entry[key], spec[key], `Manifest image ${key}`);
      equal(metadata[key], spec[key], `Source image ${key}`);
      equal(receipt.browser[key], spec[key], `Receipt image ${key}`);
    }
  }
  if (format === 'pptx') {
    equal(entry.native, true, 'Native presentation');
    equal(receipt.native, true, 'Native presentation receipt');
    equal(entry.slides, spec.slides, 'Manifest slide count');
    equal(receipt.slides, spec.slides, 'Receipt slide count');
    const zip = await JSZip.loadAsync(bytes);
    const slides = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name));
    equal(slides.length, spec.slides, 'Actual slide count');
    for (const slide of slides) {
      const xml = await zip.file(slide).async('string');
      assert.match(xml, /<p:sp\b/, `${slide}: native editable shapes`);
      assert.match(xml, /<a:t>[^<]+<\/a:t>/, `${slide}: native text`);
    }
    const presentation = await zip.file('ppt/presentation.xml').async('string');
    const size = /<p:sldSz\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/.exec(presentation);
    assert(size, 'Presentation dimensions');
    assert(Math.abs(Number(size[1]) / Number(size[2]) - metadata.width / metadata.height) < 0.001, 'Presentation aspect ratio');
  }
  let plan, originalPlanHash;
  if (format === 'video') {
    plan = await validateVideoPlan(project, await json(path.join(directory, 'video-plan.json')));
    const audio = checkAudioTiming(plan, await json(path.join(directory, 'audio', 'manifest.json')));
    const provider = spec.provider ?? 'provided-audio';
    equal(plan.provider, provider, 'Expected approved speech provider');
    equal(audio.provider, provider, 'Audio provider');
    for (const segment of audio.segments) {
      const wav = await readFile(path.join(directory, 'audio', segment.filename));
      equal(sha(wav), segment.sha256, `${segment.id}: audio hash`);
      equal(wavFrames(wav), segment.frames, `${segment.id}: measured WAV frames`);
    }
    equal(receipt.planHash, await hashValue(plan), 'Video plan hash');
    equal(receipt.audioManifestHash, await hashValue(audio), 'Video audio manifest hash');
    const srt = await readFile(path.join(directory, `${filename}.srt`));
    equal(receipt.subtitleHash, sha(srt), 'Subtitle hash');
    equal(srt.toString('utf8'), subtitles(plan, audio), 'Exact approved SRT text and timing');
    const frames = audio.segments.reduce((sum, segment) => sum + segment.frames, 0);
    equal(frames, spec.frames, 'Current recording frame count');
    equal(receipt.totalFrames, frames, 'Video frames');
    equal(entry.frames, frames, 'Manifest video frames');
    equal(receipt.durationSeconds, frames / 30, 'Video duration');
    equal(entry.durationSeconds, frames / 30, 'Manifest video duration');
    equal(receipt.provider, provider, 'Receipt provider');
    equal(entry.provider, receipt.provider, 'Manifest provider');
    equal(receipt.fps, 30, 'Video frame rate');
    equal(receipt.width, 1280, 'Video width');
    equal(receipt.height, 720, 'Video height');
    equal(receipt.codec, 'h264', 'Video codec');
    if (provider === 'provided-audio') {
      const origin = path.join(directory, 'audio-origin');
      const originalPlan = checkPlan(await json(path.join(origin, 'original-plan.json')), true);
      originalPlanHash = await hashValue(originalPlan);
      equal(originalPlan.provider, 'edge-tts', 'Recorded original provider');
      equal(originalPlan.researchHash, research, 'Original narration research');
      assert.deepEqual(originalPlan.segments, plan.segments, 'Import preserves the complete approved narration');
      // Provided-audio plans use a local recording label, not the original online voice ID.
      equal(originalPlan.rate, plan.rate, 'Import preserves rate');
      const recordings = await json(path.join(origin, 'recordings.json'));
      equal(recordings.provider, originalPlan.provider, 'Original recording provider');
      equal(recordings.voice, originalPlan.voice, 'Original recording voice');
      equal(recordings.rate, originalPlan.rate, 'Original recording rate');
      assert.deepEqual(recordings.recordings, audio.segments.map(segment => ({
        id: segment.id, file: `../audio/${segment.filename}`, sha256: segment.sha256,
      })), 'Original recording references bind the same already-verified WAV bytes');
      const originalAudio = await optionalJson(path.join(origin, 'manifest.json'));
      const failure = await optionalJson(path.join(origin, 'failure.json'));
      assert(Boolean(originalAudio) !== Boolean(failure), 'Preserve either the original success manifest or failure record');
      if (originalAudio) {
        const checked = checkAudioTiming(originalPlan, originalAudio);
        assert.deepEqual(checked.segments, audio.segments, 'Original and imported audio bytes and timing');
      } else {
        equal(failure.status, 'failed', 'Original failed synthesis remains a failure');
        equal(failure.provider, originalPlan.provider, 'Failed synthesis provider');
        equal(failure.planHash, originalPlanHash, 'Failed synthesis plan identity');
        assert(frames / 30 > originalPlan.duration.maxSeconds, 'Original duration failure is not a successful render manifest');
      }
    }
  }
  return { topic, format, outputHash: output, sourceHash: source, researchHash: research, receipt, plan, originalPlanHash };
}

const xmlText = text => text.replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCodePoint(parseInt(value, 16)))
  .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const compact = text => text.replace(/\s+/g, '');

async function verifyEvidence(base, evaluation, verified) {
  const production = await json(path.join(evaluation, 'production-status.json'));
  const review = await json(path.join(evaluation, 'final-visual-review.json'));
  assert.equal(review.residual_defects.length, 0, 'Final bounded review defects');
  for (const topic of multiFormatTopics) {
    const formats = Object.fromEntries(verified.filter(item => item.topic === topic).map(item => [item.format, item]));
    const directory = path.join(evaluation, topic);
    const browser = await json(path.join(directory, 'browser-observations.json'));
    assert.deepEqual(browser.errors, []);
    assert.deepEqual(browser.blockedRequests, []);
    equal(browser.replayMatches, true, 'Sampled video replay evidence');
    for (const width of [1280, 390]) for (const language of ['en', 'zh-CN']) {
      const observations = browser.html.filter(item => item.width === width && item.language === language);
      equal(observations.length, 1, 'Bilingual viewport evidence');
      assert(observations[0].scrollWidth <= width + 1, 'Recorded HTML overflow');
    }
    assert.deepEqual(browser.scenes.map(scene => scene.id), formats.video.plan.segments.map(segment => segment.id));
    assert(browser.scenes.every(scene => scene.replayMatches && !scene.horizontalOverflow && !scene.verticalOverflow));
    const media = await json(path.join(directory, 'media-check.json'));
    equal(media.outputHash, formats.video.outputHash, 'Encoded-media evidence hash');
    equal(media.planHash, formats.video.receipt.planHash, 'Encoded-media evidence plan');
    equal(media.decodedCompletely, true, 'Recorded complete decoding');
    equal(media.subtitlesMatchApprovedText, true, 'Recorded subtitle check');
    equal(media.totalFrames, topics[topic].frames, 'Recorded decoded frame count');
    equal(media.durationSeconds, formats.video.receipt.durationSeconds, 'Recorded media duration');
    assert.deepEqual(media.samples.map(sample => sample.id), formats.video.plan.segments.map(segment => segment.id));
    assert.deepEqual(media.samples.map(sample => sample.narration), formats.video.plan.segments.map(segment => segment.text));
    equal(production.speechApproval.approvedFullOfflineImportPlans[topic], formats.video.receipt.planHash, 'Recorded approval for exact import plan');
    equal(production.speechApproval.approvedFullOnlinePlans[topic], formats.video.originalPlanHash, 'Recorded approval for original synthesis plan');
    const native = await json(path.join(directory, 'slides', 'native-observations.json'));
    equal(native.renderer, 'Microsoft PowerPoint', 'Recorded native renderer');
    equal(native.nativeTextEditInMemory, true, 'Recorded native edit probe');
    equal(native.savedChanges, false, 'Probe did not change source');
    equal(native.slides.length, topics[topic].slides, 'Native observations slide count');
    const deck = await JSZip.loadAsync(await readFile(path.join(base, topic, `${topics[topic].basename}.pptx`)));
    for (let i = 1; i <= topics[topic].slides; i++) {
      equal(native.slides[i - 1].number, i, 'Native observations slide order');
      const xml = await deck.file(`ppt/slides/slide${i}.xml`).async('string');
      const text = compact([...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(match => xmlText(match[1])).join(''));
      const shapes = native.slides[i - 1].shapes.filter(shape => shape.text?.trim());
      assert(shapes.length > 0, 'Native observations include editable text');
      for (const shape of shapes) assert(text.includes(compact(shape.text)), `${topic}/slide-${i}: observed text must belong to current native slide`);
      await access(path.join(directory, 'slides', `slide-${String(i).padStart(2, '0')}.png`));
    }
  }
  const recheckFile = path.join(evaluation, 'browser-recheck', 'runtime.json');
  const recheck = await optionalJson(recheckFile);
  if (recheck) {
    assert.deepEqual(recheck.failures, []);
    equal(recheck.cases.length, 24, 'Fresh browser coverage');
    const expected = multiFormatTopics.flatMap(topic => [1280, 390].flatMap(width =>
      ['light', 'dark'].flatMap(theme => ['en', 'zh'].map(language => `${topic}-${width}-${theme}-${language}`))));
    assert.deepEqual(recheck.cases.map(item => item.id).sort(), expected.sort(), 'Fresh browser case identities');
    for (const record of recheck.cases) {
      const html = verified.find(item => item.topic === record.topic && item.format === 'html');
      for (const key of ['sourceHash', 'outputHash', 'researchHash']) equal(record[key], html[key], `Fresh browser ${key}`);
      equal(record.checks.length, 4, 'Fresh browser checks per case');
      assert(record.checks.every(check => check.passed === true));
    }
  }
}

async function verifyGreenlandEvidence(evaluation, verified) {
  const directory = path.resolve(evaluation, '..', 'greenland-20260917');
  const video = verified.find(item => item.topic === 'greenland' && item.format === 'video');
  const publication = await json(path.join(directory, 'publication.json'));
  equal(publication.planHash, video.receipt.planHash, 'Greenland approved plan');
  equal(publication.sourceHash, video.sourceHash, 'Greenland published source');
  equal(publication.artifactHash, video.outputHash, 'Greenland published output');
  equal(publication.completeVideoListeningAndViewing, 'not-confirmed', 'Preserve full-video acceptance boundary');
  const technical = await json(path.join(directory, 'encoded', 'technical-review.json'));
  equal(technical.artifactHash, video.outputHash, 'Greenland encoded evidence');
  equal(technical.completeDecode, 'passed', 'Greenland full decode');
  equal(technical.subtitlesMatchApprovedNarration, true, 'Greenland subtitle evidence');
  equal(technical.totalFrames, topics.greenland.frames, 'Greenland encoded frame count');
  equal(technical.durationSeconds, video.receipt.durationSeconds, 'Greenland encoded duration');
  assert.deepEqual(technical.frameSamples.map(item => item.segment), video.plan.segments.map(item => item.id));
  const visual = await json(path.join(directory, 'encoded', 'encoded-visual-review.json'));
  equal(visual.artifactHashFromTechnicalReview, video.outputHash, 'Greenland visual review identity');
  equal(visual.reviewedImageCount, video.plan.segments.length, 'Greenland reviewed scenes');
  assert.deepEqual(visual.issues, []);
  assert.deepEqual(visual.frames.map(item => item.file), technical.frameSamples.map(item => item.file));
  for (const item of visual.frames) {
    equal(item.status, 'inspected', 'Greenland encoded frame reviewed');
    await access(path.join(directory, 'encoded', item.file));
  }
  const source = await json(path.join(directory, 'author', 'source-plan-consistency.json'));
  equal(source.sourceHash, video.sourceHash, 'Greenland author review source');
  equal(source.planAndPreviewNarrationIdentical, true, 'Greenland approved preview narration');
}

async function verifySealedEvidence(directory, evidence) {
  const names = evidence.map(item => item.file);
  equal(new Set(names).size, names.length, 'Unique evidence paths');
  for (const item of evidence) {
    assert(typeof item.file === 'string' && item.file.split('/').every(part => /^[a-zA-Z0-9._-]+$/.test(part) && part !== '.' && part !== '..'), 'Safe evidence path');
    equal(sha(await readFile(path.join(directory, ...item.file.split('/')))), item.sha256, `Artifact evidence hash: ${item.file}`);
  }
  return names;
}

export async function verifyCodePilotEvidence(directory, verified) {
  const publication = await json(path.join(directory, 'publication.json'));
  equal(publication.completeVideoListeningAndViewing, 'not-confirmed', 'Preserve pilot playback acceptance boundary');
  assert.deepEqual(publication.outputs.map(item => item.topic).sort(), ['cpython-string', 'docker-layers']);
  const evidenceNames = await verifySealedEvidence(directory, publication.evidence);
  for (const required of ['approvals.json', 'docker-revision-approval.json', 'preflight-visual-review.json', 'semantic-state-review.json', 'delivery.json']) {
    assert(evidenceNames.includes(required), 'Shared approvals and review limits must be hash-bound');
  }
  const approvals = await json(path.join(directory, 'approvals.json'));
  const revision = await json(path.join(directory, 'docker-revision-approval.json'));
  for (const topic of ['cpython-string', 'docker-layers']) {
    const video = verified.find(item => item.topic === topic && item.format === 'video');
    const entry = publication.outputs.find(item => item.topic === topic);
    for (const key of ['sourceHash', 'researchHash']) equal(entry[key], video[key], `Pilot publication ${key}`);
    equal(entry.sha256, video.outputHash, 'Pilot publication output');
    equal(entry.frames, topics[topic].frames, 'Pilot publication frames');
    const approval = topic === 'docker-layers' ? revision : approvals.narrationAndNetwork.plans.find(item => item.topic === topic);
    equal(approval.planHash, video.receipt.planHash, 'Exact approved pilot plan');
    equal(approval.sourceHash, video.sourceHash, 'Exact approved pilot source');
    for (const required of ['preview/report.json', 'encoded/technical-review.json', 'author-review.json']) {
      assert(evidenceNames.includes(`${topic}/${required}`), 'Required QA must be hash-bound');
    }
    const preview = await json(path.join(directory, topic, 'preview', 'report.json'));
    equal(preview.sourceHash, video.sourceHash, 'Preview source identity');
    equal(preview.planHash, video.receipt.planHash, 'Preview narration identity');
    equal(preview.researchHash, video.researchHash, 'Preview research identity');
    equal(preview.passed, true, 'Source-preview checks');
    assert.deepEqual(preview.errors, []);
    assert.deepEqual(preview.replay.map(item => item.id), video.plan.segments.map(item => item.id));
    assert(preview.replay.every(item => item.identical), 'Sampled A/B/A replay');
    assert(preview.replay.some(item => item.changed), 'Mechanism has sampled motion');
    equal(preview.captures.length, video.plan.segments.length * 5, 'Preview capture coverage');
    for (const capture of preview.captures) {
      assert.deepEqual(capture.contentOverflow, []);
      assert(capture.caption.top >= 550 && capture.caption.bottom <= 720 && !capture.caption.overflow);
      const evidence = publication.evidence.find(item => item.file === `${topic}/preview/${capture.filename}`);
      equal(evidence?.sha256, capture.sha256, 'Preview screenshot identity');
    }
    const end = id => preview.captures.find(item => item.id === id && item.label === 'end').state;
    if (topic === 'cpython-string') {
      equal(end('ascii-baseline').codePointWidthBytes, 1, 'ASCII storage');
      equal(end('whole-string-widens').codePointWidthBytes, 4, 'Non-BMP result storage');
      equal(end('whole-string-widens').originalStrIsUnchanged, true, 'Immutable original string');
      equal(end('utf8-contrast').result.utf8Bytes - end('utf8-contrast').baseline.utf8Bytes, 4, 'UTF-8 payload delta');
    } else {
      equal(end('later-delete').layerA.payloadRetainedInSeparateRunCase, true, 'Lower-layer payload retained');
      equal(end('later-delete').mergedExamplePath.absent, true, 'Deleted path absent from merged view');
      equal(end('same-run').sameRun.newFilePayloadInResultingDiff, false, 'New temporary payload omitted from final diff');
      const failure = await json(path.join(directory, topic, 'original-attempt', 'failure.json'));
      equal(failure.status, 'failed', 'Original under-duration attempt stays failed');
      assert.notEqual(failure.planHash, video.receipt.planHash, 'Do not reuse the failed attempt as current approval');
    }
    const technical = await json(path.join(directory, topic, 'encoded', 'technical-review.json'));
    equal(technical.artifactHash, video.outputHash, 'Encoded evidence identity');
    equal(technical.sourceHash, video.sourceHash, 'Encoded evidence source');
    equal(technical.planHash, video.receipt.planHash, 'Encoded evidence plan');
    equal(technical.fullDecode, true, 'Full pilot decode');
    equal(technical.exactApprovedSubtitleTextAndTiming, true, 'Exact approved pilot subtitles');
    equal(technical.frames, topics[topic].frames, 'Pilot decoded frames');
    equal(technical.seconds, video.receipt.durationSeconds, 'Pilot decoded duration');
    const expectedSamples = video.plan.segments.flatMap((segment, index) =>
      ['start', 'middle', 'end'].map(label => `${index + 1}-${segment.id}-${label}.png`));
    assert.deepEqual(technical.samples.map(item => item.filename), expectedSamples);
    for (const sample of technical.samples) {
      const evidence = publication.evidence.find(item => item.file === `${topic}/encoded/${sample.filename}`);
      equal(evidence?.sha256, sample.sha256, 'Encoded screenshot identity');
    }
  }
}

export async function verifyIntroductionEvidence(directory, verified) {
  const publication = await json(path.join(directory, 'publication.json'));
  const video = verified.find(item => item.topic === 'aha-introduction' && item.format === 'video');
  const evidence = await verifySealedEvidence(directory, publication.evidence);
  for (const name of [
    'preview/report.json', 'encoded/technical-review.json', 'encoded/visual-review.json',
    'full-v4-speech-approval.json', 'full-v5-approval.json', 'pilot-v4-playback-acceptance.json',
    'accepted-pilot/overview-pilot-v4.mp4', 'before-fix/10-same-run-middle.png',
  ]) assert(evidence.includes(name), `Required introduction evidence: ${name}`);
  equal(publication.output.sha256, video.outputHash, 'Introduction publication output');
  equal(publication.output.sourceHash, video.sourceHash, 'Introduction publication source');
  equal(publication.output.researchHash, video.researchHash, 'Introduction publication research');
  equal(publication.planHash, video.receipt.planHash, 'Introduction publication plan');
  equal(publication.originalPlanHash, video.originalPlanHash, 'Introduction original narration plan');
  equal(publication.completeVideoListeningAndViewing, 'not-confirmed', 'Do not promote pilot acceptance to full acceptance');
  const approval = await json(path.join(directory, 'full-v5-approval.json'));
  equal(approval.planHash, video.receipt.planHash, 'Approved corrected introduction plan');
  equal(approval.sourceHash, video.sourceHash, 'Approved corrected introduction source');
  equal(approval.originalPlanHash, video.originalPlanHash, 'Approved original recording source');
  const speechApproval = await json(path.join(directory, 'full-v4-speech-approval.json'));
  equal(speechApproval.planHash, video.originalPlanHash, 'Original full speech approval');
  const pilot = await json(path.join(directory, 'pilot-v4-playback-acceptance.json'));
  equal(pilot.artifactHash, sha(await readFile(path.join(directory, 'accepted-pilot', 'overview-pilot-v4.mp4'))), 'Actually accepted pilot identity');
  const preview = await json(path.join(directory, 'preview', 'report.json'));
  equal(preview.sourceHash, video.sourceHash, 'Introduction preview source');
  equal(preview.planHash, video.receipt.planHash, 'Introduction preview plan');
  equal(preview.passed, true, 'Introduction source checks');
  assert.deepEqual(preview.errors, []);
  assert.deepEqual(preview.replay.map(item => item.id), video.plan.segments.map(item => item.id));
  assert(preview.replay.every(item => item.identical), 'Introduction sampled A/B/A replay');
  equal(preview.captures.length, video.plan.segments.length * 5, 'Introduction preview coverage');
  for (const capture of preview.captures) {
    assert.deepEqual(capture.contentOverflow, []);
    assert(capture.caption.top >= 550 && capture.caption.bottom <= 720 && !capture.caption.overflow);
    equal(publication.evidence.find(item => item.file === `preview/${capture.filename}`)?.sha256, capture.sha256, 'Introduction preview image');
  }
  const opening = preview.captures.find(item => item.id === 'research-skill' && item.label === 'end');
  equal(opening.state.skills.exampleShown, false, 'Project-only opening');
  equal(opening.visibleText.filter(text => text === 'Two portable skills, coordinated by your AI host.').length, 1, 'No duplicated opening sentence');
  for (const id of ['mercator-question', 'new-string', 'layer-created']) {
    equal(preview.captures.find(item => item.id === id && item.label === 'start').state.chapterTransition.progress, 0, 'Explicit case entry');
  }
  const technical = await json(path.join(directory, 'encoded', 'technical-review.json'));
  equal(technical.artifactHash, video.outputHash, 'Introduction encoded identity');
  equal(technical.planHash, video.receipt.planHash, 'Introduction encoded plan');
  equal(technical.frames, 3582, 'Introduction encoded frames');
  equal(technical.fullDecode, true, 'Introduction full decode');
  equal(technical.exactApprovedSubtitleTextAndTiming, true, 'Introduction exact approved captions');
  assert.deepEqual(technical.samples.map(item => item.filename), video.plan.segments.flatMap((segment, index) =>
    ['start', 'middle', 'end'].map(label => `${index + 1}-${segment.id}-${label}.png`)));
  for (const sample of technical.samples) {
    equal(publication.evidence.find(item => item.file === `encoded/${sample.filename}`)?.sha256, sample.sha256, 'Introduction encoded sample');
  }
  const visual = await json(path.join(directory, 'encoded', 'visual-review.json'));
  equal(visual.artifactHash, video.outputHash, 'Introduction actual visual review identity');
  equal(visual.dockerConnectorFix, 'confirmed-in-actual-encoded-frame', 'Actual connector fix review');
}

export async function verifyExamples({
  base = path.join(root, 'examples'),
  evaluation = path.join(root, 'evals', 'examples', 'refresh-20260916'),
  manifest,
} = {}) {
  manifest ??= await json(path.join(base, 'delivery-manifest.json'));
  const expectedOutputs = Object.keys(topics).flatMap(topic => formatsFor(topic).map(format => `${topic}/${format}`));
  assert.equal(manifest.requestedOutputs.length, expectedOutputs.length, 'Exactly sixteen requested outputs');
  assert.deepEqual(manifest.requestedOutputs.map(item => `${item.topic}/${item.format}`).sort(),
    expectedOutputs.sort());
  const verified = [];
  for (const entry of manifest.requestedOutputs) verified.push(await verifyOutput(base, entry));
  await verifyEvidence(base, evaluation, verified);
  await verifyGreenlandEvidence(evaluation, verified);
  equal(manifest.codePilotEvaluation, '../evals/examples/code-pilots-20260917/publication.json', 'Canonical code-pilot evidence link');
  await verifyCodePilotEvidence(path.resolve(evaluation, '..', 'code-pilots-20260917'), verified);
  equal(manifest.ahaIntroductionEvaluation, '../evals/examples/aha-introduction-20260917/publication.json', 'Canonical introduction evidence link');
  await verifyIntroductionEvidence(path.resolve(evaluation, '..', 'aha-introduction-20260917'), verified);
  if (manifest.optionalNativeMotion) {
    const motion = manifest.optionalNativeMotion;
    equal(motion.file, 'git-merge/git-merge-animated.pptx', 'Optional motion path');
    equal(motion.audit, `${motion.file}.motion-review.json`, 'Separate motion audit');
    const audit = await json(path.join(base, motion.audit));
    equal(audit.kind, 'native-motion-postprocess-not-aha-render-receipt', 'Motion is not a render receipt');
    equal(motion.kind, audit.kind, 'Motion manifest kind');
    equal(audit.inputSha256, verified.find(item => item.topic === 'git-merge' && item.format === 'pptx').outputHash, 'Motion base deck');
    equal(audit.outputSha256, sha(await readFile(path.join(base, motion.file))), 'Motion output bytes');
    equal(motion.sha256, audit.outputSha256, 'Motion manifest hash');
    assert.match(motion.slideshowPlayback, /not (completed|verified)|unverified/i, 'No slideshow acceptance claim');
    const original = await JSZip.loadAsync(await readFile(path.join(base, 'git-merge', 'git-merge.pptx')));
    const animated = await JSZip.loadAsync(await readFile(path.join(base, motion.file)));
    assert.deepEqual(Object.keys(animated.files).sort(), Object.keys(original.files).sort(), 'Motion ZIP parts');
    const modified = new Set(audit.modified.map(item => item.slide));
    assert(modified.size > 0, 'Motion audit lists changed slides');
    for (const name of Object.keys(original.files)) {
      if (modified.has(name)) {
        const xml = await animated.file(name).async('string');
        assert.match(xml, /<p:timing\b/, 'Audited native timing');
        assert.match(xml, /<p:animMotion\b/, 'Audited native motion');
      } else if (!original.files[name].dir) {
        assert.deepEqual(await animated.file(name).async('nodebuffer'), await original.file(name).async('nodebuffer'), `${name}: unaudited motion changes`);
      }
    }
  }
  return {
    status: 'passed', outputs: verified.map(({ receipt, plan, ...item }) => item),
    scope: 'Current sealed provenance, native structure, WAV timing and exact subtitles; no authored code executed. Imported browser/native observations are bounded historical evidence, not a new visual, listening, slideshow or comprehension review.',
  };
}

export async function main(args = process.argv.slice(2)) {
  assert(args.length <= 1, 'Usage: node --import tsx evals/examples/verify.mjs [new-report.json]');
  const result = await verifyExamples();
  if (args[0]) await writeFile(path.resolve(root, args[0]), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main();
