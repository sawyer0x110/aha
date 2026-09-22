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
  anc: { width: 1800, height: 1200, slides: 7, frames: 3813 },
  'git-merge': { htmlLanguage: 'zh', width: 1800, height: 1200, slides: 8, frames: 3788 },
  greenland: { formats: ['pptx', 'video'], slides: 7, frames: 3472, provider: 'edge-tts' },
  'cpython-string': { formats: ['video'], frames: 644, provider: 'edge-tts' },
  'docker-layers': { formats: ['video'], frames: 638, provider: 'provided-audio' },
  'aha-introduction': { width: 1080, height: 1920, slides: 8, frames: 3582, provider: 'provided-audio' },
};
export const formatsFor = topic => topics[topic].formats ?? ['html', 'image', 'pptx', 'video'];
const sharedVideoTopics = ['anc', 'git-merge'];
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
  const filename = `${topic}.${{ html: 'html', image: 'png', pptx: 'pptx', video: 'mp4' }[format]}`;
  equal(entry.file, `${topic}/${filename}`, 'Canonical output path');
  equal(entry.sourceProject, `${topic}/projects/${format}`, 'Canonical source path');
  equal(entry.report, `${topic}/research/report.md`, 'Canonical report path');
  equal(entry.receipt, `${entry.file}.receipt.json`, 'Canonical receipt path');
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
  let plan, recordingPlanHash;
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
      const provenance = await json(path.join(directory, 'audio', 'provenance.json'));
      equal(provenance.provider, 'edge-tts', 'Recording provider, not the current import provider');
      equal(provenance.voice, 'en-US-AriaNeural', 'Recorded speech voice');
      equal(provenance.rate, plan.rate, 'Recording rate');
      hash(provenance.recordingPlanHash, 'Recording plan identity');
      recordingPlanHash = provenance.recordingPlanHash;
      assert.deepEqual(provenance.narration, plan.segments.map(({ id, text }) => ({ id, text })),
        'Imported recordings preserve the approved spoken words and order');
      assert.deepEqual(provenance.recordings, audio.segments.map(segment => ({
        id: segment.id, file: segment.filename, sha256: segment.sha256,
      })), 'Recording provenance binds the current WAV bytes');
    }
  }
  equal(entry.receiptHash, sha(receiptBytes), 'Manifest receipt hash');
  return { topic, format, file: entry.file, outputHash: output, sourceHash: source, researchHash: research, receiptHash: sha(receiptBytes), receipt, plan, recordingPlanHash };
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
  assert.deepEqual(records.map(item => item.topic).sort(), [...pptxTopics].sort(), 'Exactly four unique current PPTX topics');
  assert.deepEqual(verified.filter(item => item.format === 'pptx').map(item => item.topic).sort(),
    [...pptxTopics].sort(), 'Exactly four verified PPTX outputs');
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

async function verifyEvidence(base, verified) {
  for (const topic of sharedVideoTopics) {
    const formats = Object.fromEntries(verified.filter(item => item.topic === topic).map(item => [item.format, item]));
    const directory = path.join(base, topic, 'qa', 'video');
    const browser = await json(path.join(directory, 'browser-observations.json'));
    assert.deepEqual(browser.errors, []);
    assert.deepEqual(browser.blockedRequests, []);
    equal(browser.replayMatches, true, 'Sampled video replay evidence');
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
    for (const [index, sample] of media.samples.entries()) {
      equal(sample.file, `encoded-video/segment-${String(index + 1).padStart(2, '0')}.png`, 'Current encoded sample path');
      await access(path.join(directory, sample.file));
    }
    const approval = await json(path.join(directory, 'approval.json'));
    equal(approval.planHash, formats.video.receipt.planHash, 'Recorded approval for exact import plan');
    equal(approval.recordingPlanHash, formats.video.recordingPlanHash, 'Recording plan approval');
    equal(approval.completeVideoListeningAndViewing, 'not-confirmed', 'Full-video acceptance remains separate');
  }
  const recheck = await json(path.join(base, 'anc', 'qa', 'html', 'browser-check.json'));
  assert.deepEqual(recheck.failures, []);
  const currentCases = recheck.cases;
  const expected = [1280, 390].flatMap(width =>
    ['light', 'dark'].flatMap(theme => ['en', 'zh'].map(language => `anc-${width}-${theme}-${language}`)));
  assert.deepEqual(currentCases.map(item => item.id).sort(), expected.sort(), 'Current ANC browser case identities');
  for (const record of currentCases) {
    const html = verified.find(item => item.topic === record.topic && item.format === 'html');
    for (const key of ['sourceHash', 'outputHash', 'researchHash']) equal(record[key], html[key], `Current browser ${key}`);
    equal(record.checks.length, 4, 'Current browser checks per case');
    assert(record.checks.every(check => check.passed === true));
  }
}

