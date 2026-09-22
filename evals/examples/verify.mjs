import assert from 'node:assert/strict';
import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { SaxesParser } from 'saxes';
import { readDossier } from '../../src/research/dossier.ts';
import { checkArtifact, sourceHash } from '../../src/artifacts/project.ts';
import { validatePptx } from '../../src/artifacts/pptx-validation.ts';
import { checkPlan, validateVideoPlan, checkAudioTiming, subtitles } from '../../src/media/plan.ts';
import { audioTiming } from '../../src/media/duration.ts';
import { hashValue } from '../../src/core/identity.ts';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const topics = {
  anc: { basename: 'anc', width: 1800, height: 1200, slides: 7, frames: 3813 },
  'git-merge': { basename: 'git-merge', htmlLanguage: 'zh', width: 1800, height: 1200, slides: 8, frames: 3788 },
  greenland: { basename: 'greenland', formats: ['pptx', 'video'], slides: 7, frames: 3472, provider: 'edge-tts' },
  'cpython-string': { basename: 'pilot', formats: ['video'], frames: 644, provider: 'edge-tts' },
  'docker-layers': { basename: 'pilot', formats: ['video'], frames: 638, provider: 'provided-audio' },
  'aha-introduction': { basename: 'overview', basenames: { video: 'overview-v5' }, width: 1080, height: 1920, slides: 8, frames: 3582, provider: 'provided-audio' },
};
export const formatsFor = topic => topics[topic].formats ?? ['html', 'image', 'pptx', 'video'];
const historicalBrowserTopics = ['anc', 'git-merge'];
const pptxTopics = Object.keys(topics).filter(topic => formatsFor(topic).includes('pptx'));
const basenameFor = (topic, format) => topics[topic].basenames?.[format] ?? topics[topic].basename;
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
// PowerShell 5.1 emits a UTF-8 BOM; strip it only for parsing, never for byte hashing.
const json = async file => JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
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
  const filename = format === 'html' ? 'index.html' : `${basenameFor(topic, format)}.${{ image: 'png', pptx: 'pptx', video: 'mp4' }[format]}`;
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
  // Receipt output is the original render basename, not the subsequently published filename.
  if (format !== 'video') assert(typeof receipt.output === 'string' && receipt.output.length > 0);
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
      if (topic === 'docker-layers') {
        const associations = await json(path.join(origin, 'claim-associations.json'));
        equal(associations.originalPlanHash, originalPlanHash, 'Original claim-association plan');
        equal(associations.importedPlanHash, receipt.planHash, 'Imported claim-association plan');
        assert.deepEqual(associations.additions, [{ segmentId: 'same-run', claimId: 'c-base', scope: 'on-screen-only' }]);
        const expected = structuredClone(originalPlan.segments);
        const last = expected.find(segment => segment.id === 'same-run');
        assert(last && !last.claimIds.includes('c-base'), 'Explicit new on-screen claim association');
        last.claimIds.push('c-base');
        assert.deepEqual(plan.segments, expected, 'Only the approved on-screen association may change; spoken narration is preserved');
      } else {
        assert.deepEqual(originalPlan.segments, plan.segments, 'Import preserves the complete approved narration');
      }
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
  return { topic, format, outputHash: output, sourceHash: source, researchHash: research, receiptHash: sha(receiptBytes), receipt, plan, originalPlanHash };
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
  const filename = `${current.topic}/projects/${current.format}/qa/agent-review.json`;
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

