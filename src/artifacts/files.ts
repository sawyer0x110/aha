import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fail } from '../core/errors.js';

export const MAX_SOURCE_BYTES = 64 * 1024 * 1024;
export const MAX_FILE_BYTES = 16 * 1024 * 1024;
const EXCLUDED = new Set(['research', 'dist', 'qa']);

export function localPath(value: string): string {
  if (!value || value.includes('\\') || /[%?#:\u0000-\u001f]/.test(value)
    || value.startsWith('/') || value.split('/').some(part => !part || part === '.' || part === '..')) {
    fail('ARTIFACT_PATH', 'Use a simple relative project path without traversal, URL encoding, or backslashes.', value);
  }
  if (EXCLUDED.has(value.split('/')[0]!)) fail('ARTIFACT_PATH', 'Sources cannot reference research, dist, or qa.', value);
  return value;
}

export async function noLinks(file: string, allowMissing = false): Promise<void> {
  const absolute = path.resolve(file);
  const parts = absolute.slice(path.parse(absolute).root.length).split(path.sep).filter(Boolean);
  let cursor = path.parse(absolute).root;
  for (const part of parts) {
    cursor = path.join(cursor, part);
    try {
      if ((await fs.lstat(cursor)).isSymbolicLink()) fail('ARTIFACT_LINK', 'Links are not allowed in project or output paths, including ancestors.', cursor);
    } catch (error) {
      if (allowMissing && (error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
  }
}

export async function readBounded(file: string): Promise<Buffer> {
  await noLinks(file);
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.nlink !== 1) fail('ARTIFACT_FILE', 'Expected a regular file without links.', file);
  if (stat.size > MAX_FILE_BYTES) fail('ARTIFACT_SIZE', 'Source file exceeds 16 MiB.', file);
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const bytes = Buffer.alloc(Math.min(stat.size + 1, MAX_FILE_BYTES + 1));
    let length = 0;
    while (length < bytes.length) {
      const result = await handle.read(bytes, length, bytes.length - length, null);
      if (!result.bytesRead) break;
      length += result.bytesRead;
    }
    const after = await handle.stat();
    if (after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || length !== stat.size) {
      fail('ARTIFACT_CHANGED', 'Source changed while reading; retry with stable files.', file);
    }
    return bytes.subarray(0, length);
  } finally {
    await handle.close();
  }
}

export async function sourceFiles(directory: string): Promise<Map<string, Buffer>> {
  const root = path.resolve(directory);
  await noLinks(root);
  if (!(await fs.lstat(root)).isDirectory()) fail('ARTIFACT_DIRECTORY', 'Expected an artifact directory.', root);
  const files = new Map<string, Buffer>();
  let total = 0;
  let entries = 0;
  async function visit(relative: string, depth: number): Promise<void> {
    if (depth > 16) fail('ARTIFACT_SIZE', 'Project directory nesting exceeds 16.');
    for (const entry of (await fs.readdir(path.join(root, relative), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (++entries > 1024) fail('ARTIFACT_SIZE', 'Project exceeds 1024 entries.');
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) fail('ARTIFACT_LINK', 'Project links are not allowed.', name);
      if (!relative && EXCLUDED.has(entry.name)) {
        if (!entry.isDirectory()) fail('ARTIFACT_FILE', 'Reserved project path must be a directory.', name);
        continue;
      }
      localPath(name);
      if (entry.isDirectory()) await visit(name, depth + 1);
      else if (entry.isFile()) {
        const bytes = await readBounded(path.join(root, ...name.split('/')));
        total += bytes.length;
        if (total > MAX_SOURCE_BYTES) fail('ARTIFACT_SIZE', 'Project sources exceed 64 MiB.');
        files.set(name, bytes);
      } else fail('ARTIFACT_FILE', 'Unsupported project resource.', name);
    }
  }
  await visit('', 0);
  return files;
}

export function hashFiles(files: Map<string, Buffer>): string {
  const hash = createHash('sha256');
  for (const name of [...files.keys()].sort()) {
    const bytes = files.get(name)!;
    hash.update(`${Buffer.byteLength(name)}:${name}:${bytes.length}:`).update(bytes);
  }
  return hash.digest('hex');
}

export async function outsideProject(root: string, destination: string): Promise<string> {
  const output = path.resolve(destination);
  await noLinks(output, true);
  const relative = path.relative(path.resolve(root), output);
  if (!relative || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) {
    fail('OUTPUT_INSIDE_ARTIFACT', 'Render destinations must be outside the source project.', output);
  }
  return output;
}