async function verifyGreenlandEvidence(base, verified) {
  const directory = path.join(base, 'greenland', 'qa', 'video');
  const video = verified.find(item => item.topic === 'greenland' && item.format === 'video');
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

export async function verifyCodePilotEvidence(base, verified, manifest) {
  manifest ??= await json(path.join(base, 'delivery-manifest.json'));
  const entry = manifest.requestedOutputs.find(item => item.topic === 'cpython-string');
  await verifyCurrentQa(base, entry);
  const directory = path.join(base, entry.qa.directory);
  const evidenceNames = entry.qa.evidence.map(item => item.file.slice(entry.qa.directory.length + 1));
  const approvals = await json(path.join(directory, 'approvals.json'));
  for (const topic of ['cpython-string']) {
    const video = verified.find(item => item.topic === topic && item.format === 'video');
    for (const key of ['sourceHash', 'researchHash']) equal(entry[key], video[key], `Pilot publication ${key}`);
    equal(entry.sha256, video.outputHash, 'Pilot publication output');
    equal(entry.frames, topics[topic].frames, 'Pilot publication frames');
    const approval = approvals.narrationAndNetwork.plans.find(item => item.topic === topic);
    equal(approval.planHash, video.receipt.planHash, 'Exact approved pilot plan');
    equal(approval.sourceHash, video.sourceHash, 'Exact approved pilot source');
    for (const required of ['preview/report.json', 'encoded/technical-review.json', 'author-review.json']) {
      assert(evidenceNames.includes(required), 'Required QA must be hash-bound');
    }
    const preview = await json(path.join(directory, 'preview', 'report.json'));
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
      const evidence = entry.qa.evidence.find(item => item.file === `${entry.qa.directory}/preview/${capture.filename}`);
      equal(evidence?.sha256, capture.sha256, 'Preview screenshot identity');
    }
    const end = id => preview.captures.find(item => item.id === id && item.label === 'end').state;
    equal(end('ascii-baseline').codePointWidthBytes, 1, 'ASCII storage');
    equal(end('whole-string-widens').codePointWidthBytes, 4, 'Non-BMP result storage');
    equal(end('whole-string-widens').originalStrIsUnchanged, true, 'Immutable original string');
    equal(end('utf8-contrast').result.utf8Bytes - end('utf8-contrast').baseline.utf8Bytes, 4, 'UTF-8 payload delta');
    const technical = await json(path.join(directory, 'encoded', 'technical-review.json'));
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
      const evidence = entry.qa.evidence.find(item => item.file === `${entry.qa.directory}/encoded/${sample.filename}`);
      equal(evidence?.sha256, sample.sha256, 'Encoded screenshot identity');
    }
  }
}

