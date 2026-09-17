import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { sourceHash } from '../src/artifacts/project.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = path.join(root, 'examples');
const evaluation = path.join(root, 'evals', 'examples');
const { verifyExamples, verifyOutput, verifyCodePilotEvidence, verifyIntroductionEvidence, sha } = await import(pathToFileURL(path.join(evaluation, 'verify.mjs')).href);
const manifest = JSON.parse(await fs.readFile(path.join(base, 'delivery-manifest.json'), 'utf8'));

test('all sixteen requested outputs bind canonical research, source, receipts, approved audio and final QA', async () => {
  const result = await verifyExamples();
  assert.equal(result.status, 'passed');
  assert.equal(result.outputs.length, 16);
  for (const topic of ['greenland', 'cpython-string', 'docker-layers', 'aha-introduction']) {
    assert.deepEqual(result.outputs.filter((entry: { topic: string }) => entry.topic === topic)
      .map((entry: { format: string }) => entry.format), ['video']);
  }
  for (const topic of ['anc', 'git-merge', 'project-overview']) {
    assert.deepEqual(result.outputs.filter((entry: { topic: string }) => entry.topic === topic)
      .map((entry: { format: string }) => entry.format).sort(), ['html', 'image', 'pptx', 'video']);
  }
});

test('each current output rejects stale publication source, research and output hashes', async t => {
  for (const entry of manifest.requestedOutputs) {
    for (const field of ['sourceHash', 'researchHash', 'sha256']) {
      await t.test(`${entry.topic}/${entry.format}/${field}`, async () => {
        await assert.rejects(verifyOutput(base, { ...entry, [field]: '0'.repeat(64) }), /hash/i);
      });
    }
  }
});

test('publication manifest requires exactly one of every topic and format', async () => {
  await assert.rejects(verifyExamples({ manifest: { ...manifest, requestedOutputs: manifest.requestedOutputs.slice(1) } }), /sixteen/);
  const entries = [...manifest.requestedOutputs];
  entries[1] = entries[0];
  await assert.rejects(verifyExamples({ manifest: { ...manifest, requestedOutputs: entries } }));
});

test('gallery links resolve and list only requested formats, including video-only pilots', async () => {
  const gallery = await fs.readFile(path.join(base, 'index.html'), 'utf8');
  const links = [...gallery.matchAll(/href="([^"]+)"/g)].map(match => match[1]!);
  for (const link of links) await fs.access(path.join(base, link));
  for (const entry of manifest.requestedOutputs) assert(links.includes(entry.file));
  assert(links.includes('greenland/README.md'));
  assert(!links.includes('greenland/index.html'));
  assert(!links.includes('greenland/greenland.pptx'));
  assert(!links.includes('greenland/greenland.png'));
  for (const topic of ['cpython-string', 'docker-layers', 'aha-introduction']) {
    assert(links.includes(`${topic}/README.md`));
    assert(!links.some(link => link.startsWith(`${topic}/`) && /\.(html|png|pptx)$/.test(link)));
  }
});

test('Greenland keeps its direct speech provider rather than fabricating an imported-audio origin', async () => {
  const entry = manifest.requestedOutputs.find((item: { topic: string }) => item.topic === 'greenland');
  const result = await verifyOutput(base, entry);
  assert.equal(result.plan.provider, 'edge-tts');
  assert.equal(result.originalPlanHash, undefined);
  await assert.rejects(verifyOutput(base, { ...entry, provider: 'provided-audio' }), /provider/i);
  await assert.rejects(verifyOutput(base, { ...entry, format: 'html' }), /Unrequested format/);
});

test('both code pilots retain direct speech, video-only scope and current evidence', async () => {
  const verified = [];
  for (const topic of ['cpython-string', 'docker-layers']) {
    const entry = manifest.requestedOutputs.find((item: { topic: string }) => item.topic === topic);
    const result = await verifyOutput(base, entry);
    verified.push(result);
    assert.equal(result.plan.provider, 'edge-tts');
    assert.equal(result.originalPlanHash, undefined);
    await assert.rejects(verifyOutput(base, { ...entry, provider: 'provided-audio' }), /provider/i);
    await assert.rejects(verifyOutput(base, { ...entry, format: 'html' }), /Unrequested format/);
  }
  const workspace = await fs.mkdtemp(path.join(evaluation, '.pilot-evidence-'));
  try {
    await fs.cp(path.join(evaluation, 'code-pilots-20260917'), workspace, { recursive: true });
    await verifyCodePilotEvidence(workspace, verified);
    const filename = path.join(workspace, 'docker-layers', 'encoded', 'technical-review.json');
    const report = JSON.parse(await fs.readFile(filename, 'utf8'));
    report.artifactHash = '0'.repeat(64);
    await fs.writeFile(filename, JSON.stringify(report));
    await assert.rejects(verifyCodePilotEvidence(workspace, verified), /evidence hash/i);
  } finally { await fs.rm(workspace, { recursive: true, force: true }); }
});

