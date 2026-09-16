import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readDossier } from '../src/research/dossier.js';
import { checkArtifact, sourceHash } from '../src/artifacts/project.js';

const root = fileURLToPath(new URL('../', import.meta.url));

test('current multi-format example retains matching sources, research and receipts', () => {
  const result = execFileSync(process.execPath, ['--import', 'tsx', path.join(root, 'evals', 'examples', 'project-overview', 'verify.mjs')], {
    cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(JSON.parse(result).status, 'passed');
});

test('single-format examples retain their identities under projects/html', async () => {
  for (const topic of ['anc', 'git-merge']) {
    const example = path.join(root, 'examples', topic);
    const project = path.join(example, 'projects', 'html');
    await checkArtifact(project);
    const receipt = JSON.parse(await fs.readFile(path.join(example, 'index.html.receipt.json'), 'utf8'));
    const research = await readDossier(path.join(example, 'research'));
    assert.deepEqual(await readDossier(path.join(project, 'research')), research);
    assert.equal(receipt.researchHash, research.manifest.contentHash);
    assert.equal(receipt.sourceHash, await sourceHash(project));
    assert.equal(receipt.outputHash, createHash('sha256').update(await fs.readFile(path.join(example, 'index.html'))).digest('hex'));
    await assert.rejects(fs.access(path.join(example, 'project')), { code: 'ENOENT' });
  }
});

test('relocated browser and authoring tools load but require execution approval', () => {
  for (const script of [
    ['evals', 'examples', 'check-html.mjs'],
    ['evals', 'examples', 'project-overview', 'check.mjs'],
    ['evals', 'examples', 'project-overview', 'check-alignment.mjs'],
    ['evals', 'examples', 'project-overview', 'check-playback.mjs'],
    ['examples', 'project-overview', 'tools', 'make-motion-preview.mjs'],
  ]) {
    const result = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), path.join(root, ...script)], {
      cwd: os.tmpdir(), encoding: 'utf8', timeout: 30000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Error: (Review|Obtain).*approval/);
    assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND/);
  }
});

test('Git checkout conversion preserves sealed examples and relocated QA with autocrlf enabled', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'aha-example-git-'));
  const git = (...args: string[]) => execFileSync('git', args, {
    cwd: temporary, timeout: 15000, maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(temporary, 'empty.gitconfig') },
  });
  try {
    await fs.writeFile(path.join(temporary, 'empty.gitconfig'), '');
    git('init', '--quiet');
    git('config', 'core.autocrlf', 'true');
    await fs.mkdir(path.join(temporary, 'examples'));
    await fs.copyFile(path.join(root, 'examples', '.gitattributes'), path.join(temporary, 'examples', '.gitattributes'));
    for (const topic of ['anc', 'git-merge', 'project-overview']) {
      const folder = path.join('examples', topic);
      await fs.mkdir(path.join(temporary, folder, 'research'), { recursive: true });
      const files = ['index.html', 'index.html.receipt.json', 'research/manifest.json', 'research/research.json', 'research/report.md'];
      for (const file of files) {
        await fs.copyFile(path.join(root, folder, file), path.join(temporary, folder, file));
      }
      git('add', '--', 'examples');
      for (const file of files) {
        const filtered = git('cat-file', '--filters', `:examples/${topic}/${file}`);
        assert.deepEqual(filtered, await fs.readFile(path.join(root, folder, file)), `${topic}/${file} must retain its exact bytes`);
        await fs.writeFile(path.join(temporary, folder, file), filtered);
      }
      const receipt = JSON.parse(await fs.readFile(path.join(temporary, folder, 'index.html.receipt.json'), 'utf8'));
      const html = await fs.readFile(path.join(temporary, folder, 'index.html'));
      assert.equal(createHash('sha256').update(html).digest('hex'), receipt.outputHash);
      const dossier = await readDossier(path.join(temporary, folder, 'research'));
      assert.equal(dossier.manifest.contentHash, receipt.researchHash);
    }
    const evaluationFiles = [
      '.gitattributes', 'anc-git/runtime.json', 'anc-git/review.json',
      'anc-git/screenshots/anc-390-light-zh-opening.png', 'project-overview/runtime.json',
    ];
    for (const file of evaluationFiles) {
      const target = path.join(temporary, 'evals', 'examples', file);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(path.join(root, 'evals', 'examples', file), target);
    }
    git('add', '--', 'evals');
    for (const file of evaluationFiles) {
      assert.deepEqual(git('cat-file', '--filters', `:evals/examples/${file}`),
        await fs.readFile(path.join(root, 'evals', 'examples', file)), `QA ${file} must retain its exact bytes`);
    }
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});
