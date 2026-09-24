import assert from 'node:assert/strict';
import { readFile, writeFile, access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { SaxesParser } from 'saxes';
import { readDossier } from '../../src/research/dossier.ts';
import { checkArtifact, sourceHash } from '../../src/artifacts/project.ts';
import { validatePptx } from '../../src/artifacts/pptx-validation.ts';
import { validateVideoPlan, checkAudioTiming, subtitles } from '../../src/media/plan.ts';
import { audioTiming } from '../../src/media/duration.ts';
import { hashValue } from '../../src/core/identity.ts';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const topics = {
  anc: { width: 1800, height: 1600, slides: 7, frames: 2356, provider: 'provided-audio' },
  greenland: { width: 1800, height: 1600, slides: 7, frames: 2424, provider: 'provided-audio' },
  'cpython-string': { width: 1800, height: 1600, slides: 7, frames: 1897, provider: 'provided-audio' },
  'docker-layers': { width: 1800, height: 1600, slides: 7, frames: 1749, provider: 'provided-audio' },
  'aha-introduction': { width: 1080, height: 1920, slides: 8, videoFrames: { en: 4636, zh: 4532 }, provider: 'provided-audio' },
};
export const formatsFor = topic => topics[topic].formats ?? ['html', 'image', 'pptx', 'video'];
export const outputVariantsFor = topic => formatsFor(topic).flatMap(format =>
  topic === 'aha-introduction' && format === 'video'
    ? ['en', 'zh'].map(language => ({ topic, format, language }))
    : [{ topic, format }]);
const outputKey = entry => `${entry.topic}/${entry.format}${entry.topic === 'aha-introduction' && entry.format === 'video' ? `/${entry.language}` : ''}`;
export function layoutFor({ topic, format, language }) {
  const variant = topic === 'aha-introduction' && format === 'video';
  if (variant) assert(['en', 'zh'].includes(language), 'Introduction video language must be en or zh');
  const suffix = variant ? `/${language}` : '';
  return {
    file: `${topic}/${topic}${variant ? `.${language}` : ''}.${{ html: 'html', image: 'png', pptx: 'pptx', video: 'mp4' }[format]}`,
    project: `${topic}/projects/${format}${suffix}`,
    qa: `${topic}/qa/${format}${suffix}`,
    research: `${topic}/research${variant ? '-video' : ''}`,
    plan: variant ? `${topic}/video-plans/${language}.json` : `${topic}/video-plan.json`,
    audio: `${topic}/audio${suffix}`,
  };
}
const pptxTopics = Object.keys(topics).filter(topic => formatsFor(topic).includes('pptx'));
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
// PowerShell 5.1 emits a UTF-8 BOM; strip it only for parsing, never for byte hashing.
const json = async file => JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
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
  const layout = layoutFor(entry);
  const filename = path.posix.basename(layout.file);
  equal(entry.file, layout.file, 'Canonical output path');
  equal(entry.sourceProject, layout.project, 'Canonical source path');
  equal(entry.report, `${layout.research}/report.md`, 'Canonical report path');
  equal(entry.receipt, `${entry.file}.receipt.json`, 'Canonical receipt path');
  const directory = path.join(base, topic);
  const project = path.join(base, layout.project);
  const dossier = await readDossier(path.join(base, layout.research));
  assert.deepEqual(await readDossier(path.join(project, 'research')), dossier, 'Mirrored dossier must match canonical research');
  // Compare the sealed dossier files as bytes too: equal JSON values alone would permit conversion.
  for (const name of ['manifest.json', 'research.json', 'report.md']) {
    assert.deepEqual(await readFile(path.join(project, 'research', name)), await readFile(path.join(base, layout.research, name)));
  }
  await checkArtifact(project);
  const metadata = await json(path.join(project, 'artifact.json'));
  equal(metadata.format, format, 'Project format');
  const source = await sourceHash(project);
  const research = dossier.manifest.contentHash;
  const receiptBytes = await readFile(path.join(base, entry.receipt));
  const receipt = JSON.parse(receiptBytes.toString('utf8').replace(/^\uFEFF/, ''));
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
  equal(receipt.output, filename, 'Receipt names the current output');
  if (format === 'html') {
    equal(receipt.selfContained, true, 'Packaged HTML is self-contained');
    const language = spec.htmlLanguage ?? 'bilingual';
    equal(metadata.language, language, 'HTML language contract');
    if (language === 'bilingual') {
      for (const branch of ['en', 'zh']) assert(bytes.includes(Buffer.from(`data-aha-lang="${branch}"`)));
    } else {
      equal(entry.language, language, 'Chinese HTML manifest language');
      assert.match(bytes.toString('utf8'), /<html\b[^>]*lang="zh-CN"/, 'Chinese HTML document language');
    }
    if (topic === 'aha-introduction') equal(entry.language, 'bilingual', 'Introduction HTML manifest language');
  }
  if (format === 'image') {
    if (topic === 'aha-introduction') {
      equal(metadata.language, 'zh', 'Introduction image source language');
      equal(entry.language, 'zh', 'Introduction image manifest language');
    }
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
    equal(metadata.language, 'zh', 'Presentation source language');
    equal(entry.language, 'zh', 'Presentation manifest language');
    equal(entry.native, true, 'Native presentation');
    equal(receipt.native, true, 'Native presentation receipt');
    equal(entry.slides, spec.slides, 'Manifest slide count');
    equal(receipt.slides, spec.slides, 'Receipt slide count');
    equal(await validatePptx(bytes), spec.slides, 'Runtime-validated native slide count');
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
  let plan, recordingPlanHash, recordingPlanHashes, recordings;
  if (format === 'video') {
    if (topic === 'aha-introduction') {
      equal(metadata.language, entry.language, 'Video source language');
      equal(entry.videoPlan, layout.plan, 'Canonical video plan path');
      equal(entry.audioDirectory, layout.audio, 'Canonical audio directory');
    }
    plan = await validateVideoPlan(project, await json(path.join(base, layout.plan)));
    const audio = checkAudioTiming(plan, await json(path.join(base, layout.audio, 'manifest.json')));
    const provider = spec.provider ?? 'provided-audio';
    equal(plan.provider, provider, 'Expected approved speech provider');
    equal(audio.provider, provider, 'Audio provider');
    for (const segment of audio.segments) {
      const wav = await readFile(path.join(base, layout.audio, segment.filename));
      equal(sha(wav), segment.sha256, `${segment.id}: audio hash`);
      equal(wavFrames(wav), segment.frames, `${segment.id}: measured WAV frames`);
    }
    equal(receipt.planHash, await hashValue(plan), 'Video plan hash');
    equal(receipt.audioManifestHash, await hashValue(audio), 'Video audio manifest hash');
    const srt = await readFile(path.join(directory, `${filename}.srt`));
    equal(receipt.subtitleHash, sha(srt), 'Subtitle hash');
    equal(srt.toString('utf8'), subtitles(plan, audio), 'Exact approved SRT text and timing');
    const frames = audio.segments.reduce((sum, segment) => sum + segment.frames, 0);
    equal(frames, spec.videoFrames?.[entry.language] ?? spec.frames, 'Current recording frame count');
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
      const provenance = await json(path.join(base, layout.audio, 'provenance.json'));
      equal(provenance.provider, 'edge-tts', 'Recording provider, not the current import provider');
      equal(provenance.voice, topic === 'aha-introduction'
        ? entry.language === 'zh' ? 'zh-CN-XiaoxiaoNeural' : 'en-US-AriaNeural'
        : 'en-US-JennyNeural', 'Recorded speech voice');
      equal(provenance.rate, plan.rate, 'Recording rate');
      assert.deepEqual(provenance.narration, plan.segments.map(({ id, text }) => ({ id, text })),
        'Imported recordings preserve the approved spoken words and order');
      if (topic === 'aha-introduction') {
        equal(provenance.schemaVersion, 2, 'Per-segment recording provenance schema');
        equal(provenance.importedPlanHash, receipt.planHash, 'Current import provenance');
        equal(provenance.recordings.length, audio.segments.length, 'Complete recording provenance');
        for (const [index, segment] of audio.segments.entries()) {
          const recording = provenance.recordings[index];
          hash(recording.recordingPlanHash, 'Original recording plan identity');
          assert.deepEqual(recording, { id: segment.id, file: segment.filename, sha256: segment.sha256,
            frames: segment.frames, recordingPlanHash: recording.recordingPlanHash }, 'Current recording identity');
        }
        recordingPlanHashes = [...new Set(provenance.recordings.map(item => item.recordingPlanHash))].sort();
        assert.deepEqual(provenance.recordingPlanHashes, recordingPlanHashes, 'Exact original recording plans');
        recordings = provenance.recordings;
      } else {
        hash(provenance.recordingPlanHash, 'Recording plan identity');
        recordingPlanHash = provenance.recordingPlanHash;
        assert.deepEqual(provenance.recordings, audio.segments.map(segment => ({
          id: segment.id, file: segment.filename, sha256: segment.sha256,
        })), 'Recording provenance binds the current WAV bytes');
      }
    }
  }
  equal(entry.receiptHash, sha(receiptBytes), 'Manifest receipt hash');
  return { topic, format, language: entry.language, file: entry.file, outputHash: output, sourceHash: source, researchHash: research,
    receiptHash: sha(receiptBytes), receipt, plan, recordingPlanHash, recordingPlanHashes, recordings };
}