test('new introduction preserves original speech source and rejects resealed wrong encoded evidence', async () => {
  const entry = manifest.requestedOutputs.find((item: { topic: string }) => item.topic === 'aha-introduction');
  const result = await verifyOutput(base, entry);
  assert.equal(result.plan.provider, 'provided-audio');
  await assert.rejects(verifyOutput(base, { ...entry, provider: 'edge-tts' }), /provider/i);
  const workspace = await fs.mkdtemp(path.join(evaluation, '.introduction-identity-'));
  try {
    const original = JSON.parse(await fs.readFile(path.join(base, 'aha-introduction', 'audio-origin', 'original-plan.json'), 'utf8'));
    const reconstructed = path.join(workspace, 'original-source');
    await fs.cp(path.join(base, 'aha-introduction', 'projects', 'video'), reconstructed, { recursive: true });
    await fs.copyFile(path.join(base, 'aha-introduction', 'audio-origin', 'original-scenes.js'), path.join(reconstructed, 'html', 'scenes.js'));
    assert.equal(await sourceHash(reconstructed), original.sourceHash);
    assert.notEqual(original.sourceHash, result.sourceHash);
    const evidence = path.join(workspace, 'evidence');
    await fs.cp(path.join(evaluation, 'aha-introduction-20260917'), evidence, { recursive: true });
    await verifyIntroductionEvidence(evidence, [result]);
    const reportFile = path.join(evidence, 'encoded', 'technical-review.json');
    const report = JSON.parse(await fs.readFile(reportFile, 'utf8'));
    report.artifactHash = '0'.repeat(64);
    await fs.writeFile(reportFile, JSON.stringify(report));
    const publicationFile = path.join(evidence, 'publication.json');
    const publication = JSON.parse(await fs.readFile(publicationFile, 'utf8'));
    publication.evidence.find((item: { file: string }) => item.file === 'encoded/technical-review.json').sha256 = sha(await fs.readFile(reportFile));
    await fs.writeFile(publicationFile, JSON.stringify(publication));
    await assert.rejects(verifyIntroductionEvidence(evidence, [result]), /encoded identity/i);
  } finally { await fs.rm(workspace, { recursive: true, force: true }); }
});

test('actual stale receipt, source, dossier, audio, plan and subtitle bytes fail validation', async t => {
  const workspace = await fs.mkdtemp(path.join(evaluation, '.identity-fixture-'));
  const entries = manifest.requestedOutputs.filter((entry: { topic: string }) => entry.topic === 'anc');
  try {
    await fs.cp(path.join(base, 'anc'), path.join(workspace, 'anc'), { recursive: true });
    const html = entries.find((entry: { format: string }) => entry.format === 'html');
    const video = entries.find((entry: { format: string }) => entry.format === 'video');
    const mutate = async (name: string, relative: string, entry: object, change: (bytes: Buffer) => Buffer | string) => {
      await t.test(name, async () => {
        const filename = path.join(workspace, 'anc', relative);
        const original = await fs.readFile(filename);
        try {
          await fs.writeFile(filename, change(original));
          await assert.rejects(verifyOutput(workspace, entry));
        } finally { await fs.writeFile(filename, original); }
      });
    };
    await mutate('receipt hash', 'index.html.receipt.json', html, bytes => {
      const receipt = JSON.parse(bytes.toString()); receipt.outputHash = '0'.repeat(64);
      return JSON.stringify(receipt);
    });
    await mutate('source bytes', path.join('projects', 'html', 'html', 'index.html'), html, bytes => Buffer.concat([bytes, Buffer.from('\n')]));
    await mutate('canonical dossier', path.join('research', 'report.md'), html, bytes => Buffer.concat([bytes, Buffer.from('\nChanged research.\n')]));
    await mutate('output bytes', 'index.html', html, bytes => Buffer.concat([bytes, Buffer.from('\n')]));
    await mutate('audio hash', path.join('audio', 'manifest.json'), video, bytes => {
      const audio = JSON.parse(bytes.toString()); audio.segments[0].sha256 = '0'.repeat(64);
      return JSON.stringify(audio);
    });
    await mutate('audio waveform', path.join('audio', 'segment-001.wav'), video, bytes => {
      const changed = Buffer.from(bytes); changed[changed.length - 1] = changed[changed.length - 1]! ^ 1; return changed;
    });
    await mutate('plan binding', 'video-plan.json', video, bytes => {
      const plan = JSON.parse(bytes.toString()); plan.segments[0].text += ' Changed narration.';
      return JSON.stringify(plan);
    });
    await mutate('subtitle bytes', 'anc.mp4.srt', video, bytes => Buffer.concat([bytes, Buffer.from('\n')]));
    await mutate('original recording hash', path.join('audio-origin', 'recordings.json'), video, bytes => {
      const recordings = JSON.parse(bytes.toString()); recordings.recordings[0].sha256 = '0'.repeat(64);
      return JSON.stringify(recordings);
    });
    await mutate('original narration', path.join('audio-origin', 'original-plan.json'), video, bytes => {
      const plan = JSON.parse(bytes.toString()); plan.segments[0].text += ' Changed original narration.';
      return JSON.stringify(plan);
    });
    await mutate('original failure plan binding', path.join('audio-origin', 'failure.json'), video, bytes => {
      const failure = JSON.parse(bytes.toString()); failure.planHash = '0'.repeat(64);
      return JSON.stringify(failure);
    });
  } finally { await fs.rm(workspace, { recursive: true, force: true }); }
});

