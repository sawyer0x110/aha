import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

const [originalDirectory, importedDirectory, output] = process.argv.slice(2);
assert(originalDirectory && importedDirectory && output, 'Provide original audio, imported audio and a new report path.');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const original = JSON.parse(await readFile(path.join(originalDirectory, 'manifest.json'), 'utf8'));
const imported = JSON.parse(await readFile(path.join(importedDirectory, 'manifest.json'), 'utf8'));
assert.equal(original.provider, 'edge-tts');
assert.equal(imported.provider, 'provided-audio');
assert.deepEqual(original.segments.map(segment => segment.id), imported.segments.map(segment => segment.id));
const decode = file => {
  const result = spawnSync('ffmpeg', ['-v', 'error', '-nostdin', '-i', file, '-f', 's16le', '-ac', '1', '-ar', '48000', 'pipe:1'], { maxBuffer: 8 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr.toString());
  return result.stdout;
};
const checks = [];
for (let i = 0; i < original.segments.length; i++) {
  const before = original.segments[i], after = imported.segments[i];
  const oldFile = path.join(originalDirectory, before.filename), newFile = path.join(importedDirectory, after.filename);
  assert.equal(sha(await readFile(oldFile)), before.sha256);
  assert.equal(sha(await readFile(newFile)), after.sha256);
  const left = decode(oldFile), right = decode(newFile);
  assert(right.length >= left.length);
  assert(left.equals(right.subarray(0, left.length)), `Original samples changed in ${before.id}.`);
  assert(right.subarray(left.length).every(byte => byte === 0), `Non-silent data appended in ${before.id}.`);
  checks.push({ id: before.id, originalHash: before.sha256, importedHash: after.sha256, originalSamplesUnchanged: true, appendedSilentSamples: (right.length - left.length) / 2 });
}
const report = {
  originalPlanHash: original.planHash, importedPlanHash: imported.planHash, checks,
  scope: 'Decoded original mono 48 kHz PCM samples are an exact prefix of imported audio. Only zero-valued end padding is allowed. This does not constitute a listening review.',
};
await writeFile(output, JSON.stringify(report, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ segments: checks.length, appendedSilentSamples: checks.reduce((sum, item) => sum + item.appendedSilentSamples, 0) }));
