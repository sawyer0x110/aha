import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { skillNames, releaseRootFiles, sha256, inventory, validateSkill, assertSafePath, readRegular, publishDirectories, removeOwned } from './install-skills.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const json = value => `${JSON.stringify(value, null, 2)}\n`;
export async function createRelease({ base = root, output = path.join(base, 'dist', 'releases') } = {}) {
  const { version } = JSON.parse(await readRegular(path.join(base, 'package.json')));
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) throw new Error('Unsafe package version');
  const payload = {
    'install-skills.mjs': await readRegular(path.join(base, 'scripts', 'install-skills.mjs')),
  };
  for (const name of releaseRootFiles.filter(name => name !== 'install-skills.mjs')) {
    payload[name] = await readRegular(path.join(base, name));
  }
  for (const name of skillNames) {
    const files = await inventory(path.join(base, 'dist', 'skills', name));
    validateSkill(name, files, version);
    for (const notice of ['LICENSE', 'LICENSE-SCOPE.md']) {
      if (!files[notice]?.equals(payload[notice])) throw new Error(`Missing or differing Aha notice: ${name}/${notice}; rebuild before packaging`);
    }
    for (const [relative, bytes] of Object.entries(files)) payload[`skills/${name}/${relative}`] = bytes;
  }
  const files = Object.fromEntries(Object.keys(payload).sort().map(key => [key, sha256(payload[key])]));
  const contentHash = sha256(json({ version, skills: skillNames, files }));
  const manifest = Buffer.from(json({ format: 1, version, skills: skillNames, contentHash, files }));
  payload['release-manifest.json'] = manifest;
  const zip = new JSZip();
  for (const name of Object.keys(payload).sort()) {
    zip.file(name, payload[name], { date: new Date('1980-01-01T00:00:00.000Z'), createFolders: false, unixPermissions: 0o100644 });
  }
  const archiveName = `aha-skills-${version}.zip`;
  const assets = {
    [archiveName]: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 }, platform: 'UNIX' }),
    'release-manifest.json': manifest,
    ...Object.fromEntries(releaseRootFiles.filter(name => name !== 'install-skills.mjs').map(name => [name, payload[name]])),
  };
  assets['SHA256SUMS.txt'] = Buffer.from(Object.keys(assets).sort().map(name => `${sha256(assets[name])}  ${name}\n`).join(''));
  const destination = path.join(output, version, contentHash);
  await assertSafePath(destination);
  let exists = false;
  try { await fs.lstat(destination); exists = true; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (exists) {
    const previous = await inventory(destination);
    if (json(Object.keys(previous).sort()) !== json(Object.keys(assets).sort()) ||
        Object.keys(assets).some(name => !assets[name].equals(previous[name]))) {
      throw new Error(`Refusing to overwrite differing release assets: ${destination}`);
    }
    return { version, contentHash, directory: destination, archive: path.join(destination, archiveName), reused: true };
  }
  await assertSafePath(output);
  await fs.mkdir(output, { recursive: true });
  await assertSafePath(output);
  const candidate = await fs.mkdtemp(path.join(output, '.aha-release-'));
  const candidateIdentity = await fs.lstat(candidate);
  try {
    for (const [name, bytes] of Object.entries(assets)) await fs.writeFile(path.join(candidate, name), bytes, { flag: 'wx', mode: 0o644 });
    await publishDirectories([{ source: candidate, destination }]);
  } finally { await removeOwned(candidate, candidateIdentity); }
  return { version, contentHash, directory: destination, archive: path.join(destination, archiveName), reused: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2) throw new Error('Usage: node scripts\\release.mjs (build first)');
    console.log(json(await createRelease()).trimEnd());
  } catch (error) {
    console.error(`Release refused: ${error.message}`);
    process.exitCode = 1;
  }
}