export async function verifyTaskVideoEvidence(base, verified, manifest) {
  manifest ??= await json(path.join(base, 'delivery-manifest.json'));
  const entries = manifest.requestedOutputs.filter(item =>
    (item.topic === 'git-merge' && item.format === 'html') || item.topic === 'docker-layers');
  assert.deepEqual(entries.map(item => `${item.topic}/${item.format}`).sort(), ['docker-layers/video', 'git-merge/html']);
  for (const entry of entries) {
    await verifyCurrentQa(base, entry);
    const directory = path.join(base, entry.qa.directory);
    const sealed = entry.qa.evidence.map(item => item.file.slice(entry.qa.directory.length + 1));
    const current = verified.find(item => item.topic === entry.topic && item.format === entry.format);
    assert(current, 'Current task/video output exists');
    for (const key of ['sourceHash', 'researchHash', 'receiptHash']) equal(entry[key], current[key], `Task/video publication ${key}`);
    equal(entry.sha256, current.outputHash, 'Task/video publication output');
    const name = entry.format === 'html' ? 'browser' : 'media';
    for (const file of [`${name}-observations.json`, 'review.json']) assert(sealed.includes(file), 'Current task/video evidence required');
    const review = await json(path.join(directory, 'review.json'));
    for (const key of ['sourceHash', 'researchHash', 'outputHash']) equal(review[key], current[key], `Task/video review ${key}`);
    equal(review.status, 'bounded-agent-review', 'Bounded task/video review');
    assert(review.limitations.length > 0, 'Task/video review limitations');
    assert(review.pixelsReviewed.length > 0, 'Task/video reviewed pixels');
    for (const image of review.pixelsReviewed) {
      assert(sealed.includes(image), 'Reviewed task/video image is sealed');
      const png = await readFile(path.join(directory, image));
      assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'Task/video evidence is PNG');
    }
    const observations = await json(path.join(directory, `${name}-observations.json`));
    if (entry.format === 'html') {
      assert.deepEqual(observations.errors, []);
      assert.deepEqual(observations.blocked, []);
      assert.deepEqual(observations.observations.map(item => item.width), [1280, 390, 320], 'Current Git viewport evidence');
      for (const viewport of observations.observations) {
        equal(viewport.language, 'zh-CN', 'Current Git Chinese evidence');
        assert(viewport.scrollWidth <= viewport.width, 'Current Git overflow');
        assert.deepEqual(viewport.overflowRegions, [], 'Current Git argument needs no horizontal scrolling');
        equal(viewport.keyboardAnchor, '#ref-revert', 'Current Git keyboard anchor');
        const file = `html-${viewport.width}.png`;
        assert(sealed.includes(file), 'Current Git viewport screenshot');
        equal((await readFile(path.join(directory, file))).readUInt32BE(16), viewport.width, 'Current Git screenshot width');
      }
    } else {
      equal(entry.provider, 'provided-audio', 'Current Docker imported recording');
      const approved = await json(path.join(directory, 'approval.json'));
      equal(approved.userAnswer, '批准本轮离线导入、渲染和验证', 'Recorded execution approval');
      equal(approved?.planHash, current.receipt.planHash, 'Current Docker approved plan');
      equal(approved?.sourceHash, current.sourceHash, 'Current Docker approved source');
      equal(observations.fullDecode, 'passed', 'Current Docker decode');
      equal(observations.playback.ended, true, 'Current Docker playback');
      equal(observations.playback.error, null, 'Current Docker playback error');
      equal(observations.playback.width, 1280, 'Current Docker playback width');
      equal(observations.playback.height, 720, 'Current Docker playback height');
      assert.match(observations.listening, /^unperformed/, 'Current Docker listening remains unperformed');
      assert(review.limitations.some(item => /640px/.test(item)), 'Preserve small-player density limitation');
      assert(review.limitations.some(item => /No actual listening.*human comprehension/.test(item)), 'Preserve listening and comprehension limits');
      const file = 'source-diagnostics.json';
      assert(sealed.includes(file), 'Current Docker replay evidence');
      const diagnostics = await json(path.join(directory, file));
      equal(diagnostics.sourceHash, current.sourceHash, 'Current Docker replay source');
      equal(diagnostics.outputHash, current.outputHash, 'Current Docker replay output');
      equal(diagnostics.frameCount, current.receipt.totalFrames, 'Current Docker diagnostic frames');
      assert.deepEqual(diagnostics.replay.map(item => item.frame), [200, 380, 600], 'Current Docker replay samples');
      assert(diagnostics.replay.every(item => item.matches), 'Current Docker replay matches');
      assert.deepEqual(diagnostics.errors, []);
      assert.deepEqual(diagnostics.blocked, []);
      equal(diagnostics.outOfBoundsFrames, 0, 'Current Docker source bounds');
    }
  }
}

