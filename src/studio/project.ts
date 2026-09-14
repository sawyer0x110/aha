import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Type, type Static } from '@sinclair/typebox';
import { check } from '../core/check.js';
import { fail } from '../core/errors.js';
import { canonicalize } from '../core/identity.js';
import type { Pack } from '../core/schema.js';
import { assertOutsidePack, readJson, readPack } from '../cli/files.js';
import { scaffoldFiles } from './scaffold.js';

export const FORMATS = ['html', 'image', 'pptx', 'video'] as const;
export type Format = typeof FORMATS[number];
const closed = { additionalProperties: false };
const ids = Type.Array(Type.String(), { uniqueItems: true, maxItems: 100 });
export const StudioSchema = Type.Object({
  schemaVersion: Type.Literal('0.3.0'),
  packHash: Type.String({ pattern: '^[a-f0-9]{64}$' }),
  title: Type.String({ minLength: 1, maxLength: 8000 }),
  status: Type.Union([Type.Literal('draft'), Type.Literal('authored')]),
  coverage: Type.Object({ html: ids, image: ids, pptx: ids, video: ids }, closed),
}, closed);
export type Studio = Static<typeof StudioSchema>;
export const ENTRIES: Record<Format, string[]> = {
  html: ['article.html'], image: ['poster.html'], pptx: ['deck.mjs'],
  video: [path.join('src', 'Video.tsx'), path.join('src', 'index.tsx'), path.join('src', 'Root.tsx'), 'timeline.json'],
};

