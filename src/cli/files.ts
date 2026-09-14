import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { check } from '../core/check.js';
import { fail } from '../core/errors.js';
import { validatePack } from '../core/pack.js';
import { PackSchema, ScenarioSchema, type Pack } from '../core/schema.js';
import { Type } from '@sinclair/typebox';

export const MAX_JSON_BYTES = 4 * 1024 * 1024;
const MAX_PACK_BYTES = 16 * 1024 * 1024;
const DOCUMENTS = {
  manifest: 'manifest.json', brief: 'brief.json', claims: 'claims.json',
  evidence: 'evidence.json', modelSpec: 'model-spec.json', scenarios: 'scenarios.json',
  narrative: 'narrative.json',
} as const;

export async function readJson(file: string): Promise<unknown> {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) fail('FILE_TYPE', 'Expected a regular JSON file, not a link.', file);
  if (stat.size > MAX_JSON_BYTES) fail('FILE_SIZE', 'JSON exceeds the 4 MiB limit.', file);
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const bytes = Buffer.alloc(MAX_JSON_BYTES + 1);
    let length = 0;
    while (length < bytes.length) {
      const read = await handle.read(bytes, length, bytes.length - length, null);
      if (read.bytesRead === 0) break;
      length += read.bytesRead;
    }
    if (length > MAX_JSON_BYTES) fail('FILE_SIZE', 'JSON exceeds the 4 MiB limit.', file);
    const data = bytes.subarray(0, length).toString('utf8');
    try {
      return JSON.parse(data.replace(/^\uFEFF/, ''));
    } catch (error) {
      if (error instanceof SyntaxError) fail('JSON_SYNTAX', 'Invalid JSON; check syntax without executing any contents.', file);
      throw error;
    }
  } finally {
    await handle.close();
  }
}

async function directory(file: string): Promise<void> {
  const stat = await fs.lstat(file);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail('DIRECTORY_TYPE', 'Expected a directory, not a link.', file);
  }
}

export async function readPack(root: string): Promise<Pack> {
  const base = path.resolve(root);
  await directory(base);
  const entries = await fs.readdir(base, { withFileTypes: true });
  const allowed = new Set<string>([...Object.values(DOCUMENTS), 'research.json', 'teaching.json', 'traces', 'receipts']);
  for (const entry of entries) {
    if (!allowed.has(entry.name) || entry.isSymbolicLink()) {
      fail('PACK_RESOURCE', `Unsupported Pack entry: ${entry.name}.`, base);
    }
    const isDirectory = entry.name === 'traces' || entry.name === 'receipts';
    if (isDirectory ? !entry.isDirectory() : !entry.isFile()) {
      fail('PACK_RESOURCE', `Wrong resource type: ${entry.name}.`, base);
    }
  }
  await directory(path.join(base, 'receipts'));
  const values: Record<string, unknown> = {};
  let bytes = 0;
  for (const [key, name] of Object.entries(DOCUMENTS)) {
    const file = path.join(base, name);
    bytes += (await fs.lstat(file)).size;
    values[key] = await readJson(file);
  }
  if (entries.some(entry => entry.name === 'research.json')) {
    const file = path.join(base, 'research.json');
    bytes += (await fs.lstat(file)).size;
    values.research = await readJson(file);
  }
  if (entries.some(entry => entry.name === 'teaching.json')) {
    const file = path.join(base, 'teaching.json');
    bytes += (await fs.lstat(file)).size;
    values.teaching = await readJson(file);
  }
  const scenarios = check(Type.Array(ScenarioSchema, { minItems: 1, maxItems: 20 }), values.scenarios, '/scenarios');
  const tracesDirectory = path.join(base, 'traces');
  await directory(tracesDirectory);
  const traceEntries = await fs.readdir(tracesDirectory, { withFileTypes: true });
  const expectedNames = new Set(scenarios.map(scenario => `${scenario.id}.json`));
  if (traceEntries.length !== scenarios.length) fail('TRACE_COUNT', 'Trace file count does not match scenarios.', tracesDirectory);
  for (const entry of traceEntries) {
    if (!expectedNames.has(entry.name) || !entry.isFile() || entry.isSymbolicLink()) {
      fail('PACK_RESOURCE', `Unsupported trace entry: ${entry.name}.`, tracesDirectory);
    }
  }
  const traces: unknown[] = [];
  for (const scenario of scenarios) {
    const file = path.join(tracesDirectory, `${scenario.id}.json`);
    bytes += (await fs.lstat(file)).size;
    if (bytes > MAX_PACK_BYTES) fail('PACK_SIZE', 'Pack exceeds the 16 MiB limit.', base);
    traces.push(await readJson(file));
  }
  return validatePack(check(PackSchema, { ...values, traces }));
}