export async function verifyCurrentIntroductionEvidence(base, verified) {
  const publication = await json(path.join(base, 'aha-introduction', 'publication.json'));
  equal(publication.schemaVersion, 1, 'Current introduction publication schema');
  equal(publication.status, 'published-current-introduction', 'Current introduction publication status');
  assert.deepEqual(publication.outputs.map(item => item.format).sort(), ['html', 'image'], 'Exactly current introduction HTML and image evidence');
  const selected = verified.filter(item => item.topic === 'aha-introduction' && ['html', 'image'].includes(item.format));
  assert.deepEqual(selected.map(item => item.format).sort(), ['html', 'image'], 'Exactly verified introduction HTML and image');
  for (const record of publication.outputs) {
    const current = selected.find(item => item.format === record.format);
    currentIdentity(record, current, 'Current introduction publication');
    const { format } = current;
    await verifySealedEvidence(base, [{
      file: `aha-introduction/${format === 'html' ? 'index.html' : 'overview.png'}`, sha256: current.outputHash,
    }]);
    const qa = `aha-introduction/projects/${format}/qa`;
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
      const output = { file: 'aha-introduction/overview.png', sha256: current.outputHash };
      await verifyPngEvidence(base, output, 1080, 1920);
      reviewedFiles = [record.observations, preview, output];
    }
    await verifyCurrentAgentReview(base, record.review, current, reviewedFiles);
  }
}