export async function verifyIntroductionEvidence(base, verified, manifest) {
  manifest ??= await json(path.join(base, 'delivery-manifest.json'));
  const entry = manifest.requestedOutputs.find(item => item.topic === 'aha-introduction' && item.format === 'video');
  await verifyCurrentQa(base, entry);
  const directory = path.join(base, entry.qa.directory);
  const video = verified.find(item => item.topic === 'aha-introduction' && item.format === 'video');
  const evidence = entry.qa.evidence.map(item => item.file.slice(entry.qa.directory.length + 1));
  for (const name of [
    'preview/report.json', 'encoded/technical-review.json', 'encoded/visual-review.json',
    'speech-approval.json', 'approval.json',
  ]) assert(evidence.includes(name), `Required introduction evidence: ${name}`);
  currentIdentity({ ...entry, outputHash: entry.sha256 }, video, 'Introduction publication');
  const approval = await json(path.join(directory, 'approval.json'));
  equal(approval.planHash, video.receipt.planHash, 'Approved corrected introduction plan');
  equal(approval.sourceHash, video.sourceHash, 'Approved corrected introduction source');
  equal(approval.recordingPlanHash, video.recordingPlanHash, 'Approved recording source');
  const speechApproval = await json(path.join(directory, 'speech-approval.json'));
  equal(speechApproval.planHash, video.recordingPlanHash, 'Full speech approval');
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
    equal(entry.qa.evidence.find(item => item.file === `${entry.qa.directory}/preview/${capture.filename}`)?.sha256, capture.sha256, 'Introduction preview image');
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
    equal(entry.qa.evidence.find(item => item.file === `${entry.qa.directory}/encoded/${sample.filename}`)?.sha256, sample.sha256, 'Introduction encoded sample');
  }
  const visual = await json(path.join(directory, 'encoded', 'visual-review.json'));
  equal(visual.artifactHash, video.outputHash, 'Introduction actual visual review identity');
  equal(visual.dockerConnectorFix, 'confirmed-in-actual-encoded-frame', 'Actual connector fix review');
}

function verifyManifestHeader(manifest) {
  equal(manifest.schemaVersion, 2, 'Unified publication schema');
  equal(manifest.layout, 'topic-format-v1', 'Unified publication layout');
  equal(manifest.status, 'published-examples-with-explicit-qa-limits', 'Unified publication status');
  for (const key of ['pptxPublication', 'introductionPublication', 'codePilotEvaluation',
    'greenlandEvaluation', 'ahaIntroductionEvaluation', 'taskVideoEvaluation', 'historicalVisualReview',
    'previousPublishedVersion', 'previousExamplesPreserved', 'originalExamplesUnchanged', 'optionalNativeMotion']) {
    assert(!Object.hasOwn(manifest, key), 'No parallel current publication indexes');
  }
}

export async function verifyCurrentQa(base, entry) {
  const qa = `${entry.topic}/qa/${entry.format}`;
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
  await assert.rejects(access(path.join(base, entry.topic, 'projects', entry.format, 'qa')), { code: 'ENOENT' }, 'QA stays outside author projects');
}

export async function verifyExamples({
  base = path.join(root, 'examples'),
  manifest,
} = {}) {
  manifest ??= await json(path.join(base, 'delivery-manifest.json'));
  verifyManifestHeader(manifest);
  const expectedOutputs = Object.keys(topics).flatMap(topic => formatsFor(topic).map(format => `${topic}/${format}`));
  assert.equal(manifest.requestedOutputs.length, expectedOutputs.length, 'Exactly sixteen requested outputs');
  assert.deepEqual(manifest.requestedOutputs.map(item => `${item.topic}/${item.format}`).sort(),
    expectedOutputs.sort());
  const verified = [];
  for (const entry of manifest.requestedOutputs) {
    verified.push(await verifyOutput(base, entry));
    await verifyCurrentQa(base, entry);
  }
  await verifyPptxEvidence(base, verified, manifest);
  await verifyCurrentIntroductionEvidence(base, verified, manifest);
  await verifyEvidence(base, verified);
  await verifyGreenlandEvidence(base, verified);
  await verifyCodePilotEvidence(base, verified, manifest);
  await verifyTaskVideoEvidence(base, verified, manifest);
  await verifyIntroductionEvidence(base, verified, manifest);
  return {
    status: 'passed', outputs: verified.map(({ receipt, plan, ...item }) => item),
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