const compact = text => text.replace(/\s+/g, '');

function xmlTree(xml) {
  const parser = new SaxesParser({ xmlns: true });
  const stack = [];
  let root;
  parser.on('error', error => { throw error; });
  parser.on('doctype', () => assert.fail('No DOCTYPE in native evidence XML'));
  parser.on('opentag', tag => {
    const node = { name: tag.name, attrs: Object.fromEntries(Object.values(tag.attributes).map(attr => [attr.name, attr.value])), children: [], text: '' };
    if (stack.length) stack.at(-1).children.push(node);
    else root = node;
    stack.push(node);
  });
  parser.on('text', text => {
    if (stack.length) stack.at(-1).text += text;
    else assert.equal(text.trim(), '', 'Only whitespace is allowed outside the XML root');
  });
  parser.on('closetag', () => { stack.pop(); });
  parser.write(xml).close();
  return root;
}

const descendants = (node, name) => [
  ...(node.name === name ? [node] : []), ...node.children.flatMap(child => descendants(child, name)),
];
const nativeText = node => descendants(node, 'a:t').map(item => item.text).join('');
const hash = (value, label) => assert(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value), label);

function currentIdentity(record, current, label, keys = ['sourceHash', 'researchHash', 'outputHash', 'receiptHash']) {
  for (const key of keys) {
    hash(record[key], `${label} ${key}`);
    equal(record[key], current[key], `${label} ${key}`);
  }
}

function nonemptyStatements(values, label) {
  assert(Array.isArray(values) && values.length > 0
    && values.every(value => typeof value === 'string' && value.trim()), label);
}