export function jsonText(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

export function limitedJsonText(data: unknown, location: string): string {
  const text = jsonText(data);
  if (Buffer.byteLength(text, 'utf8') > MAX_JSON_BYTES) {
    fail('FILE_SIZE', 'Serialized JSON exceeds the 4 MiB limit; reduce this document.', location);
  }
  return text;
}

export async function assertOutsidePack(root: string, destination: string): Promise<void> {
  const base = await fs.realpath(root);
  let ancestor = path.resolve(destination);
  const missing: string[] = [];
  for (;;) {
    try {
      ancestor = await fs.realpath(ancestor);
      break;
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
      missing.unshift(path.basename(ancestor));
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw error;
      ancestor = parent;
    }
  }
  const relative = path.relative(base, path.join(ancestor, ...missing));
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
    fail('OUTPUT_INSIDE_PACK', 'Write artifacts and new revisions outside the immutable source Pack.', destination);
  }
}

export async function writeNewFile(destination: string, content: string | Uint8Array): Promise<void> {
  const output = path.resolve(destination);
  await fs.mkdir(path.dirname(output), { recursive: true });
  const candidate = path.join(path.dirname(output), `.${path.basename(output)}.${randomUUID()}.tmp`);
  await fs.writeFile(candidate, content, { flag: 'wx', encoding: 'utf8' });
  try {
    // A hard-link commit fails rather than replacing a concurrently created output.
    await fs.link(candidate, output);
  } finally {
    await fs.unlink(candidate);
  }
}

export async function writePack(destination: string, pack: Pack, exploration?: unknown): Promise<void> {
  await validatePack(pack);
  const output = path.resolve(destination);
  const documents = new Map<string, string>();
  for (const [key, name] of Object.entries(DOCUMENTS)) {
    documents.set(name, limitedJsonText(Reflect.get(pack, key), name));
  }
  if (pack.research) documents.set('research.json', limitedJsonText(pack.research, 'research.json'));
  if (pack.teaching) documents.set('teaching.json', limitedJsonText(pack.teaching, 'teaching.json'));
  for (const trace of pack.traces) {
    const name = path.join('traces', `${trace.scenarioId}.json`);
    documents.set(name, limitedJsonText(trace, name));
  }
  const total = [...documents.values()].reduce((sum, text) => sum + Buffer.byteLength(text, 'utf8'), 0);
  if (total > MAX_PACK_BYTES) fail('PACK_SIZE', 'Serialized Pack exceeds the 16 MiB limit.', output);
  const explorationText = exploration === undefined ? undefined
    : limitedJsonText(exploration, 'receipts/imported-exploration.json');
  await fs.mkdir(path.dirname(output), { recursive: true });
  // Reserve the exact destination. Concurrent writers must never replace its contents.
  await fs.mkdir(output);
  const created: string[] = [];
  const directories: string[] = [];
  let committed = false;
  try {
    const tracesDirectory = path.join(output, 'traces');
    const receiptsDirectory = path.join(output, 'receipts');
    await fs.mkdir(tracesDirectory);
    directories.push(tracesDirectory);
    await fs.mkdir(receiptsDirectory);
    directories.push(receiptsDirectory);
    for (const [name, text] of documents) {
      if (name === 'manifest.json') continue;
      const file = path.join(output, name);
      await fs.writeFile(file, text, { flag: 'wx' });
      created.push(file);
    }
    if (explorationText !== undefined) {
      const file = path.join(receiptsDirectory, 'imported-exploration.json');
      await fs.writeFile(file, explorationText, { flag: 'wx' });
      created.push(file);
    }
    const manifest = path.join(output, 'manifest.json');
    await writeNewFile(manifest, documents.get('manifest.json')!);
    committed = true;
  } finally {
    if (!committed) {
      // Only clean exact files created by this operation, never an arbitrary directory tree.
      for (const file of created.reverse()) await fs.unlink(file);
      for (const dir of directories.reverse()) await fs.rmdir(dir);
      await fs.rmdir(output);
    }
  }
}

export async function writeReceipt(root: string, data: unknown): Promise<string> {
  const receipts = path.join(path.resolve(root), 'receipts');
  await directory(receipts);
  const file = path.join(receipts, `${randomUUID()}.json`);
  await writeNewFile(file, jsonText(data));
  return file;
}
