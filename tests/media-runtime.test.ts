import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pythonRuntime } from '../src/media/process.js';

test('Python resolution uses only explicit, active, current-project and PATH candidates in order', async () => {
  const cwd = await mkdtemp(path.resolve('.aha-python-'));
  try {
    for (const platform of ['win32', 'linux'] as const) {
      const suffix = platform === 'win32' ? ['Scripts', 'python.exe'] : ['bin', 'python'];
      const local = path.join(cwd, '.venv-media', ...suffix);
      assert.deepEqual(pythonRuntime({ env: {}, cwd, platform }), { executable: 'python', source: 'path' });
      await mkdir(path.dirname(local), { recursive: true });
      await writeFile(local, 'fixture, never executed');
      assert.deepEqual(pythonRuntime({ env: {}, cwd, platform }), { executable: local, source: 'project-venv' });
      const active = path.join(cwd, 'active');
      assert.deepEqual(pythonRuntime({ env: { VIRTUAL_ENV: active }, cwd, platform }),
        { executable: path.join(active, ...suffix), source: 'active-venv' });
      assert.deepEqual(pythonRuntime({ env: { AHA_PYTHON: 'explicit-python', VIRTUAL_ENV: active }, cwd, platform }),
        { executable: 'explicit-python', source: 'override' });
      assert.deepEqual(pythonRuntime({ env: { AHA_PYTHON: path.join(cwd, 'missing') }, cwd, platform }),
        { executable: path.join(cwd, 'missing'), source: 'override' });
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('invalid explicit Python configuration fails and a parent project environment is not searched', async () => {
  const root = await mkdtemp(path.resolve('.aha-python-scope-'));
  try {
    const child = path.join(root, 'child');
    await mkdir(child);
    await mkdir(path.join(root, '.venv-media', 'Scripts'), { recursive: true });
    await writeFile(path.join(root, '.venv-media', 'Scripts', 'python.exe'), 'not executed');
    assert.deepEqual(pythonRuntime({ env: {}, cwd: child, platform: 'win32' }), { executable: 'python', source: 'path' });
    assert.throws(() => pythonRuntime({ env: { AHA_PYTHON: ' ' }, cwd: child }),
      { code: 'MEDIA_PYTHON_CONFIG' });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('media doctor reports an unusable explicit runtime without success-shaped fallback', () => {
  const result = spawnSync(process.execPath, [path.resolve('dist', 'cli', 'aha.mjs'), 'doctor', '--media'], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 60000,
    env: {
      ...process.env, AHA_PYTHON: 'aha-missing-python-for-test',
      AHA_FFMPEG: 'aha-missing-ffmpeg-for-test', AHA_FFPROBE: 'aha-missing-ffprobe-for-test',
      AHA_BROWSER_EXECUTABLE: path.resolve('aha-missing-browser-for-test'),
    },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'degraded');
  assert.equal(report.pythonRuntime.source, 'override');
  assert.equal(report.pythonRuntime.executable, 'aha-missing-python-for-test');
  assert.match(report.mediaReadiness.edgeTts, /^unavailable:/);
  assert.match(report.execution, /not an OS sandbox/);
  assert.equal(report.capabilities.videoEngine, 'authored-browser-frames');
});