export async function verifyPptxEvidence(base, verified) {
  const publication = await json(path.join(base, 'pptx-publication.json'));
  equal(publication.schemaVersion, 1, 'Current PPTX publication schema');
  equal(publication.status, 'published-current-pptx', 'Current PPTX publication status');
  equal(publication.skill.name, 'aha-explain', 'PPTX skill provenance');
  assert.match(publication.skill.sourceRevision, /^[a-f0-9]{40}$/, 'PPTX skill source revision');
  assert(publication.skill.guideHashes && Object.keys(publication.skill.guideHashes).length > 0, 'Frozen guide hashes');
  for (const value of Object.values(publication.skill.guideHashes)) hash(value, 'Frozen guide hash');
  hash(publication.runtimeHash, 'Recorded runtime hash');
  assert.deepEqual(publication.outputs.map(item => item.topic).sort(), [...pptxTopics].sort(), 'Exactly four unique current PPTX topics');
  assert.deepEqual(verified.filter(item => item.format === 'pptx').map(item => item.topic).sort(),
    [...pptxTopics].sort(), 'Exactly four verified PPTX outputs');
  for (const record of publication.outputs) {
    const { topic } = record;
    const current = verified.find(item => item.topic === topic && item.format === 'pptx');
    for (const key of ['sourceHash', 'researchHash', 'outputHash', 'receiptHash']) {
      hash(record[key], `PPTX publication ${key}`);
      equal(record[key], current[key], `PPTX publication ${key}`);
    }
    equal(record.slides, topics[topic].slides, 'PPTX publication slide count');
    equal(record.language, 'zh', 'PPTX publication language');
    if (topic === 'aha-introduction') {
      assert.deepEqual(record.origin, { generation: 'current-skill-authoring' }, 'Introduction PPTX is current authoring, not a recovered candidate');
      equal(record.visualReview.status, 'reviewed-current', 'Introduction PPTX requires current agent visual review');
    } else {
      equal(record.origin.generation, 'latest-iterated-skill-candidate', 'PPTX candidate generation');
      hash(record.origin.candidateSourceHash, 'Candidate source hash');
      hash(record.origin.candidateOutputHash, 'Candidate output hash');
      equal(typeof record.origin.sourceRelocated, 'boolean', 'Explicit candidate source relocation');
      equal(record.visualReview.status, 'bounded-historical', 'Do not promote application checks to independent visual acceptance');
    }
    assert(Array.isArray(record.visualReview.limitations) && record.visualReview.limitations.length > 0
      && record.visualReview.limitations.every(item => typeof item === 'string' && item.trim()), 'Explicit visual review limitations');
    const qa = `${topic}/projects/pptx/qa`;
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
    const bytes = await readFile(path.join(base, topic, `${basenameFor(topic, 'pptx')}.pptx`));
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

async function verifyEvidence(evaluation, verified) {
  const production = await json(path.join(evaluation, 'production-status.json'));
  const review = await json(path.join(evaluation, 'final-visual-review.json'));
  assert.equal(review.residual_defects.length, 0, 'Final bounded review defects');
  for (const topic of historicalBrowserTopics) {
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
  }
  const recheckFile = path.join(evaluation, 'browser-recheck', 'runtime.json');
  const recheck = await optionalJson(recheckFile);
  if (recheck) {
    assert.deepEqual(recheck.failures, []);
    // Archived observations retain retired topics; only current outputs are validated here.
    // Git's current Chinese plan review has separate evidence; its old bilingual page is historical.
    const currentCases = recheck.cases.filter(record => record.topic === 'anc');
    const expected = ['anc'].flatMap(topic => [1280, 390].flatMap(width =>
      ['light', 'dark'].flatMap(theme => ['en', 'zh'].map(language => `${topic}-${width}-${theme}-${language}`))));
    assert.deepEqual(currentCases.map(item => item.id).sort(), expected.sort(), 'Current browser case identities in historical evidence');
    for (const record of currentCases) {
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
  // The complete archive remains sealed, but only CPython is still the current scene.
  for (const topic of ['cpython-string']) {
    const video = verified.find(item => item.topic === topic && item.format === 'video');
    const entry = publication.outputs.find(item => item.topic === topic);
    for (const key of ['sourceHash', 'researchHash']) equal(entry[key], video[key], `Pilot publication ${key}`);
    equal(entry.sha256, video.outputHash, 'Pilot publication output');
    equal(entry.frames, topics[topic].frames, 'Pilot publication frames');
    const approval = approvals.narrationAndNetwork.plans.find(item => item.topic === topic);
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
    equal(end('ascii-baseline').codePointWidthBytes, 1, 'ASCII storage');
    equal(end('whole-string-widens').codePointWidthBytes, 4, 'Non-BMP result storage');
    equal(end('whole-string-widens').originalStrIsUnchanged, true, 'Immutable original string');
    equal(end('utf8-contrast').result.utf8Bytes - end('utf8-contrast').baseline.utf8Bytes, 4, 'UTF-8 payload delta');
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

export async function verifyTaskVideoEvidence(directory, verified) {
  const publication = await json(path.join(directory, 'publication.json'));
  equal(publication.schemaVersion, 1, 'Task/video publication schema');
  equal(publication.status, 'published-with-bounded-review', 'Task/video publication status');
  equal(publication.listening, 'unperformed', 'Preserve task/video listening boundary');
  equal(publication.humanComprehension, 'unperformed', 'Preserve task/video comprehension boundary');
  equal(publication.videoDensity, 'partial-improvement', 'Preserve residual video density limitation');
  assert.deepEqual(publication.outputs.map(item => `${item.topic}/${item.format}`).sort(), ['docker-layers/video', 'git-merge/html']);
  const sealed = await verifySealedEvidence(directory, publication.evidence);
  for (const file of ['execution-consent.json', 'skill-provenance.json', 'benchmark.json', 'retention.json']) {
    assert(sealed.includes(file), 'Task/video provenance must be sealed');
  }
  const consent = await json(path.join(directory, 'execution-consent.json'));
  equal(consent.userAnswer, '批准本轮离线导入、渲染和验证', 'Task/video execution approval');
  for (const entry of publication.outputs) {
    const current = verified.find(item => item.topic === entry.topic && item.format === entry.format);
    assert(current, 'Current task/video output exists');
    for (const key of ['sourceHash', 'researchHash', 'receiptHash']) equal(entry[key], current[key], `Task/video publication ${key}`);
    equal(entry.sha256, current.outputHash, 'Task/video publication output');
    const name = entry.format === 'html' ? 'browser' : 'media';
    equal(entry.observations, `${entry.topic}/${name}-observations.json`, 'Canonical task/video observations');
    equal(entry.review, `${entry.topic}/review.json`, 'Canonical task/video review');
    for (const file of [entry.observations, entry.review, `${entry.topic}/grading.json`]) assert(sealed.includes(file), 'Current task/video evidence required');
    const review = await json(path.join(directory, entry.review));
    for (const key of ['sourceHash', 'researchHash', 'outputHash']) equal(review[key], current[key], `Task/video review ${key}`);
    equal(review.status, 'bounded-agent-review', 'Bounded task/video review');
    assert(review.limitations.length > 0, 'Task/video review limitations');
    assert(review.pixelsReviewed.length > 0, 'Task/video reviewed pixels');
    for (const image of review.pixelsReviewed) {
      assert(sealed.includes(`${entry.topic}/${image}`), 'Reviewed task/video image is sealed');
      const png = await readFile(path.join(directory, entry.topic, image));
      assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'Task/video evidence is PNG');
    }
    const observations = await json(path.join(directory, entry.observations));
    if (entry.format === 'html') {
      assert.deepEqual(observations.errors, []);
      assert.deepEqual(observations.blocked, []);
      assert.deepEqual(observations.observations.map(item => item.width), [1280, 390, 320], 'Current Git viewport evidence');
      for (const viewport of observations.observations) {
        equal(viewport.language, 'zh-CN', 'Current Git Chinese evidence');
        assert(viewport.scrollWidth <= viewport.width, 'Current Git overflow');
        assert.deepEqual(viewport.overflowRegions, [], 'Current Git argument needs no horizontal scrolling');
        equal(viewport.keyboardAnchor, '#ref-revert', 'Current Git keyboard anchor');
        const file = `${entry.topic}/html-${viewport.width}.png`;
        assert(sealed.includes(file), 'Current Git viewport screenshot');
        equal((await readFile(path.join(directory, file))).readUInt32BE(16), viewport.width, 'Current Git screenshot width');
      }
    } else {
      equal(entry.provider, 'provided-audio', 'Current Docker imported recording');
      const approved = consent.plans.find(item => item.condition === 'with_skill');
      equal(approved?.planHash, current.receipt.planHash, 'Current Docker approved plan');
      equal(approved?.sourceHash, current.sourceHash, 'Current Docker approved source');
      equal(observations.fullDecode, 'passed', 'Current Docker decode');
      equal(observations.playback.ended, true, 'Current Docker playback');
      equal(observations.playback.error, null, 'Current Docker playback error');
      equal(observations.playback.width, 1280, 'Current Docker playback width');
      equal(observations.playback.height, 720, 'Current Docker playback height');
      assert.match(observations.listening, /^unperformed/, 'Current Docker listening remains unperformed');
      const file = `${entry.topic}/source-diagnostics.json`;
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
  equal(manifest.pptxPublication, 'pptx-publication.json', 'Required canonical current PPTX publication');
  equal(manifest.introductionPublication, 'aha-introduction/publication.json', 'Required canonical current introduction publication');
  const verified = [];
  for (const entry of manifest.requestedOutputs) verified.push(await verifyOutput(base, entry));
  await verifyPptxEvidence(base, verified);
  await verifyCurrentIntroductionEvidence(base, verified);
  await verifyEvidence(evaluation, verified);
  await verifyGreenlandEvidence(evaluation, verified);
  equal(manifest.codePilotEvaluation, '../evals/examples/code-pilots-20260917/publication.json', 'Canonical code-pilot evidence link');
  await verifyCodePilotEvidence(path.resolve(evaluation, '..', 'code-pilots-20260917'), verified);
  equal(manifest.taskVideoEvaluation, '../evals/examples/task-video-20260922/publication.json', 'Canonical task/video evidence link');
  await verifyTaskVideoEvidence(path.resolve(evaluation, '..', 'task-video-20260922'), verified);
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
    scope: 'Current sealed provenance, runtime-validated native structure, hash-bound PowerPoint/browser observations, WAV timing and exact subtitles; no authored code executed. Historical evidence and current introduction agent reviews remain distinct. Neither constitutes human acceptance, listening, slideshow, manual editing or comprehension review.',
  };
}

export async function main(args = process.argv.slice(2)) {
  assert(args.length <= 1, 'Usage: node --import tsx evals/examples/verify.mjs [new-report.json]');
  const result = await verifyExamples();
  if (args[0]) await writeFile(path.resolve(root, args[0]), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main();