export function sha256(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

export function parseFormats(text: string): Format[] {
  const parts = text.split(',');
  if (!parts.length || parts.some(item => !FORMATS.includes(item as Format)) || new Set(parts).size !== parts.length) {
    fail('STUDIO_FORMATS', 'Choose a nonempty, unique comma-separated subset of html,image,pptx,video.');
  }
  return parts as Format[];
}

export async function safePath(input: string, allowMissing = false): Promise<string> {
  if (!input.trim() || input.split(/[\\/]/).includes('..')) fail('STUDIO_PATH', 'Traversal components are not supported.', input);
  const absolute = path.resolve(input);
  const parsed = path.parse(absolute);
  let cursor = parsed.root;
  for (const part of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    try {
      if ((await fs.lstat(cursor)).isSymbolicLink()) fail('STUDIO_LINK', 'Symlinks and junctions are not supported.', cursor);
    } catch (error) {
      if (allowMissing && (error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
  }
  return absolute;
}

export async function sourceFiles(root: string, prefix = ''): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await fs.readdir(path.join(root, prefix), { withFileTypes: true })) {
    const name = path.join(prefix, entry.name);
    if (entry.isSymbolicLink()) fail('STUDIO_LINK', 'Symlinks and junctions are not supported.', name);
    // npm's own executable links are not authored sources.
    if (!prefix && (entry.name === 'node_modules' || entry.name === '.git')) continue;
    if (entry.isDirectory()) files.push(...await sourceFiles(root, name));
    else if (entry.isFile()) files.push(name);
    else fail('STUDIO_FILE_TYPE', 'Only regular files/directories are supported.', name);
  }
  return files.sort();
}

export async function sourceHashes(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const file of await sourceFiles(root)) {
    result[file.split(path.sep).join('/')] = sha256(await fs.readFile(path.join(root, file)));
  }
  return result;
}

export async function newDirectory(destination: string, sources: string[]): Promise<string> {
  const output = await safePath(destination, true);
  for (const source of sources) await assertOutsidePack(source, output);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.mkdir(output);
  return output;
}

export async function readProject(directory: string): Promise<{ root: string; pack: Pack; studio: Studio; files: string[] }> {
  const root = await safePath(directory);
  const files = await sourceFiles(root);
  const pack = await readPack(path.join(root, 'source.aha'));
  const studio = check(StudioSchema, await readJson(path.join(root, 'studio.json')));
  const snapshot = await readJson(path.join(root, 'source-data.json'));
  if (studio.packHash !== pack.manifest.contentHash || canonicalize(snapshot) !== canonicalize(pack)) {
    fail('STUDIO_SOURCE_MISMATCH', 'studio.json and source-data.json must identify the exact validated source.aha snapshot.');
  }
  const claims = new Set(pack.claims.map(item => item.id));
  for (const format of FORMATS) {
    for (const id of studio.coverage[format]) {
      if (!claims.has(id)) fail('STUDIO_COVERAGE', `Unknown Claim ${id} in ${format} coverage.`);
    }
  }
  return { root, pack, studio, files };
}

export function validateHtmlSource(html: string, packHash: string, poster = false): void {
  if (!/^\s*<!doctype html>/i.test(html) || !/<\/html\s*>/i.test(html)
    || !/<html\b[^>]*\blang\s*=\s*["'][a-z][a-z0-9-]*["']/i.test(html)
    || !/<meta\b[^>]*name\s*=\s*["']viewport["'][^>]*content\s*=\s*["'][^"']*width\s*=/i.test(html)) {
    fail('STUDIO_HTML', 'Use a complete HTML document with lang and a viewport width.');
  }
  if (!html.includes(packHash)
    || !/<meta\b[^>]*name\s*=\s*["']aha-offline["'][^>]*content\s*=\s*["']true["']/i.test(html)) {
    fail('STUDIO_HTML_IDENTITY', 'HTML must contain its Pack hash and <meta name="aha-offline" content="true">.');
  }
  if (poster && !/\bid\s*=\s*["']aha-poster["']/i.test(html)) fail('STUDIO_POSTER', 'poster.html must contain #aha-poster.');
  // Static hygiene, not a sandbox: the trust flag is still required for all rendering.
  if (/<(?:base|iframe|object|embed)\b/i.test(html)
    || /<(?:script|img|source|video|audio|link|image|use)\b[^>]*\b(?:src|href|xlink:href|srcset)\s*=\s*["'](?!data:|blob:|#)[^"']+/i.test(html)
    || /@import\b|url\(\s*["']?(?!data:|blob:|#)[^)'"\s]+/i.test(html)
    || /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts)\s*\(|\bimport\s*(?:\(|[^;]*\bfrom\s*["'])/i.test(html)) {
    fail('STUDIO_OFFLINE', 'HTML exports must inline scripts/styles/assets; network and external resources are unsupported.');
  }
}

export async function checkProject(directory: string, formats: readonly Format[] = FORMATS): Promise<{
  status: 'draft' | 'checked'; packHash: string; ready: boolean;
  formats: readonly Format[]; issues: string[]; omissions: Record<Format, string[]>;
  semanticScope: string; executedAuthoredCode: false;
}> {
  const { root, pack, studio, files } = await readProject(directory);
  const baseline = scaffoldFiles(pack);
  const issues: string[] = [];
  const omissions = Object.fromEntries(FORMATS.map(format => [
    format, pack.claims.map(item => item.id).filter(id => !studio.coverage[format].includes(id)),
  ])) as Record<Format, string[]>;
  if (studio.status !== 'authored') issues.push('studio.json status is draft; author the selected sources before rendering.');
  for (const format of formats) {
    if (pack.claims.length && !studio.coverage[format].length) issues.push(`${format}: declare the Claim IDs actually covered.`);
    for (const entry of ENTRIES[format]) {
      if (!files.includes(entry)) {
        issues.push(`${format}: missing ${entry}`);
        continue;
      }
      const text = await fs.readFile(path.join(root, entry), 'utf8');
      if (entry === 'timeline.json') {
        const data = await readJson(path.join(root, entry)) as { totalFrames?: number };
        if (!data.totalFrames) issues.push('video: no imported narration; run studio-audio.');
      } else if (entry !== path.join('src', 'Root.tsx') && entry !== path.join('src', 'index.tsx')
        && (text.includes('AHA_STUDIO_DRAFT') || text === baseline[entry] || !text.trim())) {
        issues.push(`${format}: ${entry} is an unmodified scaffold placeholder.`);
      }
      if (entry.endsWith('.html')) validateHtmlSource(text, studio.packHash, format === 'image');
    }
    if (format === 'video' && !files.includes('audio-provenance.json')) issues.push('video: missing audio-provenance.json; no silent/synthetic voice fallback.');
  }
  return {
    status: issues.length ? 'draft' : 'checked', packHash: studio.packHash,
    ready: !issues.length, formats, issues, omissions,
    semanticScope: 'source identity, declared Claim references and static source hygiene only; not semantic or visual approval',
    executedAuthoredCode: false,
  };
}

export async function initProject(packDirectory: string, destination: string): Promise<object> {
  const source = await safePath(packDirectory);
  const pack = await readPack(source);
  await sourceFiles(source);
  const output = await newDirectory(destination, [source]);
  await fs.cp(source, path.join(output, 'source.aha'), { recursive: true, force: false, errorOnExist: true });
  for (const [file, contents] of Object.entries(scaffoldFiles(pack))) {
    await fs.mkdir(path.dirname(path.join(output, file)), { recursive: true });
    await fs.writeFile(path.join(output, file), contents, { flag: 'wx' });
  }
  await fs.mkdir(path.join(output, 'public'));
  await readProject(output);
  return {
    status: 'draft', output, packHash: pack.manifest.contentHash,
    next: 'Author the original sources and coverage; run npm install in the generated project when ready to render. No dependencies installed.',
    trust: 'studio-check never executes authored code. studio-render --trust-local-code executes local code with your account privileges, not in a sandbox.',
  };
}
