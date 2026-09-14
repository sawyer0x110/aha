import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(root, 'dist', 'cli', 'aha.mjs');

function invoke(cwd: string, args: string[], entry = cli, status = 0): string {
  const result = spawnSync(process.execPath, [entry, ...args], { cwd, encoding: 'utf8', timeout: 30000 });
  if (result.error) throw result.error;
  assert.equal(result.status, status, `${result.stdout}\n${result.stderr}`);
  assert.doesNotThrow(() => JSON.parse(result.stdout), 'CLI must return machine-readable JSON');
  return result.stdout;
}

async function temp(action: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aha-cli-'));
  try { await action(dir); }
  finally { await fs.rm(dir, { recursive: true, force: true }); }
}

test('CLI roundtrip persists Pack, HTML, exploration and Story revision', async () => temp(async dir => {
  invoke(dir, ['init', 'compound', 'draft.json']);
  invoke(dir, ['build-pack', 'draft.json', 'topic.aha']);
  invoke(dir, ['validate', 'topic.aha']);
  assert.match(invoke(dir, ['run', 'topic.aha', 'baseline']), /10800.00/);
  invoke(dir, ['render-lab', 'topic.aha', 'topic.lab.html']);
  invoke(dir, ['export-exploration', 'topic.aha', 'selected.json']);
  invoke(dir, ['import-exploration', 'topic.aha', 'selected.json', 'story.aha']);
  invoke(dir, ['render-slides', 'story.aha', 'topic.slides.html']);
  assert.match(await fs.readFile(path.join(dir, 'topic.lab.html'), 'utf8'), /aha-pack/);
  const slides = await fs.readFile(path.join(dir, 'topic.slides.html'), 'utf8');
  assert.match(slides, /10800.00/);
  assert.match(slides, /11000.00/);
  assert.equal(JSON.parse(await fs.readFile(path.join(dir, 'story.aha', 'manifest.json'), 'utf8')).revision, 2);
  const receiptNames = await fs.readdir(path.join(dir, 'topic.aha', 'receipts'));
  assert.equal(receiptNames.length, 1);
  const receipt = JSON.parse(await fs.readFile(path.join(dir, 'topic.aha', 'receipts', receiptNames[0]!), 'utf8'));
  assert.equal(receipt.artifactHash, createHash('sha256').update(await fs.readFile(path.join(dir, 'topic.lab.html'))).digest('hex'));
  assert.equal(receipt.visualReview, 'not-performed-by-this-command');
}));

test('rendering is deterministic and never overwrites a previous output', async () => temp(async dir => {
  invoke(dir, ['example', 'retry', 'topic.aha']);
  invoke(dir, ['render-lab', 'topic.aha', 'one.html']);
  invoke(dir, ['render-lab', 'topic.aha', 'two.html']);
  const original = await fs.readFile(path.join(dir, 'one.html'));
  assert.deepEqual(original, await fs.readFile(path.join(dir, 'two.html')));
  assert.match(invoke(dir, ['render-lab', 'topic.aha', 'one.html'], cli, 1), /EEXIST/);
  assert.deepEqual(original, await fs.readFile(path.join(dir, 'one.html')));
  assert.match(invoke(dir, ['render-lab', 'topic.aha', 'wrong.mp4'], cli, 1), /OUTPUT_EXTENSION/);
  assert.match(invoke(dir, ['render-lab', 'topic.aha', path.join('topic.aha', 'broken.html')], cli, 1), /OUTPUT_INSIDE_PACK/);
  assert.match(invoke(dir, ['export-exploration', 'topic.aha', path.join('topic.aha', 'selected.json')], cli, 1), /OUTPUT_INSIDE_PACK/);
  invoke(dir, ['validate', 'topic.aha']);
}));

test('unapproved video and arbitrary engine requests fail without substitutes', async () => temp(async dir => {
  assert.match(invoke(dir, ['render-video', 'topic.aha', 'movie.mp4'], cli, 1), /USAGE/);
  assert.match(invoke(dir, ['example', 'arbitrary-js', 'topic.aha'], cli, 1), /SCHEMA_INVALID/);
  assert.match(invoke(dir, ['unknown-command'], cli, 1), /COMMAND_UNKNOWN/);
  assert.deepEqual(await fs.readdir(dir), []);
}));

test('each packaged skill works alone without repository node_modules', async () => temp(async dir => {
  for (const name of ['aha-research', 'aha-lab', 'aha-story']) {
    const install = path.join(dir, `installed ${name}`);
    await fs.cp(path.join(root, 'dist', 'skills', name), install, { recursive: true });
    const entry = path.join(install, 'scripts', 'aha.mjs');
    const cwd = path.join(dir, `unrelated ${name}`);
    await fs.mkdir(cwd);
    const doctor = JSON.parse(invoke(cwd, ['doctor'], entry));
    assert.equal(doctor.capabilities.lab, true);
    assert.equal(doctor.capabilities.slides, true);
    assert.equal(doctor.capabilities.video, true);
    assert.equal(doctor.capabilities.pptx, true);
    assert.match(doctor.mediaReadiness, /not-probed/);
    invoke(cwd, ['example', 'evidence', 'sample.aha'], entry);
    invoke(cwd, ['render-lab', 'sample.aha', 'sample.html'], entry);
    invoke(cwd, ['render-slides', 'sample.aha', 'sample.slides.html'], entry);
    invoke(cwd, ['render-pptx', 'sample.aha', 'sample.pptx'], entry);
    invoke(cwd, ['render-card', 'sample.aha', 'sample.card.html'], entry);
    const manifest = JSON.parse(await fs.readFile(path.join(install, 'runtime-manifest.json'), 'utf8'));
    for (const [relative, expected] of Object.entries(manifest.files)) {
      const file = path.join(install, ...relative.split('/'));
      assert.equal(createHash('sha256').update(await fs.readFile(file)).digest('hex'), expected);
    }
    const skill = await fs.readFile(path.join(install, 'SKILL.md'), 'utf8');
    assert.match(skill, new RegExp(`name: ${name}`));
    assert.match(skill, /description:/);
    assert.ok(!skill.includes('allowed-tools:'));
  }
}));
