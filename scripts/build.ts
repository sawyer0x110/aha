import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { ResearchDraftSchema, DossierSchema } from '../src/research/schema.js';
import { ArtifactSchema } from '../src/artifacts/project.js';
import { VideoPlanSchema, AudioManifestSchema } from '../src/media/plan.js';
import { ProvidedAudioSchema } from '../src/media/audio.js';

const root = fileURLToPath(new URL('../', import.meta.url));
// Also enforce the persistent producer patch when install scripts were disabled.
const { patchPptxGenJS }: { patchPptxGenJS: () => Promise<void> } =
  await import(new URL('./patch-pptxgenjs.mjs', import.meta.url).href);
await patchPptxGenJS();
const { assertSafePath, releaseSources }: {
  assertSafePath: (target: string) => Promise<void>;
  releaseSources: Record<string, string>;
} =
  await import(new URL('./install-skills.mjs', import.meta.url).href);
const { version } = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')) as { version: string };
const output = path.join(root, 'dist');
const runtime = path.join(output, 'assets', 'runtime');
await assertSafePath(runtime);
await assertSafePath(path.join(output, 'cli', 'aha.mjs'));
await fs.mkdir(runtime, { recursive: true });
await fs.mkdir(path.join(output, 'cli'), { recursive: true });

for (const name of ['lab.js', 'slides.js', 'reveal.js', 'reveal.css']) {
  const obsolete = path.join(runtime, name);
  await assertSafePath(obsolete);
  await fs.rm(obsolete, { force: true });
}
for (const name of ['aha-lab', 'aha-story']) {
  const obsolete = path.join(output, 'skills', name);
  await assertSafePath(obsolete);
  await fs.rm(obsolete, { recursive: true, force: true });
}
const browserBuild = await build({
  entryPoints: [path.join(root, 'src', 'browser', 'mermaid.ts')],
  outfile: path.join(runtime, 'mermaid.js'), bundle: true, platform: 'browser',
  format: 'iife', target: 'es2022', minify: true, legalComments: 'inline', metafile: true,
});
const cliBuild = await build({
  entryPoints: [path.join(root, 'src', 'cli', 'main.ts')],
  outfile: path.join(output, 'cli', 'aha.mjs'),
  bundle: true, platform: 'node', format: 'esm', target: 'node22',
  legalComments: 'inline', external: ['playwright-core'], metafile: true,
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});

