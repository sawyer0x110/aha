import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { researchFixture } from './helpers/research.js';
import { hashValue } from '../src/core/identity.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(root, 'dist', 'cli', 'aha.mjs');

function invoke(cwd: string, args: string[], entry = cli, status = 0, environment: NodeJS.ProcessEnv = {}): string {
  const result = spawnSync(process.execPath, [entry, ...args], {
    cwd, encoding: 'utf8', timeout: 120000, env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '', ...environment },
  });
  if (result.error) throw result.error;
  assert.equal(result.status, status, `${result.stdout}\n${result.stderr}`);
  assert.doesNotThrow(() => JSON.parse(result.stdout), 'CLI returns one machine-readable JSON result');
  return result.stdout;
}

async function temp(action: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aha-cli-'));
  try { await action(dir); }
  finally { await fs.rm(dir, { recursive: true, force: true }); }
}

async function research(dir: string, entry = cli) {
  const draft = researchFixture();
  await fs.writeFile(path.join(dir, 'draft.json'), JSON.stringify(draft));
  invoke(dir, ['research-check', 'draft.json'], entry);
  invoke(dir, ['research-build', 'draft.json', 'topic.research'], entry);
  invoke(dir, ['research-validate', 'topic.research'], entry);
  return draft;
}

async function author(dir: string, format: 'html' | 'pptx', entry = cli): Promise<string> {
  const draft = await research(dir, entry);
  const projectName = `topic-${format}`;
  invoke(dir, ['explain-init', 'topic.research', format, projectName, '--language', 'en'], entry);
  const project = path.join(dir, projectName);
  const file = path.join(project, 'artifact.json');
  const artifact = JSON.parse(await fs.readFile(file, 'utf8'));
  artifact.status = 'authored';
  artifact.coverage = draft.claims.map(claim => ({ id: `section-${claim.id}`, claimIds: [claim.id] }));
  artifact.omissions = [];
  await fs.writeFile(file, JSON.stringify(artifact));
  const source = format === 'html'
    ? `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Research explanation</title></head><body>
      <main><h1>A source-backed mechanism</h1><p>A freely authored article, not a fixed experiment.</p>
      ${draft.claims.map(claim => `<section id="section-${claim.id}"><h2>Evidence and scope</h2><p>${claim.text.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</p></section>`).join('')}
      <table><caption>Observed in supplied material, not live execution</caption><tr><th>Stage</th><th>Meaning</th></tr><tr><td>Read</td><td>Trace the stated rule</td></tr></table>
      </main></body></html>`
    : `export default async function ({pptx}) {
        pptx.layout = 'LAYOUT_WIDE';
        for (let i=0;i<15;i++) {
          const slide = pptx.addSlide();
          slide.addText('Mechanism '+(i+1), {x:0.6,y:0.5,w:11,h:1,fontSize:30});
          slide.addText('Synthetic source explanation', {x:0.6,y:2,w:11,h:1,fontSize:20});
        }
      }`;
  await fs.writeFile(path.join(project, artifact.entry), source);
  invoke(dir, ['explain-check', projectName], entry);
  return projectName;
}

test('CLI and lockfile versions match the package version', async () => temp(async dir => {
  const { version } = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(await fs.readFile(path.join(root, 'package-lock.json'), 'utf8'));
  assert.equal(lock.version, version);
  assert.equal(lock.packages[''].version, version);
  for (const command of ['help', 'doctor']) {
    assert.equal(JSON.parse(invoke(dir, [command])).version, version);
  }
}));

test('model-free research builds a dossier and a freely authored HTML article', async () => temp(async dir => {
  const project = await author(dir, 'html');
  const result = JSON.parse(invoke(dir, ['render-html', project, 'article.html']));
  assert.equal(result.status, 'delivered');
  const html = await fs.readFile(path.join(dir, 'article.html'), 'utf8');
  const receipt = JSON.parse(await fs.readFile(path.join(dir, 'article.html.receipt.json'), 'utf8'));
  assert.equal(receipt.status, 'delivered');
  assert.equal(receipt.outputHash, createHash('sha256').update(html).digest('hex'));
  assert.match(receipt.sourceHash, /^[a-f0-9]{64}$/);
  assert.match(receipt.researchHash, /^[a-f0-9]{64}$/);
  assert.equal('research' in receipt, false);
  assert.match(html, /A freely authored article/);
  assert.match(html, /<table>/);
  assert.doesNotMatch(html, /aha-pack|modelSpec|narrative\.slides/);
  assert.ok((await fs.readdir(path.join(dir, 'topic.research'))).includes('report.md'));
}));

test('draft scaffolds cannot masquerade as completed research or authored output', async () => temp(async dir => {
  invoke(dir, ['research-init', 'An unanswered question', 'empty.json', '--kind', 'public']);
  const original = await fs.readFile(path.join(dir, 'empty.json'));
  const draftCheck = JSON.parse(invoke(dir, ['research-check', 'empty.json', '--draft']));
  assert.equal(draftCheck.status, 'draft-checked');
  assert.equal(draftCheck.ready, false);
  assert.ok(draftCheck.pending.length > 0);
  assert.equal('researchHash' in draftCheck, false);
  assert.deepEqual(await fs.readFile(path.join(dir, 'empty.json')), original);
  invoke(dir, ['research-check', 'empty.json'], cli, 1);
  invoke(dir, ['research-build', 'empty.json', 'draft-mode-not-supported', '--draft'], cli, 1);
  invoke(dir, ['research-build', 'empty.json', 'unearned.research'], cli, 1);
  await assert.rejects(fs.stat(path.join(dir, 'unearned.research')), { code: 'ENOENT' });
  await research(dir);
  invoke(dir, ['explain-init', 'topic.research', 'html', 'draft-project']);
  invoke(dir, ['explain-check', 'draft-project'], cli, 1);
  invoke(dir, ['render-html', 'draft-project', 'not-ready.html'], cli, 1);
  await assert.rejects(fs.stat(path.join(dir, 'not-ready.html')), { code: 'ENOENT' });
}));

test('research import rejects malformed UTF-8 before creating a dossier', async () => temp(async dir => {
  const text = JSON.stringify({ ...researchFixture(), title: 'encoding-marker' });
  const marker = text.indexOf('encoding-marker');
  const bytes = Buffer.concat([Buffer.from(text.slice(0, marker)), Buffer.from([0xff]), Buffer.from(text.slice(marker + 1))]);
  await fs.writeFile(path.join(dir, 'invalid.json'), bytes);
  for (const args of [
    ['research-check', 'invalid.json'],
    ['research-check', 'invalid.json', '--draft'],
    ['research-build', 'invalid.json', 'invalid.research'],
  ]) {
    const result = JSON.parse(invoke(dir, args, cli, 1));
    assert.equal(result.error.code, 'FILE_ENCODING');
  }
  await assert.rejects(fs.stat(path.join(dir, 'invalid.research')), { code: 'ENOENT' });
  assert.deepEqual(await fs.readFile(path.join(dir, 'invalid.json')), bytes);
}));

test('scoped doctor does not require optional media tools for research, HTML or PPTX', async () => temp(async dir => {
  for (const target of ['research', 'html', 'pptx']) {
    const result = JSON.parse(invoke(dir, ['doctor', '--for', target], cli, 0, {
      AHA_PYTHON: path.join(dir, 'missing-python'),
      AHA_FFMPEG: path.join(dir, 'missing-ffmpeg'),
      AHA_FFPROBE: path.join(dir, 'missing-ffprobe'),
      AHA_BROWSER_EXECUTABLE: path.join(dir, 'missing-browser'),
    }));
    assert.equal(result.status, 'ok');
    assert.equal(result.dependencyScope, target);
    assert.deepEqual(result.requiredProbes, []);
    assert.equal('pythonRuntime' in result, false);
  }
  assert.match(invoke(dir, ['doctor', '--for', 'image', '--media'], cli, 1), /USAGE/);
  assert.match(invoke(dir, ['doctor', '--for', 'unknown'], cli, 1), /USAGE/);
}));

test('CLI language defaults and explicit Chinese apply without changing research', async () => temp(async dir => {
  await research(dir);
  const original = await fs.readFile(path.join(dir, 'topic.research', 'manifest.json'));
  const defaults = JSON.parse(invoke(dir, ['explain-init', 'topic.research', 'html', 'bilingual']));
  assert.equal(defaults.language, 'bilingual');
  for (const format of ['image', 'pptx', 'video']) {
    assert.equal(JSON.parse(invoke(dir, ['explain-init', 'topic.research', format, `en-${format}`])).language, 'en');
    assert.equal(JSON.parse(invoke(dir, ['explain-init', 'topic.research', format, `zh-${format}`, '--language', 'zh'])).language, 'zh');
    assert.match(invoke(dir, ['explain-init', 'topic.research', format, `bad-${format}`, '--language', 'bilingual'], cli, 1), /ARTIFACT_LANGUAGE/);
  }
  assert.match(invoke(dir, ['explain-init', 'topic.research', 'html', 'invalid', '--language', 'fr'], cli, 1), /ARTIFACT_LANGUAGE/);
  await assert.rejects(fs.stat(path.join(dir, 'invalid')), { code: 'ENOENT' });
  assert.deepEqual(await fs.readFile(path.join(dir, 'topic.research', 'manifest.json')), original);
}));
test('HTML publication is stable and refuses overwrite, wrong extension and source destinations', async () => temp(async dir => {
  const project = await author(dir, 'html');
  invoke(dir, ['render-html', project, 'one.html']);
  invoke(dir, ['render-html', project, 'two.html']);
  const original = await fs.readFile(path.join(dir, 'one.html'));
  assert.deepEqual(original, await fs.readFile(path.join(dir, 'two.html')));
  invoke(dir, ['render-html', project, 'one.html'], cli, 1);
  assert.deepEqual(original, await fs.readFile(path.join(dir, 'one.html')));
  assert.match(invoke(dir, ['render-html', project, 'wrong.mp4'], cli, 1), /OUTPUT_EXTENSION/);
  invoke(dir, ['render-html', project, path.join(project, 'published.html')], cli, 1);
  await assert.rejects(fs.stat(path.join(dir, project, 'published.html')), { code: 'ENOENT' });
}));

test('native PPTX authoring accepts more than twelve slides and requires code permission', async () => temp(async dir => {
  const project = await author(dir, 'pptx');
  const checked = JSON.parse(invoke(dir, ['explain-check', project]));
  assert.equal(checked.ready, true);
  assert.equal(checked.readability.status, 'not-checked');
  assert.match(checked.readability.reason, /not executed/);
  assert.match(invoke(dir, ['render-pptx', project, 'deck.pptx'], cli, 1), /allow-code/);
  await assert.rejects(fs.stat(path.join(dir, 'deck.pptx')), { code: 'ENOENT' });
  invoke(dir, ['render-pptx', project, 'deck.pptx', '--allow-code']);
  const zip = await JSZip.loadAsync(await fs.readFile(path.join(dir, 'deck.pptx')));
  assert.equal(Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length, 15);
  const first = await zip.file('ppt/slides/slide1.xml')!.async('string');
  assert.match(first, /Mechanism 1/);
  assert.match(first, /<p:sp>/);
}));

test('legacy aliases and invalid options fail without substitutes', async () => temp(async dir => {
  for (const command of ['render-lab', 'build-pack', 'export-exploration', 'example', 'init']) {
    assert.match(invoke(dir, [command], cli, 1), /COMMAND_UNKNOWN/);
  }
  assert.match(invoke(dir, ['research-init', 'Question', 'draft.json', '--kind', 'arbitrary'], cli, 1), /SCHEMA_INVALID/);
  assert.match(invoke(dir, ['doctor', '--allow-network'], cli, 1), /USAGE/);
  assert.match(invoke(dir, ['doctor', '--media', '--media'], cli, 1), /Duplicate/);
  assert.deepEqual(await fs.readdir(dir), []);
}));

test('advisory copy lint has machine-readable warnings, preserves files and rejects code or invalid input', async () => temp(async dir => {
  const text = 'Utilize the cache in order to show the result.';
  await fs.writeFile(path.join(dir, 'copy.txt'), text);
  const result = JSON.parse(invoke(dir, ['explain-lint', 'copy.txt', '--format', 'pptx']));
  assert.equal(result.status, 'checked');
  assert.equal(result.mode, 'advisory');
  assert.equal(result.format, 'pptx');
  assert.equal(result.warningCount, 2);
  assert.equal(result.warnings[0].location.line, 1);
  assert.equal(result.warnings[0].location.file, path.join(dir, 'copy.txt'));
  assert.equal(await fs.readFile(path.join(dir, 'copy.txt'), 'utf8'), text);
  await fs.writeFile(path.join(dir, 'unsafe.mjs'), 'throw new Error("never execute copy lint input");');
  await fs.writeFile(path.join(dir, 'plan.json'), '{}');
  await fs.writeFile(path.join(dir, 'invalid.txt'), Buffer.from([0xff]));
  assert.match(invoke(dir, ['explain-lint', 'unsafe.mjs'], cli, 1), /READABILITY_INPUT/);
  assert.match(invoke(dir, ['explain-lint', 'copy.txt', '--format', 'all'], cli, 1), /ARTIFACT_FORMAT/);
  assert.match(invoke(dir, ['explain-lint', 'copy.txt', '--strict'], cli, 1), /USAGE/);
  assert.match(invoke(dir, ['explain-lint', 'plan.json'], cli, 1), /SCHEMA_INVALID/);
  assert.match(invoke(dir, ['explain-lint', 'plan.json', '--format', 'html'], cli, 1), /READABILITY_INPUT/);
  assert.match(invoke(dir, ['explain-lint', 'invalid.txt'], cli, 1), /FILE_ENCODING/);
  assert.match(invoke(dir, ['explain-lint', 'missing.txt'], cli, 1), /ENOENT/);
}));

test('project checks include advisory copy feedback without changing readiness, source or publication', async () => temp(async dir => {
  const project = await author(dir, 'html');
  const file = path.join(dir, project, 'html', 'index.html');
  const source = (await fs.readFile(file, 'utf8')).replace('</main>', '<p>Utilize the cache.</p></main>');
  await fs.writeFile(file, source);
  const result = JSON.parse(invoke(dir, ['explain-check', project]));
  assert.equal(result.ready, true);
  assert.equal(result.readability.mode, 'advisory');
  assert.equal(result.readability.warningCount, 1);
  assert.equal(result.readability.warnings[0].location.file, 'html/index.html');
  const receipt = JSON.parse(invoke(dir, ['render-html', project, 'linted.html']));
  assert.equal(receipt.sourceHash, result.sourceHash);
  assert.equal(await fs.readFile(file, 'utf8'), source);
}));

test('bundled CLI accepts scroll-behavior without weakening actual legacy-property rejection', async () => temp(async dir => {
  const project = await author(dir, 'html');
  const file = path.join(dir, project, 'html', 'index.html');
  const original = await fs.readFile(file, 'utf8');
  for (const [index, entry] of [
    cli,
    path.join(root, 'dist', 'skills', 'aha-explain', 'scripts', 'aha.mjs'),
  ].entries()) {
    const source = original.replace('</main>', '<style>@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }</style></main>');
    await fs.writeFile(file, source);
    const checked = JSON.parse(invoke(dir, ['explain-check', project], entry));
    assert.equal(checked.ready, true);
    const delivered = JSON.parse(invoke(dir, ['render-html', project, `motion-${index}.html`], entry));
    assert.equal(delivered.codeExecuted, false);
    assert.match(await fs.readFile(path.join(dir, `motion-${index}.html`), 'utf8'), /scroll-behavior: auto/);
    assert.equal(await fs.readFile(file, 'utf8'), source);
    for (const property of ['behavior', '-moz-binding']) {
      await fs.writeFile(file, original.replace('</main>', `<p style="${property}:none">No legacy loader.</p></main>`));
      const failed = JSON.parse(invoke(dir, ['explain-check', project], entry, 1));
      assert.equal(failed.error.code, 'HTML_CSS');
      assert.match(failed.error.message, new RegExp(`Unsupported CSS property ${property}`));
    }
  }
}));

test('video-plan checks lint narration without changing the plan hash or recording approval', async () => temp(async dir => {
  const draft = await research(dir);
  invoke(dir, ['explain-init', 'topic.research', 'video', 'video-project']);
  const metadata = path.join(dir, 'video-project', 'artifact.json');
  const artifact = JSON.parse(await fs.readFile(metadata, 'utf8'));
  artifact.coverage = draft.claims.map(claim => ({ id: `section-${claim.id}`, claimIds: [claim.id] }));
  await fs.writeFile(metadata, JSON.stringify(artifact));
  invoke(dir, ['prepare-video', 'video-project', 'plan.json']);
  const file = path.join(dir, 'plan.json');
  const plan = JSON.parse(await fs.readFile(file, 'utf8'));
  plan.segments[0].text = 'Utilize the cache.';
  await fs.writeFile(file, JSON.stringify(plan));
  const original = await fs.readFile(file);
  const result = JSON.parse(invoke(dir, ['video-plan-check', 'video-project', 'plan.json']));
  assert.equal(result.approvalRecorded, false);
  assert.equal(result.readability.warningCount, 1);
  assert.equal(result.readability.warnings[0].location.locator, '/segments/0/text (sentence-1)');
  assert.equal(result.planHash, await hashValue(plan));
  assert.deepEqual(await fs.readFile(file), original);
  const standalone = JSON.parse(invoke(dir, ['explain-lint', 'plan.json']));
  assert.deepEqual(standalone.warnings, result.readability.warnings);
}));

test('both packaged skills operate from an unrelated directory with their bundled runtime', async () => temp(async dir => {
  const names = ['aha-research', 'aha-explain'];
  assert.deepEqual((await fs.readdir(path.join(root, 'dist', 'skills'))).sort(), [...names].sort());
  for (const name of names) {
    const install = path.join(dir, `installed-${name}`);
    await fs.cp(path.join(root, 'dist', 'skills', name), install, { recursive: true });
    const entry = path.join(install, 'scripts', 'aha.mjs');
    const cwd = path.join(dir, `unrelated-${name}`);
    await fs.mkdir(cwd);
    const doctor = JSON.parse(invoke(cwd, ['doctor'], entry));
    assert.deepEqual(doctor.skills, names);
    assert.equal(doctor.capabilities.research, true);
    assert.equal(doctor.capabilities.freeHtml, true);
    assert.equal(doctor.capabilities.video, true);
    assert.equal(doctor.capabilities.pptx, true);
    assert.equal(doctor.capabilities.realExecution, false);
    const project = await author(cwd, 'html', entry);
    const copy = JSON.parse(invoke(cwd, ['explain-lint', path.join(project, 'html', 'index.html')], entry));
    assert.equal(copy.mode, 'advisory');
    assert.equal(copy.codeExecuted, false);
    invoke(cwd, ['render-html', project, 'explanation.html'], entry);
    const manifest = JSON.parse(await fs.readFile(path.join(install, 'runtime-manifest.json'), 'utf8'));
    const { version } = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
    assert.equal(manifest.version, version);
    assert.equal(doctor.version, version);
    assert.equal(JSON.parse(invoke(cwd, ['help'], entry)).version, version);
    for (const [relative, expected] of Object.entries(manifest.files)) {
      assert.equal(createHash('sha256').update(await fs.readFile(path.join(install, ...relative.split('/')))).digest('hex'), expected);
    }
    assert.match(await fs.readFile(path.join(install, 'SKILL.md'), 'utf8'), new RegExp(`name: ${name}`));
  }
}));
