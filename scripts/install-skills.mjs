import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const skillNames = ['aha-research', 'aha-explain'];
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => `${JSON.stringify(value, null, 2)}\n`;

export function safeRelative(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes(':') ||
      value.split('/').some(part => !part || part === '.' || part === '..' ||
        /[<>:"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(part))) {
    throw new Error(`Unsafe relative path: ${value}`);
  }
  return value;
}

export function allowedSkillFile(relative) {
  safeRelative(relative);
  if (relative.split('/').filter(part => part === 'node_modules').length > 1) return false;
  if (relative.split('/').some(part => /^(?:\.|__pycache__$|\.venv$|examples$|logs?$|tokens?$)/i.test(part))) return false;
  if (/(^|\/)(?:secrets?|tokens?|credentials?|cookies?)(?:[.-]|$)|\.(?:log|pyc|pem|key|pfx)$/i.test(relative)) return false;
  return /^(SKILL\.md|THIRD-PARTY-NOTICES\.txt|runtime-manifest\.json|scripts\/aha\.mjs)$/.test(relative) ||
    /^references\/[a-z0-9-]+\.md$/.test(relative) ||
    /^schemas\/(research-draft|dossier|artifact|video-plan|audio-manifest|provided-audio)\.schema\.json$/.test(relative) ||
    /^assets\/runtime\/mermaid\.js$/.test(relative) ||
    /^assets\/media\/(edge_speech\.py|requirements-media\.txt)$/.test(relative) ||
    /^node_modules\/playwright-core\/(?!.*\/node_modules\/).+$/.test(relative);
}

// Check every existing ancestor, including junctions on Windows; never follow a link.
export async function assertSafePath(target) {
  const absolute = path.resolve(target);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  for (const part of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let stat;
    try { stat = await fs.lstat(current); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (stat.isSymbolicLink()) throw new Error(`Symlink/junction refused: ${current}`);
    if (current !== absolute && !stat.isDirectory()) throw new Error(`Not a directory: ${current}`);
  }
}

export async function readRegular(file, parentChecked = false) {
  if (!parentChecked) await assertSafePath(file);
  const before = await fs.lstat(file);
  if (!before.isFile()) throw new Error(`Not a regular file: ${file}`);
  const handle = await fs.open(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat();
    if (opened.dev !== before.dev || opened.ino !== before.ino) throw new Error(`File changed: ${file}`);
    return await handle.readFile();
  } finally { await handle.close(); }
}

export async function inventory(directory, prefix = '', ancestorsChecked = false) {
  if (!ancestorsChecked) await assertSafePath(directory);
  const stat = await fs.lstat(directory);
  if (stat.isSymbolicLink()) throw new Error(`Symlink/junction refused: ${directory}`);
  if (!stat.isDirectory()) throw new Error(`Not a directory: ${directory}`);
  const files = Object.create(null);
  for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const relative = safeRelative(prefix + entry.name);
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink/junction refused: ${file}`);
    if (entry.isDirectory()) Object.assign(files, await inventory(file, `${relative}/`, true));
    else files[relative] = await readRegular(file, true);
  }
  return files;
}

export function validateSkill(name, files, version) {
  const hashes = {};
  for (const [relative, bytes] of Object.entries(files)) {
    if (!allowedSkillFile(relative)) throw new Error(`File not allowlisted: ${name}/${relative}`);
    if (relative !== 'runtime-manifest.json') hashes[relative] = sha256(bytes);
  }
  const manifest = JSON.parse(files['runtime-manifest.json']?.toString() ?? 'null');
  if (!manifest || manifest.skill !== name || manifest.version !== version ||
      json(Object.entries(manifest.files ?? {}).sort()) !== json(Object.entries(hashes).sort())) {
    throw new Error(`Runtime manifest mismatch: ${name}`);
  }
  for (const required of ['SKILL.md', 'scripts/aha.mjs', 'THIRD-PARTY-NOTICES.txt',
    'node_modules/playwright-core/package.json', 'node_modules/playwright-core/LICENSE']) {
    if (!files[required]?.length) throw new Error(`Missing required file: ${name}/${required}`);
  }
}

async function ensureDirectories(directory, checked = new Set(), created = []) {
  if (checked.has(directory)) return;
  await assertSafePath(directory);
  try {
    await fs.mkdir(directory);
    created.push({ directory, identity: await fs.lstat(directory) });
  }
  catch (error) {
    if (error.code === 'ENOENT') {
      await ensureDirectories(path.dirname(directory), checked, created);
      await ensureDirectories(directory, checked, created);
    } else if (error.code !== 'EEXIST' || !(await fs.lstat(directory)).isDirectory()) throw error;
  }
  await assertSafePath(directory);
  checked.add(directory);
}

export async function removeOwned(directory, identity) {
  await assertSafePath(directory);
  const now = await fs.lstat(directory).catch(error => { if (error.code !== 'ENOENT') throw error; });
  if (now?.dev === identity.dev && now?.ino === identity.ino) {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

// Exclusive directory reservation plus exclusive hard links: never rename over a target.
// Files become visible individually; on failure roll back only our reserved directories.
export async function publishDirectories(plans) {
  const created = [];
  const linked = [];
  const checked = new Set();
  try {
    for (const { destination } of plans) {
      await ensureDirectories(path.dirname(destination), checked, created);
      await assertSafePath(destination);
      await fs.mkdir(destination);
      created.push({ directory: destination, identity: await fs.lstat(destination) });
      checked.add(destination);
    }
    for (const { source, destination } of plans) {
      const files = await inventory(source);
      for (const relative of Object.keys(files)) {
        const target = path.join(destination, ...relative.split('/'));
        await ensureDirectories(path.dirname(target), checked, created);
        const parent = await fs.lstat(path.dirname(target));
        if (!parent.isDirectory() || parent.isSymbolicLink()) throw new Error(`Unsafe target parent: ${target}`);
        const original = path.join(source, ...relative.split('/'));
        const identity = await fs.lstat(original);
        if (!identity.isFile() || identity.isSymbolicLink()) throw new Error(`Unsafe source file: ${original}`);
        await fs.link(original, target);
        linked.push({ file: target, identity });
      }
    }
  } catch (error) {
    for (const { file, identity } of linked.reverse()) {
      await (async () => {
        await assertSafePath(file);
        const now = await fs.lstat(file);
        if (now.dev === identity.dev && now.ino === identity.ino) await fs.unlink(file);
      })().catch(() => {});
    }
    for (const { directory, identity } of created.reverse()) {
      await (async () => {
        await assertSafePath(directory);
        const now = await fs.lstat(directory);
        // Never recursively remove a published tree: an unrelated writer may have added files.
        if (now.dev === identity.dev && now.ino === identity.ino) await fs.rmdir(directory);
      })().catch(() => {});
    }
    throw error;
  }
}

export async function install({ host, project, apply = false, source = path.dirname(fileURLToPath(import.meta.url)) }) {
  if (!['copilot', 'codex'].includes(host)) throw new Error('--host must be copilot or codex');
  if (!project || !path.isAbsolute(project)) throw new Error('--project must be an explicit absolute project directory');
  if (!path.isAbsolute(source)) throw new Error('--source must be an absolute extracted release directory');
  project = path.resolve(project);
  await assertSafePath(project);
  if (!(await fs.lstat(project)).isDirectory()) throw new Error('Project must already exist');
  if (project === path.parse(project).root || project.toLowerCase() === path.resolve(os.homedir()).toLowerCase()) {
    throw new Error('Global/home/root installation is not supported');
  }
  const release = await inventory(source);
  const manifest = JSON.parse(release['release-manifest.json']?.toString() ?? 'null');
  if (!manifest || manifest.format !== 1 || json(manifest.skills) !== json(skillNames)) throw new Error('Invalid release manifest');
  const actual = {};
  for (const [relative, bytes] of Object.entries(release)) {
    if (relative === 'release-manifest.json') continue;
    if (relative !== 'install-skills.mjs' && relative !== 'INSTALL.md') {
      const [top, name, ...parts] = relative.split('/');
      if (top !== 'skills' || !skillNames.includes(name) || !allowedSkillFile(parts.join('/'))) {
        throw new Error(`File not allowlisted: ${relative}`);
      }
    }
    actual[relative] = sha256(bytes);
  }
  if (json(Object.entries(actual).sort()) !== json(Object.entries(manifest.files ?? {}).sort())) throw new Error('Release SHA256 mismatch');
  const identity = sha256(json({ version: manifest.version, skills: skillNames, files: manifest.files }));
  if (identity !== manifest.contentHash) throw new Error('Release identity mismatch');
  const destination = path.join(project, host === 'copilot' ? '.github' : '.agents', 'skills');
  for (const discovery of ['.github', '.agents', '.claude']) {
    for (const name of ['aha-lab', 'aha-story']) {
      const legacy = path.join(project, discovery, 'skills', name);
      await assertSafePath(legacy);
      try {
        await fs.lstat(legacy);
        throw new Error(`Legacy Skill remains: ${legacy}. Review and move it out of discovery before installing; no legacy files were deleted.`);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }
  for (const name of skillNames) {
    const files = Object.fromEntries(Object.entries(release).filter(([key]) => key.startsWith(`skills/${name}/`))
      .map(([key, bytes]) => [key.slice(`skills/${name}/`.length), bytes]));
    validateSkill(name, files, manifest.version);
    const target = path.join(destination, name);
    await assertSafePath(target);
    try { await fs.lstat(target); throw new Error(`Destination already exists: ${target}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const result = { mode: apply ? 'apply' : 'dry-run', host, project, destination, skills: skillNames, contentHash: identity };
  if (!apply) return result;
  const candidate = await fs.mkdtemp(path.join(project, '.aha-install-'));
  const candidateIdentity = await fs.lstat(candidate);
  try {
    const checked = new Set();
    for (const [relative, bytes] of Object.entries(release)) {
      if (!relative.startsWith('skills/')) continue;
      const file = path.join(candidate, ...relative.split('/'));
      await ensureDirectories(path.dirname(file), checked);
      await fs.writeFile(file, bytes, { flag: 'wx', mode: 0o644 });
    }
    await publishDirectories(skillNames.map(name => ({
      source: path.join(candidate, 'skills', name), destination: path.join(destination, name),
    })));
  } finally { await removeOwned(candidate, candidateIdentity); }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const options = {};
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--apply' || arg === '--dry-run') {
        if ('apply' in options) throw new Error('Choose --apply or --dry-run once');
        options.apply = arg === '--apply';
      } else if (arg === '--host' || arg === '--project' || arg === '--source') {
        const key = arg.slice(2);
        if (key in options || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Invalid ${arg}`);
        options[key] = args[++i];
      } else throw new Error(`Unknown argument: ${arg}`);
    }
    console.log(json(await install(options)).trimEnd());
  } catch (error) {
    console.error(`Installation refused: ${error.message}`);
    process.exitCode = 1;
  }
}