test('browser and generic media playback tools require approval independently of cwd', () => {
  for (const script of ['check-html.mjs', path.join('project-overview', 'check-playback.mjs')]) {
    const result = spawnSync(process.execPath, [path.join(evaluation, script)], {
      cwd: path.join(root, 'tests'), encoding: 'utf8', timeout: 30000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Error: (Review|Obtain).*approval/);
    assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND/);
  }
});

test('Git autocrlf preserves all sixteen sealed outputs, source trees, audio and old/new QA', async () => {
  const workspace = await fs.mkdtemp(path.join(evaluation, '.identity-git-'));
  const git = (...args: string[]) => execFileSync('git', args, {
    cwd: workspace, timeout: 60000, maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(workspace, 'empty.gitconfig') },
  });
  const files: string[] = [];
  const collect = async (directory: string) => {
    for (const entry of await fs.readdir(path.join(root, directory), { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await collect(filename);
      else if (entry.isFile()) files.push(filename);
    }
  };
  try {
    await fs.writeFile(path.join(workspace, 'empty.gitconfig'), '');
    git('init', '--quiet');
    git('config', 'core.autocrlf', 'true');
    files.push(path.join('examples', '.gitattributes'), path.join('examples', 'delivery-manifest.json'));
    for (const topic of ['anc', 'git-merge', 'project-overview', 'greenland', 'cpython-string', 'docker-layers', 'aha-introduction']) await collect(path.join('examples', topic));
    await collect(path.join('evals', 'examples', 'greenland-20260917'));
    await collect(path.join('evals', 'examples', 'code-pilots-20260917'));
    await collect(path.join('evals', 'examples', 'aha-introduction-20260917'));
    const qaFiles = [
      '.gitattributes', 'anc-git/runtime.json', 'anc-git/review.json',
      'anc-git/screenshots/anc-390-light-zh-opening.png', 'project-overview/runtime.json',
      'refresh-20260916/final-visual-review.json', 'refresh-20260916/production-status.json',
      ...['anc', 'git-merge', 'project-overview'].flatMap(topic => [
        `refresh-20260916/${topic}/browser-observations.json`,
        `refresh-20260916/${topic}/media-check.json`,
        `refresh-20260916/${topic}/slides/native-observations.json`,
        `refresh-20260916/${topic}/slides/slide-01.png`,
      ]),
    ];
    files.push(...qaFiles.map(file => path.join('evals', 'examples', ...file.split('/'))));
    for (const file of files) {
      const target = path.join(workspace, file);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(path.join(root, file), target);
    }
    git('add', '--', 'examples', 'evals');
    // Re-materialize from Git rather than testing a hand-selected text-only subset.
    for (const file of files) await fs.rm(path.join(workspace, file));
    git('checkout-index', '--all', '--force');
    for (const file of files) {
      assert.deepEqual(await fs.readFile(path.join(workspace, file)), await fs.readFile(path.join(root, file)), `${file}: checkout must retain sealed bytes`);
    }
    for (const entry of manifest.requestedOutputs) {
      const { topic, format } = entry;
      const project = path.join('examples', topic, 'projects', format);
      assert.equal(await sourceHash(path.join(workspace, project)), entry.sourceHash);
    }
  } finally { await fs.rm(workspace, { recursive: true, force: true }); }
});