async function verifyCurrentAgentReview(base, reference, current, reviewedFiles) {
  const filename = `${current.topic}/qa/${current.format}/agent-review.json`;
  equal(reference?.file, filename, 'Canonical current agent review');
  await verifySealedEvidence(base, [reference]);
  const review = await json(path.join(base, ...filename.split('/')));
  equal(review.schemaVersion, 1, 'Current agent review schema');
  equal(review.status, 'reviewed-current', 'Actual current agent review status');
  equal(review.format, current.format, 'Current agent review format');
  currentIdentity(review, current, 'Current agent review');
  equal(review.reviewer.kind, 'agent', 'Agent review is not human acceptance');
  assert(typeof review.reviewer.id === 'string' && review.reviewer.id.trim(), 'Recorded agent reviewer');
  const sorted = items => [...items].sort((a, b) => a.file.localeCompare(b.file));
  assert.deepEqual(sorted(review.reviewedFiles), sorted(reviewedFiles), 'Agent reviewed exact current visual evidence');
  await verifySealedEvidence(base, review.reviewedFiles);
  nonemptyStatements(review.semanticFindings, 'Explicit current semantic findings');
  nonemptyStatements(review.visualFindings, 'Explicit current visual findings');
  nonemptyStatements(review.limitations, 'Explicit current agent review limitations');
  assert.deepEqual(review.unperformed, ['Human comprehension', 'Human acceptance'], 'Preserve unperformed human review boundaries');
}

async function verifyPngEvidence(base, reference, width, height) {
  await verifySealedEvidence(base, [reference]);
  const bytes = await readFile(path.join(base, ...reference.file.split('/')));
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'Current visual evidence is PNG');
  assert(bytes.length >= 24, 'Current evidence PNG header');
  equal(bytes.readUInt32BE(16), width, 'Current evidence PNG width');
  if (height !== undefined) equal(bytes.readUInt32BE(20), height, 'Current evidence PNG height');
  else assert(bytes.readUInt32BE(20) > 0, 'Current evidence PNG height');
}

export const introductionBrowserCases = [1280, 390].flatMap(width =>
  ['en', 'zh'].flatMap(language => ['light', 'dark'].map(theme => ({ width, language, theme }))));

export async function verifyCurrentIntroductionEvidence(base, verified, publication) {
  publication ??= await json(path.join(base, 'delivery-manifest.json'));
  verifyManifestHeader(publication);
  const records = publication.requestedOutputs.filter(item => item.topic === 'aha-introduction' && ['html', 'image'].includes(item.format));
  assert.deepEqual(records.map(item => item.format).sort(), ['html', 'image'], 'Exactly current introduction HTML and image evidence');
  const selected = verified.filter(item => item.topic === 'aha-introduction' && ['html', 'image'].includes(item.format));
  assert.deepEqual(selected.map(item => item.format).sort(), ['html', 'image'], 'Exactly verified introduction HTML and image');
  for (const entry of records) {
    const record = entry.qa;
    const current = selected.find(item => item.format === entry.format);
    currentIdentity({ ...entry, outputHash: entry.sha256 }, current, 'Current introduction publication');
    const { format } = current;
    await verifySealedEvidence(base, [{
      file: current.file, sha256: current.outputHash,
    }]);
    const qa = `aha-introduction/qa/${format}`;
    equal(record.observations.file, `${qa}/${format === 'html' ? 'browser' : 'image'}-observations.json`, 'Canonical current introduction observations');
    await verifySealedEvidence(base, [record.observations]);
    const observations = await json(path.join(base, ...record.observations.file.split('/')));
    currentIdentity(observations, current, 'Current observations', ['sourceHash', 'researchHash', 'outputHash']);
    assert(typeof observations.method === 'string' && observations.method.trim(), 'Recorded current observation method');
    assert(typeof observations.observedAt === 'string' && Number.isFinite(Date.parse(observations.observedAt)), 'Recorded current observation time');
    nonemptyStatements(observations.unperformed, 'Explicit observation limits');
    const localImage = item => {
      assert(typeof item.file === 'string' && /^[a-zA-Z0-9_-][a-zA-Z0-9._-]*\.png$/.test(item.file), 'Safe current QA PNG filename');
      return { file: `${qa}/${item.file}`, sha256: item.sha256 };
    };
    let reviewedFiles;
    if (format === 'html') {
      assert.deepEqual(observations.failures, [], 'Current browser failures');
      const caseId = item => `${item.width}-${item.language}-${item.theme}`;
      assert.deepEqual(observations.cases.map(caseId).sort(), introductionBrowserCases.map(caseId).sort(), 'Exact current introduction browser cases');
      const checks = [...(observations.checks ?? [])];
      reviewedFiles = [record.observations];
      for (const item of observations.cases) {
        assert(Array.isArray(item.checks) && item.checks.length > 0, 'Recorded checks for every browser case');
        checks.push(...item.checks);
        assert(item.controls && typeof item.controls === 'object' && !Array.isArray(item.controls)
          && Object.keys(item.controls).length > 0, 'Recorded actual browser control observations');
        assert(Array.isArray(item.screenshots) && item.screenshots.length > 0, 'Screenshots for every current browser case');
        for (const screenshot of item.screenshots) {
          const reference = localImage(screenshot);
          await verifyPngEvidence(base, reference, item.width);
          reviewedFiles.push(reference);
        }
      }
      for (const check of checks) {
        assert(typeof check.name === 'string' && check.name.trim(), 'Named current browser check');
        equal(check.passed, true, `Current introduction ${check.name} check`);
      }
      for (const name of ['initialEnglish', 'keyboard', 'pointer', 'languageSwitch', 'themeSwitch', 'reducedMotion', 'offline', 'console', 'overflow']) {
        assert(checks.some(check => check.name === name), `Required current introduction ${name} check`);
      }
      await verifySealedEvidence(base, reviewedFiles);
    } else {
      equal(observations.width, 1080, 'Current introduction PNG width');
      equal(observations.height, 1920, 'Current introduction PNG height');
      assert.deepEqual(observations.previews.map(item => ({ file: item.file, width: item.width, height: item.height })),
        [{ file: 'reading-390.png', width: 390, height: 694 }], 'Current introduction reading preview');
      const preview = localImage(observations.previews[0]);
      await verifyPngEvidence(base, preview, 390, 694);
      const output = { file: current.file, sha256: current.outputHash };
      await verifyPngEvidence(base, output, 1080, 1920);
      reviewedFiles = [record.observations, preview, output];
    }
    await verifyCurrentAgentReview(base, record.review, current, reviewedFiles);
  }
}

