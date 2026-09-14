import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createDraft, createExample } from '../src/core/examples.js';
import { buildPack } from '../src/core/pack.js';
import { assertOutsidePack, readJson, readPack, writeNewFile, writePack, MAX_JSON_BYTES } from '../src/cli/files.js';
import { AhaError } from '../src/core/errors.js';

async function temp(action: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aha-files-'));
  try { await action(dir); }
  finally { await fs.rm(dir, { recursive: true, force: true }); }
}
const code = (expected: string) => (error: unknown): boolean =>
  error instanceof AhaError && error.code === expected;

test('Pack roundtrip uses explicit files and does not overwrite existing revisions', async () => temp(async dir => {
  const pack = await createExample('retry');
  const output = path.join(dir, 'example.aha');
  await writePack(output, pack);
  assert.deepEqual(await readPack(output), pack);
  await assert.rejects(writePack(output, pack), { code: 'EEXIST' });
  assert.deepEqual(await readPack(output), pack);
  await fs.writeFile(path.join(output, 'payload.js'), 'throw new Error("must never execute")');
  await assert.rejects(readPack(output), code('PACK_RESOURCE'));
}));

test('failed file commit preserves last good data and removes only its candidate', async () => temp(async dir => {
  const target = path.join(dir, 'result.html');
  await writeNewFile(target, 'last good');
  await assert.rejects(writeNewFile(target, 'broken'), { code: 'EEXIST' });
  assert.equal(await fs.readFile(target, 'utf8'), 'last good');
  assert.deepEqual(await fs.readdir(dir), ['result.html']);
}));

test('unsafe scenario filenames and inconsistent trace files are rejected', async () => temp(async dir => {
  const output = path.join(dir, 'sample.aha');
  await writePack(output, await createExample('compound'));
  const file = path.join(output, 'scenarios.json');
  const data = await readJson(file);
  assert.ok(Array.isArray(data));
  data[0].id = '../escape';
  await fs.writeFile(file, JSON.stringify(data));
  await assert.rejects(readPack(output), code('SCHEMA_INVALID'));
}));

test('JSON parsing accepts BOM text and rejects invalid or oversized input', async () => temp(async dir => {
  const target = path.join(dir, 'input.json');
  await fs.writeFile(target, '\uFEFF{"valid":true}');
  assert.deepEqual(await readJson(target), { valid: true });
  await fs.writeFile(target, '{');
  await assert.rejects(readJson(target), code('JSON_SYNTAX'));
  await fs.writeFile(target, ' '.repeat(MAX_JSON_BYTES + 1));
  await assert.rejects(readJson(target), code('FILE_SIZE'));
}));

test('artifact destinations cannot pollute source Pack even through a junction', async () => temp(async dir => {
  const pack = path.join(dir, 'topic.aha');
  await writePack(pack, await createExample('retry'));
  await assert.rejects(assertOutsidePack(pack, path.join(pack, 'selected.json')), code('OUTPUT_INSIDE_PACK'));
  await assert.rejects(assertOutsidePack(pack, path.join(pack, 'new', 'story.aha')), code('OUTPUT_INSIDE_PACK'));
  await assertOutsidePack(pack, path.join(dir, 'topic.aha-sibling', 'selected.json'));
  const alias = path.join(dir, 'alias');
  await fs.symlink(pack, alias, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(assertOutsidePack(pack, path.join(alias, 'selected.json')), code('OUTPUT_INSIDE_PACK'));
}));

test('Pack serialization rejects oversized documents before reserving output', async () => temp(async dir => {
  const draft = createDraft('retry');
  const original = draft.claims[0]!;
  draft.claims = Array.from({ length: 100 }, (_, index) => ({
    ...original, id: index === 0 ? 'rule' : `claim-${index}`,
    assumptions: Array.from({ length: 50 }, () => 'a'.repeat(411)),
    limitations: Array.from({ length: 50 }, () => 'b'.repeat(411)),
  }));
  const pack = await buildPack(draft);
  const output = path.join(dir, 'large.aha');
  await assert.rejects(writePack(output, pack), code('FILE_SIZE'));
  await assert.rejects(fs.stat(output), { code: 'ENOENT' });
}));
