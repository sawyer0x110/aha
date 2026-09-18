import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import JSZip from 'jszip';

const root = fileURLToPath(new URL('../', import.meta.url));
// URL imports exercise the same dependency-free .mjs files shipped to recipients.
const distribution = await import(pathToFileURL(path.join(root, 'scripts', 'release.mjs')).href);
const installer = await import(pathToFileURL(path.join(root, 'scripts', 'install-skills.mjs')).href);
const names: string[] = installer.skillNames;
let workspace: string;
let extracted: string;
let release: { archive: string; directory: string; contentHash: string; version: string };

before(async () => {
  await fs.mkdir(path.join(root, 'dist'), { recursive: true });
  workspace = await fs.mkdtemp(path.join(root, 'dist', '.distribution-test-'));
  release = await distribution.createRelease({ output: path.join(workspace, 'releases') });
  extracted = path.join(workspace, 'extracted');
  const zip = await JSZip.loadAsync(await fs.readFile(release.archive));
  for (const [relative, entry] of Object.entries(zip.files)) {
    installer.safeRelative(relative);
    const file = path.join(extracted, ...relative.split('/'));
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, await entry.async('nodebuffer'), { flag: 'wx' });
  }
});

after(async () => {
  if (workspace) await fs.rm(workspace, { recursive: true, force: true });
});

function invoke(args: string[], status = 0) {
  const result = spawnSync(process.execPath, [path.join(extracted, 'install-skills.mjs'), ...args], {
    cwd: workspace, encoding: 'utf8', timeout: 120000,
    env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
  });
  if (result.error) throw result.error;
  assert.equal(result.status, status, `${result.stdout}\n${result.stderr}`);
  return result;
}

test('release ZIP, inventory and SHA256 assets are deterministic and retain earlier output', async () => {
  const again = await distribution.createRelease({ output: path.join(workspace, 'second-release') });
  assert.equal(again.contentHash, release.contentHash);
  assert.deepEqual(await fs.readFile(again.archive), await fs.readFile(release.archive));
  const reused = await distribution.createRelease({ output: path.join(workspace, 'releases') });
  assert.equal(reused.reused, true);
  const sums = await fs.readFile(path.join(release.directory, 'SHA256SUMS.txt'), 'utf8');
  for (const line of sums.trimEnd().split('\n')) {
    const [hash, name] = line.split('  ');
    assert.equal(installer.sha256(await fs.readFile(path.join(release.directory, name!))), hash);
  }
  const manifest = JSON.parse(await fs.readFile(path.join(extracted, 'release-manifest.json'), 'utf8'));
  assert.deepEqual(names, ['aha-research', 'aha-explain']);
  assert.deepEqual(manifest.skills, names);
  const files: Record<string, Buffer> = await installer.inventory(extracted);
  assert.equal(Object.keys(files).length, Object.keys(manifest.files).length + 1);
  for (const [relative, hash] of Object.entries(manifest.files)) {
    assert.equal(installer.sha256(files[relative]), hash, relative);
    if (!relative.startsWith('skills/')) {
      assert.ok(['INSTALL.md', 'install-skills.mjs'].includes(relative));
      continue;
    }
    const [, name, ...parts] = relative.split('/');
    assert.ok(names.includes(name!));
    assert.equal(installer.allowedSkillFile(parts.join('/')), true, relative);
    assert.ok(!/(^|\/)(\.env|\.venv|\.git|logs|tokens)(\/|$)/.test(relative));
  }
  for (const name of names) {
    assert.ok(files[`skills/${name}/node_modules/playwright-core/LICENSE`]?.length);
    assert.ok(files[`skills/${name}/THIRD-PARTY-NOTICES.txt`]?.length);
  }
  const previous = await fs.readFile(again.archive);
  await fs.writeFile(again.archive, 'different assets');
  await assert.rejects(distribution.createRelease({ output: path.join(workspace, 'second-release') }), /overwrite differing/);
  assert.equal(await fs.readFile(again.archive, 'utf8'), 'different assets');
  assert.deepEqual(await fs.readFile(release.archive), previous);
});

test('release allowlist rejects workspace files, unsafe names and unexpected dependencies', () => {
  for (const relative of ['.env', '.venv/bin/python', 'artifacts/old-render.mp4', 'logs/session.log',
    'tokens.json', 'references/secrets.md', 'node_modules/other/index.js', 'scripts/debug.mjs',
    'assets/runtime/workspace.json', 'node_modules/playwright-core/.env',
    'node_modules/playwright-core/node_modules/unexpected/index.js']) {
    assert.equal(installer.allowedSkillFile(relative), false, relative);
  }
  for (const relative of ['../escape', '/absolute', 'C:/escape', 'references\\escape.md',
    'references/CON.md', 'references/space .', 'a//b']) {
    assert.throws(() => installer.safeRelative(relative), /Unsafe relative/);
  }
});