export async function verifyPptxEvidence(base, verified, publication) {
  publication ??= await json(path.join(base, 'delivery-manifest.json'));
  verifyManifestHeader(publication);
  const records = publication.requestedOutputs.filter(item => item.format === 'pptx');
  assert.deepEqual(records.map(item => item.topic).sort(), [...pptxTopics].sort(), 'Exactly five unique current PPTX topics');
  assert.deepEqual(verified.filter(item => item.format === 'pptx').map(item => item.topic).sort(),
    [...pptxTopics].sort(), 'Exactly five verified PPTX outputs');
  for (const entry of records) {
    const record = { ...entry, ...entry.qa, outputHash: entry.sha256 };
    assert(!Object.hasOwn(entry.provenance, 'origin'), 'No superseded candidate provenance');
    const { skill, runtimeHash } = entry.provenance;
    equal(skill.name, 'aha-explain', 'PPTX skill provenance');
    assert.match(skill.sourceRevision, /^[a-f0-9]{40}$/, 'PPTX skill source revision');
    assert(skill.guideHashes && Object.keys(skill.guideHashes).length > 0, 'Frozen guide hashes');
    for (const value of Object.values(skill.guideHashes)) hash(value, 'Frozen guide hash');
    hash(runtimeHash, 'Recorded runtime hash');
    const { topic } = record;
    const current = verified.find(item => item.topic === topic && item.format === 'pptx');
    for (const key of ['sourceHash', 'researchHash', 'outputHash', 'receiptHash']) {
      hash(record[key], `PPTX publication ${key}`);
      equal(record[key], current[key], `PPTX publication ${key}`);
    }
    equal(record.slides, topics[topic].slides, 'PPTX publication slide count');
    equal(record.language, 'zh', 'PPTX publication language');
    if (topic === 'aha-introduction') {
      equal(record.visualReview.status, 'reviewed-current', 'Introduction PPTX requires current agent visual review');
    } else {
      equal(record.visualReview.status, 'bounded-review', 'Do not promote application checks to independent visual acceptance');
    }
    assert(Array.isArray(record.visualReview.limitations) && record.visualReview.limitations.length > 0
      && record.visualReview.limitations.every(item => typeof item === 'string' && item.trim()), 'Explicit visual review limitations');
    const qa = `${topic}/qa/pptx`;
    equal(record.application.file, `${qa}/powerpoint-observations.json`, 'Canonical PowerPoint observations path');
    const expectedPages = Array.from({ length: record.slides }, (_, i) => `${qa}/slide-${String(i + 1).padStart(2, '0')}.png`);
    assert.deepEqual(record.pages.map(item => item.file), expectedPages, 'Exact sequential current PPTX pages');
    await verifySealedEvidence(base, [record.application, ...record.pages]);
    for (const page of record.pages) {
      hash(page.sha256, 'PPTX page hash');
      const bytes = await readFile(path.join(base, ...page.file.split('/')));
      assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'PowerPoint page is PNG');
      assert(bytes.length >= 24, 'PowerPoint page header');
      equal(bytes.readUInt32BE(16), 1600, 'PowerPoint page width');
      equal(bytes.readUInt32BE(20), 900, 'PowerPoint page height');
    }
    if (topic === 'aha-introduction') {
      await verifyCurrentAgentReview(base, record.visualReview.evidence, current, record.pages);
    }
    hash(record.application.sha256, 'PowerPoint observations hash');
    const application = await json(path.join(base, ...record.application.file.split('/')));
    equal(application.application, 'Microsoft PowerPoint', 'Actual application observations');
    assert(typeof application.version === 'string' && application.version.trim(), 'PowerPoint version');
    equal(application.method, 'PowerPoint COM export and programmatic edits on a copy, saved and reopened', 'PowerPoint application method');
    equal(application.outputHash, current.outputHash, 'PowerPoint observations outputHash must match current output, even when resealed');
    equal(application.originalUnchanged, true, 'Application probes preserve original output');
    assert.deepEqual(application.unperformed, [
      'Human comprehension', 'Manual editing usability', 'Visual judgment: exported images require separate review',
    ], 'Application success does not claim human or visual acceptance');
    assert.deepEqual(application.slides.map(item => item.slide),
      Array.from({ length: record.slides }, (_, i) => i + 1), 'PowerPoint observations slide count and order');
    const bytes = await readFile(path.join(base, topic, `${topic}.pptx`));
    equal(sha(bytes), current.outputHash, 'Current PPTX bytes for application evidence');
    const deck = await JSZip.loadAsync(bytes);
    const objects = new Map();
    for (const slide of application.slides) {
      equal(slide.image, `slide-${String(slide.slide).padStart(2, '0')}.png`, 'PowerPoint slide image');
      const tree = xmlTree(await deck.file(`ppt/slides/slide${slide.slide}.xml`).async('string'));
      const native = descendants(tree, 'p:spTree')[0].children.filter(node =>
        ['p:sp', 'p:graphicFrame', 'p:pic', 'p:cxnSp', 'p:grpSp'].includes(node.name));
      const byId = new Map(native.map(node => [Number(descendants(node, 'p:cNvPr')[0].attrs.id), node]));
      assert.deepEqual(slide.shapes.map(shape => shape.id).sort((a, b) => a - b),
        [...byId.keys()].sort((a, b) => a - b), 'Observed native object IDs');
      let textCount = 0;
      for (const shape of slide.shapes) {
        const node = byId.get(shape.id);
        equal(shape.name, descendants(node, 'p:cNvPr')[0].attrs.name, 'Observed native object name');
        equal(shape.hasTable, descendants(node, 'a:tbl').length > 0, 'Observed native table');
        equal(shape.hasChart, descendants(node, 'c:chart').length > 0, 'Observed native chart');
        assert(Number.isInteger(shape.type), 'PowerPoint native shape type');
        for (const key of ['left', 'top', 'width', 'height']) assert(Number.isFinite(shape[key]), 'Native object geometry');
        assert(shape.width >= 0 && shape.height >= 0, 'Native object extents');
        if (shape.text?.trim()) {
          equal(compact(shape.text), compact(nativeText(node)), 'Observed text belongs to current native object');
          textCount++;
        } else if (node.name === 'p:sp') {
          equal(compact(nativeText(node)), '', 'Native editable text must be observed');
        }
        objects.set(`${slide.slide}/${shape.id}`, { node, shape });
      }
      assert(textCount > 0, 'Native slide includes observed editable text');
    }
    const hasChart = [...objects.values()].some(object => object.shape.hasChart);
    const expectedEdits = ['text', 'table-cell', ...(topic === 'greenland' || hasChart ? ['chart-data'] : [])];
    assert.deepEqual(application.edits.map(edit => edit.type).sort(), expectedEdits.sort(), 'Required persisted native edit probes');
    for (const edit of application.edits) {
      equal(edit.persisted, true, 'Native edit saved and reopened');
      const object = objects.get(`${edit.slide}/${edit.id}`);
      assert(object, 'Edit probe identifies current native object');
      const { node, shape } = object;
      if (edit.type === 'text') {
        assert(typeof shape.text === 'string' && shape.text.trim(), 'Text probe targets native text');
        equal(compact(edit.before), compact(nativeText(node)), 'Text probe before matches native object');
        equal(edit.after, `${edit.before} [edit probe]`, 'Text probe actual change');
      } else if (edit.type === 'table-cell') {
        equal(shape.hasTable, true, 'Table probe targets native table');
        equal(edit.row, 1, 'Table probe row');
        equal(edit.column, 1, 'Table probe column');
        equal(compact(edit.before), compact(nativeText(descendants(node, 'a:tc')[0])), 'Table probe before matches native cell');
        equal(edit.after, `${edit.before} [edit probe]`, 'Table probe actual change');
      } else {
        equal(shape.hasChart, true, 'Chart probe targets native chart');
        equal(edit.row, 2, 'Chart probe row');
        equal(edit.column, 2, 'Chart probe column');
        assert(Number.isFinite(edit.before), 'Chart probe numeric value');
        equal(edit.after, edit.before + 1, 'Chart probe actual change');
        equal(edit.refresh, 'Explicit Chart.SetSourceData A1:B3, then workbook close/save', 'Chart workbook refresh');
        const chartId = descendants(node, 'c:chart')[0].attrs['r:id'];
        const relationships = xmlTree(await deck.file(`ppt/slides/_rels/slide${edit.slide}.xml.rels`).async('string'));
        const relation = descendants(relationships, 'Relationship').find(item => item.attrs.Id === chartId);
        assert(relation && !relation.attrs.TargetMode, 'Native chart relationship');
        const chartPath = path.posix.normalize(relation.attrs.Target.startsWith('/')
          ? relation.attrs.Target.slice(1) : path.posix.join('ppt/slides', relation.attrs.Target));
        const chartPart = deck.file(chartPath);
        assert(chartPart, 'Native chart relationship resolves to a package part');
        const chart = xmlTree(await chartPart.async('string'));
        const values = descendants(descendants(chart, 'c:val')[0], 'c:numCache')[0];
        const first = descendants(values, 'c:pt').find(item => item.attrs.idx === '0');
        equal(Number(descendants(first, 'c:v')[0].text), edit.before, 'Chart probe before matches current native data');
      }
    }
  }
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

