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
};
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
    equal(plan.provider, 'provided-audio', 'Approved import-only plan');
    equal(audio.provider, 'provided-audio', 'Imported recording');
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
    equal(receipt.provider, 'provided-audio', 'Receipt provider');
    equal(entry.provider, receipt.provider, 'Manifest provider');
    equal(receipt.fps, 30, 'Video frame rate');
    equal(receipt.width, 1280, 'Video width');
    equal(receipt.height, 720, 'Video height');
    equal(receipt.codec, 'h264', 'Video codec');
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
  for (const topic of Object.keys(topics)) {
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
    const expected = Object.keys(topics).flatMap(topic => [1280, 390].flatMap(width =>
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

export async function verifyExamples({
  base = path.join(root, 'examples'),
  evaluation = path.join(root, 'evals', 'examples', 'refresh-20260916'),
  manifest,
} = {}) {
  manifest ??= await json(path.join(base, 'delivery-manifest.json'));
  assert.equal(manifest.requestedOutputs.length, 12, 'Exactly twelve requested outputs');
  assert.deepEqual(manifest.requestedOutputs.map(item => `${item.topic}/${item.format}`).sort(),
    Object.keys(topics).flatMap(topic => ['html', 'image', 'pptx', 'video'].map(format => `${topic}/${format}`)).sort());
  const verified = [];
  for (const entry of manifest.requestedOutputs) verified.push(await verifyOutput(base, entry));
  await verifyEvidence(base, evaluation, verified);
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