test('installer defaults to the shared path with optional Copilot and Codex labels', async () => {
  for (const host of [undefined, 'copilot', 'codex']) {
    const project = path.join(workspace, `project ${host ?? 'default'}`);
    await fs.mkdir(project);
    const args = [...(host ? ['--host', host] : []), '--project', project];
    const dry = JSON.parse(invoke(args).stdout);
    assert.equal(dry.mode, 'dry-run');
    assert.equal(dry.host, host);
    assert.deepEqual(await fs.readdir(project), []);
    const applied = JSON.parse(invoke([...args, '--apply']).stdout);
    const discovery = path.join(project, '.agents', 'skills');
    assert.equal(applied.destination, discovery);
    assert.equal(applied.host, host);
    assert.deepEqual((await fs.readdir(discovery)).sort(), [...names].sort());
    assert.ok(!(await fs.readdir(project)).some(name => name.startsWith('.aha-install-')));
    for (const name of names) {
      const installed: Record<string, Buffer> = await installer.inventory(path.join(discovery, name));
      const original: Record<string, Buffer> = await installer.inventory(path.join(extracted, 'skills', name));
      assert.deepEqual(installed, original);
    }
    assert.deepEqual(await fs.readdir(project), ['.agents']);
    assert.match(invoke([...args, '--apply'], 1).stderr, /already exists/);
  }
});

test('optional host metadata does not impose a host allowlist or choose a discovery path', async () => {
  const project = path.join(workspace, 'custom host label');
  await fs.mkdir(project);
  const dry = JSON.parse(invoke(['--host', 'another-agent', '--project', project]).stdout);
  assert.equal(dry.host, 'another-agent');
  assert.equal(dry.destination, path.join(project, '.agents', 'skills'));
  assert.deepEqual(await fs.readdir(project), []);
  assert.match(invoke(['--host', ' ', '--project', project], 1).stderr, /nonempty label/);
});