export async function verifyRegeneratedEvidence(base, verified, manifest) {
  manifest ??= await json(path.join(base, 'delivery-manifest.json'));
  for (const current of verified.filter(item => item.topic !== 'aha-introduction')) {
    const entry = manifest.requestedOutputs.find(item => item.topic === current.topic && item.format === current.format);
    assert(entry, 'Current regenerated publication');
    currentIdentity({ ...entry, outputHash: entry.sha256 }, current, 'Regenerated publication');
    await verifyCurrentQa(base, entry);
    const directory = path.join(base, entry.qa.directory);
    const review = await json(path.join(directory, 'review.json'));
    currentIdentity(review, current, 'Regenerated review');
    equal(review.status, 'bounded-agent-review', 'Bounded regenerated review');
    nonemptyStatements(review.findings, 'Explicit regenerated findings');
    nonemptyStatements(review.limitations, 'Explicit regenerated limitations');
    assert.deepEqual(review.unperformed, ['Human comprehension', 'Human acceptance']);
    if (current.format === 'html') {
      const observations = await json(path.join(directory, 'browser-observations.json'));
      equal(observations.htmlOutputHash, current.outputHash, 'Browser observed current HTML');
      assert.deepEqual(observations.errors, []);
      assert.deepEqual(observations.blocked, []);
      const key = item => `${item.width}-${item.theme}-${item.language}`;
      assert.deepEqual(observations.cases.map(key).sort(), [1280, 390, 320].flatMap(width =>
        ['light', 'dark'].flatMap(theme => ['en', 'zh'].map(language => key({ width, theme, language })))).sort());
      for (const item of observations.cases) {
        equal(item.viewport, item.width, 'Observed viewport');
        assert(item.pageWidth <= item.width, 'Current HTML does not overflow');
        assert.deepEqual(item.overflow, []);
      }
      for (const width of [1280, 390, 320]) for (const language of ['en', 'zh']) {
        const file = `${entry.qa.directory}/${width}-${language}.png`;
        await verifyPngEvidence(base, entry.qa.evidence.find(item => item.file === file), width);
      }
    } else if (current.format === 'image') {
      const file = `${entry.qa.directory}/reading-1200.png`;
      await verifyPngEvidence(base, entry.qa.evidence.find(item => item.file === file), 1200, 1067);
    } else if (current.format === 'video') {
      const approval = await json(path.join(directory, 'approval.json'));
      equal(approval.planHash, current.receipt.planHash, 'Current approved plan');
      equal(approval.sourceHash, current.sourceHash, 'Current approved video source');
      equal(approval.userAnswer, '批准四个新计划，离线复用已有录音并渲染', 'Explicit current import consent');
      equal(approval.speechUserAnswer, '批准这四份完整旁白和上述联网配音范围', 'Explicit original speech consent');
      equal(approval.recordingPlanHash, current.recordingPlanHash, 'Approved recording provenance');
      equal(approval.localExecutionAnswer, '批准本轮本地渲染、检查及同范围排版修复', 'Separate local execution consent');
      assert.deepEqual(approval.narration, current.plan.segments, 'Complete approved narration');
      equal(approval.provider, current.plan.provider, 'Approved provider');
      equal(approval.voice, current.plan.voice, 'Approved voice');
      equal(approval.rate, current.plan.rate, 'Approved rate');
      const source = await json(path.join(directory, 'source-diagnostics.json'));
      equal(source.sourceHash, current.sourceHash, 'Source diagnostic identity');
      assert.deepEqual(source.errors, []);
      assert.deepEqual(source.blocked, []);
      assert.deepEqual(source.replay.map(item => item.index), [0, Math.floor(current.plan.segments.length / 2), current.plan.segments.length - 1]);
      assert(source.replay.every(item => item.matches), 'Sampled source replay');
      equal(source.video.length, current.plan.segments.length * 5, 'Source sampled coverage');
      for (const item of source.video) {
        assert(item.figureScroll <= item.figureHeight + 2 && item.noteBottom + 4 <= item.sourceTop
          && item.sourceBottom + 8 <= item.captionTop, 'Source and actual caption geometry');
      }
      const technical = await json(path.join(directory, 'encoded', 'technical-review.json'));
      equal(technical.artifactHash, current.outputHash, 'Current encoded identity');
      equal(technical.sourceHash, current.sourceHash, 'Current encoded source');
      equal(technical.planHash, current.receipt.planHash, 'Current encoded plan');
      equal(technical.frames, current.receipt.totalFrames, 'Current encoded frames');
      equal(technical.seconds, current.receipt.durationSeconds, 'Current encoded duration');
      equal(technical.fullDecode, true, 'Complete encoded decode');
      equal(technical.exactApprovedSubtitleTextAndTiming, true, 'Exact encoded subtitles');
      assert.match(technical.listening, /^unperformed/, 'Listening has not been performed');
      const audio = await json(path.join(base, current.topic, 'audio', 'manifest.json'));
      let offset = 0;
      const expected = audio.segments.flatMap((segment, index) => {
        const result = [['start', 0], ['middle', Math.floor(segment.frames / 2)], ['end', segment.frames - 1]]
          .map(([label, frame]) => ({ id: segment.id, frame: offset + frame, filename: `${index + 1}-${label}.png` }));
        offset += segment.frames;
        return result;
      });
      assert.deepEqual(technical.samples.map(({ sha256, ...item }) => item), expected, 'Measured boundary and middle samples');
      for (const sample of technical.samples) {
        await verifyPngEvidence(base, { file: `${entry.qa.directory}/encoded/${sample.filename}`, sha256: sample.sha256 }, 1280, 720);
      }
      const playback = await json(path.join(directory, 'encoded', 'playback.json'));
      equal(playback.artifactHash, current.outputHash, 'Current playback identity');
      equal(playback.ended, true, 'Actual complete muted playback');
      equal(playback.error, null, 'No playback error');
      equal(playback.width, 1280, 'Playback width');
      equal(playback.height, 720, 'Playback height');
      assert(Math.abs(playback.seconds - current.receipt.durationSeconds) < .1, 'Playback duration');
      const visual = await json(path.join(directory, 'encoded', 'visual-review.json'));
      currentIdentity(visual, current, 'Encoded visual review');
      nonemptyStatements(visual.findings, 'Encoded visual findings');
      nonemptyStatements(visual.limitations, 'Encoded visual limits');
      assert(Array.isArray(visual.reviewedFiles) && visual.reviewedFiles.length > 0, 'Actual encoded images reviewed');
      for (const file of visual.reviewedFiles) {
        const evidence = entry.qa.evidence.find(item => item.file === `${entry.qa.directory}/${file}`);
        assert(evidence, 'Reviewed encoded image is sealed');
        await verifySealedEvidence(base, [evidence]);
      }
    }
  }
}

