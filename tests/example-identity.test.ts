import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readDossier } from '../src/research/dossier.js';

const root = fileURLToPath(new URL('../', import.meta.url));

test('current multi-format example retains matching sources, research and receipts', () => {
  const result = execFileSync(process.execPath, ['--import', 'tsx', path.join(root, 'examples', 'project-overview', 'verify.mjs')], {
    cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(JSON.parse(result).status, 'passed');
});

test('Git checkout conversion preserves all sealed examples with autocrlf enabled', async () => {
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
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});
