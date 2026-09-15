import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { assertOutsideSource, readJson, readText, writeNewFile, limitedJsonText, MAX_JSON_BYTES } from '../src/cli/files.js';
import { AhaError } from '../src/core/errors.js';

async function temp(action: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aha-files-'));
  try { await action(dir); }
  finally { await fs.rm(dir, { recursive: true, force: true }); }
}
const code = (expected: string) => (error: unknown): boolean =>
  error instanceof AhaError && error.code === expected;

test('exclusive file publication preserves existing data and removes its candidate', async () => temp(async dir => {
  const target = path.join(dir, 'result.html');
  await writeNewFile(target, 'last good');
  await assert.rejects(writeNewFile(target, 'broken'), { code: 'EEXIST' });
  assert.equal(await fs.readFile(target, 'utf8'), 'last good');
  assert.deepEqual(await fs.readdir(dir), ['result.html']);
}));

test('concurrent writes cannot replace an output', async () => temp(async dir => {
  const target = path.join(dir, 'result.json');
  const results = await Promise.allSettled([writeNewFile(target, '"first"'), writeNewFile(target, '"second"')]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.ok(['first', 'second'].includes(String(await readJson(target))));
  assert.deepEqual(await fs.readdir(dir), ['result.json']);
}));

test('JSON parsing accepts BOM and refuses invalid or oversized input', async () => temp(async dir => {
  const target = path.join(dir, 'input.json');
  await fs.writeFile(target, '\uFEFF{"valid":true}');
  assert.deepEqual(await readJson(target), { valid: true });
  await fs.writeFile(target, '{');
  await assert.rejects(readJson(target), code('JSON_SYNTAX'));
  await fs.writeFile(target, ' '.repeat(MAX_JSON_BYTES + 1));
  await assert.rejects(readJson(target), code('FILE_SIZE'));
  assert.throws(() => limitedJsonText('a'.repeat(MAX_JSON_BYTES), 'output'), code('FILE_SIZE'));
}));

test('publication stays outside source and rejects link ancestors for reads and writes', async () => temp(async dir => {
  const source = path.join(dir, 'source');
  await fs.mkdir(source);
  await fs.writeFile(path.join(source, 'input.json'), '{}');
  await assert.rejects(assertOutsideSource(source, path.join(source, 'selected.json')), code('OUTPUT_INSIDE_SOURCE'));
  await assert.rejects(assertOutsideSource(source, path.join(source, 'new', 'artifact.html')), code('OUTPUT_INSIDE_SOURCE'));
  await assertOutsideSource(source, path.join(dir, 'source-sibling', 'selected.json'));
  const alias = path.join(dir, 'alias');
  await fs.symlink(source, alias, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(assertOutsideSource(source, path.join(alias, 'selected.json')), code('FILE_LINK'));
  await assert.rejects(readJson(path.join(alias, 'input.json')), code('FILE_LINK'));
  await assert.rejects(writeNewFile(path.join(alias, 'output.json'), '{}'), code('FILE_LINK'));
  assert.deepEqual(await fs.readdir(source), ['input.json']);
}));

test('text and JSON ingestion reject invalid UTF-8 without replacing content', async () => temp(async dir => {
  const target = path.join(dir, 'input.json');
  for (const invalid of [[0xff], [0xc0, 0xaf], [0xe2, 0x82], [0xed, 0xa0, 0x80]]) {
    const bytes = Buffer.concat([Buffer.from('{"title":"'), Buffer.from(invalid), Buffer.from('"}')]);
    await fs.writeFile(target, bytes);
    await assert.rejects(readText(target), code('FILE_ENCODING'));
    await assert.rejects(readJson(target), code('FILE_ENCODING'));
    assert.deepEqual(await fs.readFile(target), bytes);
  }
  const text = '\uFEFF{"title":"中文 café 😀 �"}';
  await fs.writeFile(target, text);
  assert.equal(await readText(target), text);
  assert.deepEqual(await readJson(target), { title: '中文 café 😀 �' });
}));