export async function verifyIntroductionEvidence(base, verified, manifest) {
  manifest ??= await json(path.join(base, 'delivery-manifest.json'));
  const entries = manifest.requestedOutputs.filter(item => item.topic === 'aha-introduction' && item.format === 'video');
  assert.deepEqual(entries.map(entry => entry.language).sort(), ['en', 'zh'], 'Both introduction video languages');
  for (const entry of entries) {
    await verifyCurrentQa(base, entry);
    const directory = path.join(base, entry.qa.directory);
    const video = verified.find(item => item.topic === entry.topic && item.format === 'video' && item.language === entry.language);
    assert(video, 'Verified language-specific video');
    const sealed = file => entry.qa.evidence.find(item => item.file === `${entry.qa.directory}/${file}`);
    for (const name of ['preview/observations.json', 'encoded/technical-review.json', 'encoded/visual-review.json',
      'encoded/playback.json', 'speech-approval.json', 'approval.json', 'asset-provenance.json']) {
      assert(sealed(name), `Required introduction evidence: ${name}`);
    }
    currentIdentity({ ...entry, outputHash: entry.sha256 }, video, 'Introduction publication');
    const approval = await json(path.join(directory, 'approval.json'));
    equal(approval.planHash, video.receipt.planHash, 'Approved introduction plan');
    equal(approval.sourceHash, video.sourceHash, 'Approved introduction source');
    equal(approval.language, entry.language, 'Approved introduction language');
    assert.deepEqual(approval.narration, video.plan.segments.map(({ id, text }) => ({ id, text })));
    assert.deepEqual(approval.recordingPlanHashes, video.recordingPlanHashes, 'Approved original recordings');
    nonemptyStatements([approval.userAnswer, approval.publicationAuthorization], 'Explicit production and publication approval');
    const speech = await json(path.join(directory, 'speech-approval.json'));
    equal(speech.voice, entry.language === 'en' ? 'en-US-AriaNeural' : 'zh-CN-XiaoxiaoNeural', 'Approved speech language');
    assert.deepEqual(speech.origins.map(item => item.planHash).sort(), video.recordingPlanHashes, 'Exact speech approval origins');
    for (const origin of speech.origins) {
      equal(await hashValue(origin.plan), origin.planHash, 'Original synthesis plan hash');
      equal(origin.plan.provider, 'edge-tts', 'Synthesis rather than intermediate import plan');
      equal(origin.plan.voice, speech.voice, 'Original speech voice');
      equal(origin.plan.rate, '+0%', 'Original speech rate');
      nonemptyStatements([origin.userAnswer, origin.externalScope], 'Original speech permission');
    }
    for (const recording of video.recordings) {
      const origin = speech.origins.find(item => item.planHash === recording.recordingPlanHash);
      const segment = video.plan.segments.find(item => item.id === recording.id);
      equal(origin.plan.segments.find(item => item.id === recording.id)?.text, segment.text, 'Originally approved recording text');
    }
    const preview = await json(path.join(directory, 'preview', 'observations.json'));
    equal(preview.sourceHash, video.sourceHash, 'Introduction preview source');
    equal(preview.planHash, video.receipt.planHash, 'Introduction preview plan');
    equal(preview.timing, 'measured-approved-audio', 'Preview uses actual recording timing');
    assert.deepEqual(preview.overflow, []);
    assert.deepEqual(preview.replay.map(item => item.id), video.plan.segments.map(item => item.id));
    assert(preview.replay.every(item => item.matches === true), 'Introduction sampled A/B/A replay');
    equal(preview.samples.length, 73, 'Introduction preview coverage');
    for (const segment of video.plan.segments) {
      const samples = preview.samples.filter(item => item.id === segment.id);
      assert([0, .24, .5, .75, 1].every(fraction => samples.some(item => item.fraction === fraction)), 'Every scene sampled');
    }
    for (const sample of preview.samples) {
      const recording = video.recordings.find(item => item.id === sample.id);
      assert(recording, 'Known preview segment');
      assert.deepEqual(sample.outside, []);
      assert(sample.captionTop >= 550 && sample.captionTop < 720 && sample.sourceBottom + 8 <= sample.captionTop);
      equal(sample.state.language, entry.language, 'Preview language');
      equal(sample.state.sceneId, sample.id, 'Preview scene');
      equal(sample.state.segmentFrames, recording.frames, 'Measured preview segment duration');
      equal(sealed(`preview/${sample.file}`)?.sha256, sample.sha256, 'Introduction preview image');
    }
    const technical = await json(path.join(directory, 'encoded', 'technical-review.json'));
    equal(technical.artifactHash, video.outputHash, 'Introduction encoded identity');
    equal(technical.sourceHash, video.sourceHash, 'Introduction encoded source');
    equal(technical.planHash, video.receipt.planHash, 'Introduction encoded plan');
    equal(technical.frames, topics['aha-introduction'].videoFrames[entry.language], 'Introduction encoded frames');
    equal(technical.fullDecode, true, 'Introduction full decode');
    equal(technical.exactApprovedSubtitleTextAndTiming, true, 'Introduction exact approved captions');
    equal(technical.listening, 'not-performed', 'No invented listening');
    const stream = technical.streams.find(item => item.codec_type === 'video');
    equal(stream?.codec_name, 'h264', 'Encoded video codec');
    equal(stream.width, 1280, 'Encoded video width');
    equal(stream.height, 720, 'Encoded video height');
    equal(stream.r_frame_rate, '30/1', 'Encoded frame rate');
    equal(Number(stream.nb_read_frames), technical.frames, 'Full measured frame count');
    equal(technical.streams.find(item => item.codec_type === 'audio')?.codec_name, 'aac', 'Encoded audio codec');
    let offset = 0;
    for (const recording of video.recordings) {
      const samples = technical.samples.filter(item => item.id === recording.id);
      assert([0, Math.floor(recording.frames / 2), recording.frames - 1].every(local => samples.some(item => item.local === local)), 'Encoded scene coverage');
      for (const sample of samples) {
        assert(Number.isInteger(sample.local) && sample.local >= 0 && sample.local < recording.frames);
        equal(sample.frame, offset + sample.local, 'Exact encoded sample frame');
        equal(sealed(`encoded/${sample.file}`)?.sha256, sample.sha256, 'Introduction encoded sample');
      }
      offset += recording.frames;
    }
    assert(technical.samples.every(sample => video.recordings.some(item => item.id === sample.id)));
    equal(new Set(technical.samples.map(sample => sample.frame)).size, technical.samples.length, 'Unique encoded samples');
    const playback = await json(path.join(directory, 'encoded', 'playback.json'));
    equal(playback.artifactHash, video.outputHash, 'Playback video identity');
    equal(playback.ended, true, 'Complete muted playback');
    equal(playback.error, null, 'Playback error');
    assert(Math.abs(playback.seconds - technical.frames / 30) < .01);
    const visual = await json(path.join(directory, 'encoded', 'visual-review.json'));
    equal(visual.artifactHash, video.outputHash, 'Introduction actual visual review identity');
    equal(visual.sourceHash, video.sourceHash, 'Introduction actual visual review source');
    equal(visual.planHash, video.receipt.planHash, 'Introduction actual visual review plan');
    equal(visual.blockingIssues, 0, 'No unresolved visual blocker');
    nonemptyStatements(visual.observations, 'Actual visual findings');
    nonemptyStatements(visual.limitations, 'Bounded visual review');
    assert(visual.inspectedFiles.length > 0);
    for (const file of visual.inspectedFiles) assert(technical.samples.some(sample => sample.file === file), 'Reviewed current encoded frame');
    const assets = await json(path.join(directory, 'asset-provenance.json'));
    const resources = (await readdir(path.join(base, entry.sourceProject, 'assets'))).filter(name => name !== 'resources.json');
    assert.deepEqual(assets.files.map(asset => asset.file).sort(), resources.map(name => `assets/${name}`).sort(), 'Exact current visual resource inventory');
    for (const asset of assets.sourceArtifacts) {
      const current = manifest.requestedOutputs.find(item => `examples/${item.file}` === asset.artifact);
      assert(current, 'Showcase uses a current example');
      equal(current.sha256, asset.sha256, 'Showcase original artifact identity');
      equal(current.sourceHash, asset.sourceHash, 'Showcase original source identity');
    }
    for (const asset of assets.files) {
      assert(/^assets\/[^/]+$/.test(asset.file), 'Local showcase resource');
      equal(sha(await readFile(path.join(base, entry.sourceProject, asset.file))), asset.sha256, 'Captured visual resource identity');
    }
  }
}

