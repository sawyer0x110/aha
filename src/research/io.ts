import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { AhaError, fail } from '../core/errors.js';

export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
export const MAX_DOSSIER_BYTES = 10 * 1024 * 1024;

export function ioError(error: unknown, location: string): never {
  if (error instanceof AhaError) throw error;
  const code = (error as NodeJS.ErrnoException)?.code;
  if (code === 'EEXIST') fail('OUTPUT_EXISTS', 'Destination already exists; choose a new immutable dossier directory.', location);
  if (code === 'ENOENT') fail('FILE_MISSING', 'Required dossier resource or parent directory does not exist.', location);
  fail('FILE_IO', `Dossier filesystem operation failed${code ? ` (${code})` : ''}.`, location);
}

export function safePath(input: string): string {
  if (!input || input.includes('\0') || input.split(/[\\/]/).includes('..')) {
    fail('PATH_INVALID', 'Use a path without parent traversal or null bytes.', input);
  }
  return path.resolve(input);
}

export async function safeDirectory(directory: string, create = false): Promise<void> {
  const root = path.parse(directory).root;
  const parts = directory.slice(root.length).split(path.sep).filter(Boolean);
  let current = root;
  for (const part of ['', ...parts]) {
    current = part ? path.join(current, part) : current;
    if (create && part) {
      try {
        await fs.mkdir(current);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
    }
    const stat = await fs.lstat(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      fail('DIRECTORY_TYPE', 'Expected real directories, including every ancestor; symbolic links are unsupported.', current);
    }
  }
}

export async function boundedRead(file: string): Promise<string> {
  await safeDirectory(path.dirname(file));
  const before = await fs.lstat(file);
  if (!before.isFile() || before.isSymbolicLink()) fail('FILE_TYPE', 'Expected a regular file, not a symbolic link.', file);
  if (before.size > MAX_DOCUMENT_BYTES) fail('FILE_SIZE', 'Dossier document exceeds the 4 MiB limit.', file);
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.ino !== before.ino || opened.dev !== before.dev) {
      fail('FILE_CHANGED', 'Dossier resource changed while opening it.', file);
    }
    const bytes = Buffer.alloc(MAX_DOCUMENT_BYTES + 1);
    let length = 0;
    while (length < bytes.length) {
      const result = await handle.read(bytes, length, bytes.length - length, null);
      if (result.bytesRead === 0) break;
      length += result.bytesRead;
    }
    if (length > MAX_DOCUMENT_BYTES) fail('FILE_SIZE', 'Dossier document exceeds the 4 MiB limit.', file);
    await safeDirectory(path.dirname(file));
    const after = await fs.lstat(file);
    if (after.isSymbolicLink() || after.ino !== opened.ino || after.dev !== opened.dev) {
      fail('FILE_CHANGED', 'Dossier resource changed while reading it.', file);
    }
    try {
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, length));
    } catch {
      return fail('FILE_ENCODING', 'Dossier documents must contain valid UTF-8.', file);
    }
  } finally {
    await handle.close();
  }
}

export function parseJson(text: string, file: string): unknown {
  try {
    return JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    return fail('JSON_SYNTAX', 'Invalid JSON; dossier content is never executed.', file);
  }
}

export function checkSize(documents: Iterable<string>, location: string): void {
  let total = 0;
  for (const document of documents) {
    const size = Buffer.byteLength(document, 'utf8');
    if (size > MAX_DOCUMENT_BYTES) fail('FILE_SIZE', 'Dossier document exceeds the 4 MiB limit.', location);
    total += size;
  }
  if (total > MAX_DOSSIER_BYTES) fail('DOSSIER_SIZE', 'Dossier exceeds the 10 MiB total limit.', location);
}