test('each packaged skill doctor resolves only builtins and that independent skill', async () => {
  const loader = path.join(workspace, 'isolated-loader.mjs');
  await fs.writeFile(loader, `
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export async function resolve(specifier, context, next) {
  const result = await next(specifier, context);
  if (result.url.startsWith('file:')) {
    const relative = path.relative(process.env.AHA_ONLY_SKILL, fileURLToPath(result.url));
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Repository dependency refused: ' + result.url);
  } else if (!result.url.startsWith('node:')) throw new Error('Non-builtin resolution refused');
  return result;
}
`, { flag: 'wx' });
  for (const name of names) {
    const skill = path.join(extracted, 'skills', name);
    const result = spawnSync(process.execPath, ['--experimental-loader', pathToFileURL(loader).href, path.join(skill, 'scripts', 'aha.mjs'), 'doctor'], {
      cwd: workspace, encoding: 'utf8', timeout: 30000,
      env: { ...process.env, AHA_ONLY_SKILL: skill, NODE_PATH: '', NODE_OPTIONS: '' },
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const doctor = JSON.parse(result.stdout);
    assert.equal(doctor.version, release.version);
    assert.equal(doctor.capabilities.research, true);
    assert.equal(doctor.capabilities.freeHtml, true);
    assert.equal(doctor.capabilities.mermaid, true);
    assert.equal(doctor.capabilities.pptx, true);
    assert.equal('lab' in doctor.capabilities, false);
    assert.match(doctor.mediaReadiness, /not-probed/);
    assert.equal(doctor.dependencyScope, 'basic');
    assert.deepEqual(doctor.requiredProbes, []);
    assert.match(doctor.mediaReadiness, /not-required-for-this-step/);
  }
});

test('collision preflight preserves every existing target and creates no other skills', async () => {
  const project = path.join(workspace, 'collision');
  const existing = path.join(project, '.agents', 'skills', 'aha-explain');
  await fs.mkdir(existing, { recursive: true });
  await fs.writeFile(path.join(existing, 'keep.txt'), 'existing work');
  assert.match(invoke(['--host', 'copilot', '--project', project, '--apply'], 1).stderr, /already exists/);
  assert.deepEqual(await fs.readdir(path.dirname(existing)), ['aha-explain']);
  assert.equal(await fs.readFile(path.join(existing, 'keep.txt'), 'utf8'), 'existing work');
  assert.deepEqual(await fs.readdir(project), ['.agents']);
});

test('prior host-specific installations block duplicate discovery without deleting files', async () => {
  for (const discovery of ['.github', '.claude']) {
    const project = path.join(workspace, `existing-${discovery.slice(1)}`);
    const existing = path.join(project, discovery, 'skills', 'aha-explain');
    await fs.mkdir(existing, { recursive: true });
    await fs.writeFile(path.join(existing, 'keep.txt'), 'existing installation');
    assert.match(invoke(['--project', project, '--apply'], 1).stderr, /another discovery directory/);
    assert.deepEqual(await fs.readdir(project), [discovery]);
    assert.equal(await fs.readFile(path.join(existing, 'keep.txt'), 'utf8'), 'existing installation');
  }
});

test('exclusive publication rolls back only its own reservations on a late collision', async () => {
  const directory = path.join(workspace, 'publication');
  await fs.mkdir(directory);
  const first = path.join(directory, 'first');
  const existing = path.join(directory, 'existing');
  await fs.mkdir(existing);
  await fs.writeFile(path.join(existing, 'keep.txt'), 'keep');
  await assert.rejects(installer.publishDirectories([
    { source: extracted, destination: first }, { source: extracted, destination: existing },
  ]), /EEXIST/);
  assert.deepEqual(await fs.readdir(directory), ['existing']);
  assert.equal(await fs.readFile(path.join(existing, 'keep.txt'), 'utf8'), 'keep');
  const source = path.join(directory, 'source');
  await fs.mkdir(source);
  await fs.writeFile(path.join(source, 'one.txt'), 'new file');
  await assert.rejects(installer.publishDirectories([
    { source, destination: first },
    { source: path.join(directory, 'missing-source'), destination: path.join(directory, 'second') },
  ]), /ENOENT/);
  assert.deepEqual((await fs.readdir(directory)).sort(), ['existing', 'source']);
});

test('symlink/junction defenses cover destination ancestors, project and source', async () => {
  const outside = path.join(workspace, 'outside');
  const project = path.join(workspace, 'link project');
  await fs.mkdir(outside);
  await fs.mkdir(project);
  const junction = path.join(project, '.agents');
  await fs.symlink(outside, junction, process.platform === 'win32' ? 'junction' : 'dir');
  assert.match(invoke(['--host', 'copilot', '--project', project, '--apply'], 1).stderr, /Symlink\/junction/);
  const alias = path.join(workspace, 'project alias');
  await fs.symlink(project, alias, process.platform === 'win32' ? 'junction' : 'dir');
  assert.match(invoke(['--host', 'codex', '--project', alias, '--apply'], 1).stderr, /Symlink\/junction/);
  const sourceLink = path.join(extracted, 'skills', 'aha-explain', 'escape');
  await fs.symlink(outside, sourceLink, process.platform === 'win32' ? 'junction' : 'dir');
  try {
    assert.match(invoke(['--host', 'codex', '--project', project], 1).stderr, /Symlink\/junction/);
  } finally { await fs.unlink(sourceLink); }
  assert.deepEqual(await fs.readdir(outside), []);
});

test('tampering and extra files are refused before target mutation', async () => {
  const project = path.join(workspace, 'tampered install');
  await fs.mkdir(project);
  const skill = path.join(extracted, 'skills', 'aha-explain', 'SKILL.md');
  const original = await fs.readFile(skill);
  try {
    await fs.appendFile(skill, '\ntampered');
    assert.match(invoke(['--host', 'copilot', '--project', project, '--apply'], 1).stderr, /SHA256 mismatch/);
  } finally { await fs.writeFile(skill, original); }
  const secret = path.join(extracted, '.env');
  await fs.writeFile(secret, 'synthetic test marker, not a credential', { flag: 'wx' });
  try {
    assert.match(invoke(['--host', 'copilot', '--project', project, '--apply'], 1).stderr, /allowlisted|Unsafe/);
  } finally { await fs.unlink(secret); }
  assert.deepEqual(await fs.readdir(project), []);
  assert.match(invoke(['--host', 'copilot', '--project', '.'], 1).stderr, /explicit absolute/);
  assert.match(invoke(['--host', 'copilot', '--project', project, '--force'], 1).stderr, /Unknown argument/);
  assert.match(invoke(['--host', 'copilot', '--project', project, '--dry-run', '--apply'], 1).stderr, /Choose/);
});

test('legacy skills in any discovery directory block installation without deleting user content', async () => {
  for (const discovery of ['.github', '.agents', '.claude']) {
    const project = path.join(workspace, `legacy-${discovery.slice(1)}`);
    const legacy = path.join(project, discovery, 'skills', 'aha-story');
    await fs.mkdir(legacy, { recursive: true });
    await fs.writeFile(path.join(legacy, 'keep.txt'), 'user-owned previous installation');
    assert.match(invoke(['--host', 'copilot', '--project', project, '--apply'], 1).stderr, /Legacy Skill remains/);
    assert.equal(await fs.readFile(path.join(legacy, 'keep.txt'), 'utf8'), 'user-owned previous installation');
    assert.deepEqual(await fs.readdir(path.dirname(legacy)), ['aha-story']);
    assert.deepEqual(await fs.readdir(project), [discovery]);
  }
});
