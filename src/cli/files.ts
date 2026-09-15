import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fail } from '../core/errors.js';

export const MAX_JSON_BYTES = 4 * 1024 * 1024;

export async function assertSafePath(input: string): Promise<string> {
  if (!input.trim()) fail('FILE_PATH', 'A nonempty local path is required.');
  const absolute = path.resolve(input);
  const { root } = path.parse(absolute);
  let cursor = root;
  for (const part of absolute.slice(root.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    try {
      const stat = await fs.lstat(cursor);
      if (stat.isSymbolicLink()) fail('FILE_LINK', 'Symlinks and junctions are not supported.', cursor);
      if (cursor !== absolute && !stat.isDirectory()) fail('DIRECTORY_TYPE', 'Expected a directory ancestor.', cursor);
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    }
  }
  return absolute;
}

export async function readText(file: string, maxBytes = MAX_JSON_BYTES): Promise<string> {
  await assertSafePath(file);
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) fail('FILE_TYPE', 'Expected a regular local file, not a link.', file);
  if (stat.size > maxBytes) fail('FILE_SIZE', `File exceeds the ${maxBytes} byte limit.`, file);
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat();
    if (opened.dev !== stat.dev || opened.ino !== stat.ino) fail('FILE_CHANGED', 'File changed while opening.', file);
    const bytes = Buffer.alloc(maxBytes + 1);
    let length = 0;
    while (length < bytes.length) {
      const read = await handle.read(bytes, length, bytes.length - length, null);
      if (read.bytesRead === 0) break;
      length += read.bytesRead;
    }
    if (length > maxBytes) fail('FILE_SIZE', `File exceeds the ${maxBytes} byte limit.`, file);
    try {
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, length));
    } catch {
      return fail('FILE_ENCODING', 'Input files must contain valid UTF-8.', file);
    }
  } finally {
    await handle.close();
  }
}

export async function readJson(file: string): Promise<unknown> {
  const data = await readText(file);
  try {
    return JSON.parse(data.replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error instanceof SyntaxError) fail('JSON_SYNTAX', 'Invalid JSON; contents were not executed.', file);
    throw error;
  }
}

export function jsonText(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

export function limitedJsonText(data: unknown, location: string): string {
  const text = jsonText(data);
  if (Buffer.byteLength(text, 'utf8') > MAX_JSON_BYTES) {
    fail('FILE_SIZE', 'Serialized JSON exceeds the 4 MiB limit.', location);
  }
  return text;
}

export async function assertOutsideSource(root: string, destination: string): Promise<void> {
  const base = await assertSafePath(root);
  const output = await assertSafePath(destination);
  const relative = path.relative(base, output);
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
    fail('OUTPUT_INSIDE_SOURCE', 'Publish to a new path outside the source directory.', destination);
  }
}

export async function writeNewFile(destination: string, content: string | Uint8Array): Promise<void> {
  const output = await assertSafePath(destination);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await assertSafePath(output);
  const candidate = path.join(path.dirname(output), `.${path.basename(output)}.${randomUUID()}.tmp`);
  await fs.writeFile(candidate, content, { flag: 'wx', encoding: 'utf8' });
  try {
    // The hard-link commit refuses a concurrent output instead of replacing it.
    await fs.link(candidate, output);
  } finally {
    await fs.unlink(candidate);
  }
}