function verifyManifestHeader(manifest) {
  equal(manifest.schemaVersion, 2, 'Unified publication schema');
  equal(manifest.layout, 'topic-format-language-v1', 'Unified publication layout');
  equal(manifest.status, 'published-examples-with-explicit-qa-limits', 'Unified publication status');
  for (const key of ['pptxPublication', 'introductionPublication', 'codePilotEvaluation',
    'greenlandEvaluation', 'ahaIntroductionEvaluation', 'taskVideoEvaluation', 'historicalVisualReview',
    'previousPublishedVersion', 'previousExamplesPreserved', 'originalExamplesUnchanged', 'optionalNativeMotion']) {
    assert(!Object.hasOwn(manifest, key), 'No parallel current publication indexes');
  }
}

export async function verifyCurrentQa(base, entry) {
  const qa = layoutFor(entry).qa;
  equal(entry.qa?.directory, qa, 'Canonical current QA directory');
  equal(entry.qa.status, 'bounded-evidence', 'Preserve bounded QA');
  for (const key of ['previousFile', 'previousReceipt', 'origin']) {
    assert(!Object.hasOwn(entry.provenance ?? {}, key), 'No superseded provenance in current delivery');
  }
  assert(!Object.hasOwn(entry.qa, 'relocations'), 'Current QA uses direct paths, not relocation maps');
  assert(entry.qa.evidence.length > 0, 'Current QA evidence is required');
  const actual = [];
  async function walk(directory) {
    for (const item of await readdir(path.join(base, directory), { withFileTypes: true })) {
      assert(!item.isSymbolicLink(), 'QA files must not be symlinks');
      const file = `${directory}/${item.name}`;
      if (item.isDirectory()) await walk(file);
      else { assert(item.isFile()); actual.push(file); }
    }
  }
  await walk(qa);
  assert.deepEqual(entry.qa.evidence.map(item => item.file).sort(), actual.sort(), 'Exact current QA inventory');
  await verifySealedEvidence(base, entry.qa.evidence);
  for (const evidence of entry.qa.evidence) {
    assert(!Object.hasOwn(evidence, 'archiveFile'), 'Current QA is self-contained, not archive-dependent');
  }
  if (entry.format === 'image' && entry.topic !== 'aha-introduction') {
    const review = await json(path.join(base, qa, 'review-scope.json'));
    currentIdentity(review, { ...entry, outputHash: entry.sha256 }, 'Image preview scope', ['sourceHash', 'researchHash', 'outputHash']);
    equal(review.status, 'reading-preview-only', 'Reading preview does not establish visual acceptance');
    nonemptyStatements(review.limitations, 'Image review limitations');
  }
  await assert.rejects(access(path.join(base, layoutFor(entry).project, 'qa')), { code: 'ENOENT' }, 'QA stays outside author projects');
}