const packageRoots = new Set<string>([path.join(root, 'node_modules', 'playwright-core')]);
for (const input of [...Object.keys(cliBuild.metafile.inputs), ...Object.keys(browserBuild.metafile.inputs)]) {
  const absolute = path.resolve(root, input);
  const parts = absolute.split(path.sep);
  const marker = parts.lastIndexOf('node_modules');
  if (marker < 0) continue;
  const end = parts[marker + 1]!.startsWith('@') ? marker + 3 : marker + 2;
  packageRoots.add(parts.slice(0, end).join(path.sep));
}
let allNotices = `Runtime dependencies distributed with Aha ${version}\n`;
for (const directory of [...packageRoots].sort()) {
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf8'));
  const licenseFiles = (await fs.readdir(directory)).filter(file => /^(licen[cs]e|copying|copyright|notice)([.-]|$)/i.test(file));
  if (!licenseFiles.length && manifest.name === 'saxes' && manifest.version === '6.0.0') {
    allNotices += `\n${manifest.name} ${manifest.version}\n${await fs.readFile(path.join(root, 'scripts', 'licenses', 'saxes-6.0.0.txt'), 'utf8')}\n`;
    continue;
  }
  if (!licenseFiles.length && manifest.name === 'isarray' && manifest.version === '1.0.0') {
    const readme = await fs.readFile(path.join(directory, 'README.md'), 'utf8');
    const license = readme.slice(readme.indexOf('## License'));
    if (!license.includes('Copyright (c) 2013 Julian Gruber') || !license.includes('THE SOFTWARE IS PROVIDED "AS IS"')) {
      throw new Error('isarray README no longer contains its verified complete MIT notice.');
    }
    allNotices += `\n${manifest.name} ${manifest.version}\n${license}\n`;
    continue;
  }
  if (!licenseFiles.length) throw new Error(`Missing license notice for ${manifest.name}`);
  allNotices += `\n${manifest.name} ${manifest.version}\n`;
  for (const file of licenseFiles) allNotices += `\n${await fs.readFile(path.join(directory, file), 'utf8')}\n`;
}
allNotices += '\nOptional separately installed software (not bundled): Edge TTS 7.2.8 (LGPLv3, srt_composer.py MIT), FFmpeg (license depends on the installed build), installed Microsoft Edge/Chrome. See their respective distributions and service terms. Reference toolkits are not included.\n';
const media = path.join(output, 'assets', 'media');
await assertSafePath(media);
await fs.mkdir(media, { recursive: true });
await fs.copyFile(path.join(root, 'src', 'media', 'edge_speech.py'), path.join(media, 'edge_speech.py'));
await fs.copyFile(path.join(root, 'requirements-media.txt'), path.join(media, 'requirements-media.txt'));
const playwright = path.join(output, 'node_modules', 'playwright-core');
await assertSafePath(playwright);
await fs.rm(playwright, { recursive: true, force: true });
await fs.mkdir(path.dirname(playwright), { recursive: true });
await fs.cp(path.join(root, 'node_modules', 'playwright-core'), playwright, { recursive: true });
const schemas = {
  'research-draft.schema.json': ResearchDraftSchema, 'dossier.schema.json': DossierSchema,
  'artifact.schema.json': ArtifactSchema,
  'video-plan.schema.json': VideoPlanSchema, 'audio-manifest.schema.json': AudioManifestSchema,
  'provided-audio.schema.json': ProvidedAudioSchema,
};
async function copySkillText(source: string, destination: string): Promise<void> {
  await assertSafePath(source);
  const stat = await fs.lstat(source);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Skill source must be a regular file: ${source}`);
  await fs.copyFile(source, destination);
}
async function copyReferences(source: string, destination: string): Promise<void> {
  await assertSafePath(source);
  const stat = await fs.lstat(source);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`References must be a regular directory: ${source}`);
  for (const entry of await fs.readdir(source)) {
    if (!/^[a-z0-9-]+\.md$/.test(entry)) throw new Error(`Unexpected Skill reference: ${entry}`);
    await copySkillText(path.join(source, entry), path.join(destination, entry));
  }
}
for (const name of ['aha-research', 'aha-explain']) {
  const skill = path.join(output, 'skills', name);
  await assertSafePath(skill);
  await fs.rm(skill, { recursive: true, force: true });
  await fs.mkdir(skill, { recursive: true });
  const source = path.join(root, 'skills', name);
  if ((await fs.lstat(source)).isSymbolicLink()) throw new Error(`Skill symlink refused: ${source}`);
  await copySkillText(path.join(source, 'SKILL.md'), path.join(skill, 'SKILL.md'));
  for (const notice of ['LICENSE', 'LICENSE-SCOPE.md']) {
    await copySkillText(path.join(root, ...releaseSources[notice]!.split('/')), path.join(skill, notice));
  }
  await fs.mkdir(path.join(skill, 'references'), { recursive: true });
  await copyReferences(path.join(root, 'skills', 'shared', 'references'), path.join(skill, 'references'));
  try {
    await copyReferences(path.join(source, 'references'), path.join(skill, 'references'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await fs.mkdir(path.join(skill, 'scripts'), { recursive: true });
  await fs.copyFile(path.join(output, 'cli', 'aha.mjs'), path.join(skill, 'scripts', 'aha.mjs'));
  await fs.mkdir(path.join(skill, 'assets', 'runtime'), { recursive: true });
  await fs.cp(runtime, path.join(skill, 'assets', 'runtime'), { recursive: true });
  await fs.cp(media, path.join(skill, 'assets', 'media'), { recursive: true });
  await fs.mkdir(path.join(skill, 'node_modules'), { recursive: true });
  await fs.cp(playwright, path.join(skill, 'node_modules', 'playwright-core'), { recursive: true });
  await fs.mkdir(path.join(skill, 'schemas'), { recursive: true });
  for (const [file, schema] of Object.entries(schemas)) {
    await fs.writeFile(path.join(skill, 'schemas', file), `${JSON.stringify(schema, null, 2)}\n`);
  }
  await fs.writeFile(path.join(skill, 'THIRD-PARTY-NOTICES.txt'), allNotices);
  const hashes: Record<string, string> = {};
  async function inventory(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Bundled symlink refused: ${file}`);
      if (entry.isDirectory()) await inventory(file);
      else if (entry.name !== 'runtime-manifest.json') {
        hashes[path.relative(skill, file).split(path.sep).join('/')] = createHash('sha256').update(await fs.readFile(file)).digest('hex');
      }
    }
  }
  await inventory(skill);
  await fs.writeFile(path.join(skill, 'runtime-manifest.json'), `${JSON.stringify({
    skill: name, version, schemaVersion: '1.0.0',
    node: '>=22', files: hashes,
  }, null, 2)}\n`);
}
console.log('Built aha-research and aha-explain in dist/skills (local browser/FFmpeg/Python remain optional external tools).');
