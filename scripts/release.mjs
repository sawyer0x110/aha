import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { skillNames, sha256, inventory, validateSkill, assertSafePath, readRegular, publishDirectories, removeOwned } from './install-skills.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const json = value => `${JSON.stringify(value, null, 2)}\n`;
export const installationGuide = `# Aha portable skills: local release

Repository installation entry (release discovery, upgrades and host acceptance):
https://github.com/sawyer0x110/aha/blob/main/INSTALL.md
Use this packaged guide for the commands belonging to this release.

Requires Node.js 22+. Extract the ZIP to a new, empty directory. Keep all files.
No npm installation is needed. Each of aha-research and aha-explain is
independently usable, including its own runtime, bundled dependencies and notices.
Only the two named skills are installed; the workspace is never copied.
No user research or generated works are included.

From the extracted directory, using PowerShell (replace the project path):

\`\`\`powershell
node .\\install-skills.mjs --project "C:\\your-project"
node .\\install-skills.mjs --project "C:\\your-project" --apply
node "C:\\your-project\\.agents\\skills\\aha-explain\\scripts\\aha.mjs" doctor
\`\`\`

All hosts use the recommended project .agents/skills directory. No host name is
required; optional --host accepts any nonempty label as result metadata only,
never as a path selector or a compatibility guarantee. Repeat doctor for
aha-research and aha-explain. In POSIX shells use forward slashes and an absolute
project path. The default is dry-run: it verifies content and targets without
writing. --apply installs project-locally only; there is no global option.
The project must already exist and cannot be the home or filesystem root.
Existing skill directories (including same-name copies under .github/skills or
.claude/skills), symlinks/junctions, unsafe paths and hash mismatches
are refused. No force/overwrite mode exists. Upgrade by reviewing and moving
the old skills out of discovery yourself, then installing into empty destinations.
Do not run a host while installation is in progress. File publication uses
exclusive hard links and directory reservations (no replacement); files become
visible individually, not as an atomic two-directory swap. Failure rolls back
only directories reserved by this invocation; empty discovery parents may remain.
Use a local filesystem supporting hard links and do not concurrently mutate the
source or target tree. Ancestor checks reject links but cannot provide an OS-level
sandbox against a hostile process swapping ancestors concurrently.

Integrity: SHA256SUMS.txt beside the original ZIP covers the ZIP, manifest and
guide. Compare with Get-FileHash -Algorithm SHA256 before extracting. The manifest
inside the ZIP covers every payload file except itself; the installer verifies
all entries, the content identity and each skill runtime manifest before writing.
Hashes detect corruption, not publisher authenticity; use a trusted release source.
The installer itself is executable code: review/trust it before running.

The shared .agents/skills location is recommended for every agent. Installer
host cases cover Copilot and Codex, not a host allowlist or live host acceptance.
Their discovery documentation was checked 2026-09-14:
- Copilot: .agents/skills
  https://docs.github.com/en/copilot/concepts/agents/about-agent-skills
- Codex: .agents/skills (not the historical .codex/skills)
  https://developers.openai.com/codex/skills/
  (redirects to https://learn.chatgpt.com/docs/build-skills)

Other agents must check their own discovery paths, reference-file support,
Node/shell execution and permissions. If adaptation is required, explain it and
obtain authorization rather than silently duplicating installations. Unsupported
or unverified discovery is a blocker, not evidence that the files failed to install.

After installation, launch/refresh the host in that project and inspect its skill
list. Copilot CLI versions with this command (including 1.0.84-5) support:
copilot -C "C:\\your-project" skill list
Copilot also discovers .github/skills and .claude/skills; do not duplicate the
same names there. Legacy aha-lab/aha-story directories in any of these locations
must be reviewed and moved out of discovery before installation; no aliases or
automatic deletion are provided. Select aha-research or aha-explain, then separately test a
natural-language request matching its description. Filesystem installation and
CLI doctor are not evidence of host discovery or natural-language routing.
Live host acceptance is a separate manual check; this release script does not
run Copilot/Codex or claim that either host's language triggers were verified.

HTML packaging and PPTX need Node only. Rendering authored scripts requires
explicit --allow-code after source review, which is not an OS sandbox.
PNG needs installed Edge/Chrome; MP4 additionally
needs FFmpeg/ffprobe. Online narration needs separately installed Python/Edge TTS
and explicit approval; the installer does not install those or contact TTS.
Python selection is AHA_PYTHON, then VIRTUAL_ENV, then an existing .venv-media
in the command's current working directory, then PATH python. Virtualenv
executables are Scripts/python.exe on Windows and bin/python elsewhere.
There is no ancestor/home search or fallback from a broken explicit setting.
An existing project environment is reused, not reinstalled. When working in
another directory, activate it or set AHA_PYTHON to its absolute executable.
Run doctor --media for local-only checks: pythonRuntime reports executable and
source, edge-tts must be exactly 7.2.8, and missing prerequisites yield degraded.
A successful process exit alone does not establish media readiness; inspect
mediaReadiness. No online synthesis or listening review is performed by doctor.
No browser, Python environment, workspace secrets, main node_modules, logs,
tokens or user-produced examples are distributed. Skill-local playwright-core
and third-party license notices are deliberately included.
This is a local handoff only: no publishing, uploading or global registration.
`;

export async function createRelease({ base = root, output = path.join(base, 'dist', 'releases') } = {}) {
  const { version } = JSON.parse(await readRegular(path.join(base, 'package.json')));
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) throw new Error('Unsafe package version');
  const payload = {
    'INSTALL.md': Buffer.from(installationGuide),
    'install-skills.mjs': await readRegular(path.join(base, 'scripts', 'install-skills.mjs')),
  };
  for (const name of skillNames) {
    const files = await inventory(path.join(base, 'dist', 'skills', name));
    validateSkill(name, files, version);
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
    'INSTALL.md': payload['INSTALL.md'],
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