export async function verifyExamples({
  base = path.join(root, 'examples'),
  manifest,
} = {}) {
  manifest ??= await json(path.join(base, 'delivery-manifest.json'));
  verifyManifestHeader(manifest);
  const expectedOutputs = Object.keys(topics).flatMap(outputVariantsFor).map(outputKey);
  assert.equal(manifest.requestedOutputs.length, expectedOutputs.length, 'Exactly twenty-one requested outputs');
  assert.deepEqual(manifest.requestedOutputs.map(outputKey).sort(),
    expectedOutputs.sort());
  const verified = [];
  for (const entry of manifest.requestedOutputs) {
    verified.push(await verifyOutput(base, entry));
    await verifyCurrentQa(base, entry);
  }
  await verifyPptxEvidence(base, verified, manifest);
  await verifyCurrentIntroductionEvidence(base, verified, manifest);
  await verifyRegeneratedEvidence(base, verified, manifest);
  await verifyIntroductionEvidence(base, verified, manifest);
  return {
    status: 'passed', outputs: verified.map(({ receipt, plan, recordings, ...item }) => item),
    scope: 'Current source and recording provenance, runtime-validated native structure, hash-bound PowerPoint/browser observations, WAV timing and exact subtitles; no authored code executed or historical archives required. These checks do not constitute human acceptance, listening, slideshow, manual editing or comprehension review.',
  };
}

export async function main(args = process.argv.slice(2)) {
  assert(args.length <= 1, 'Usage: node --import tsx evals/examples/verify.mjs [new-report.json]');
  const result = await verifyExamples();
  if (args[0]) await writeFile(path.resolve(root, args[0]), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main();
