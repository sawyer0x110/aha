import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import path from 'node:path';
import { AhaError } from '../core/errors.js';

export async function runTool(executable: string, args: string[], options: {
  cwd?: string; timeoutMs?: number; maxOutput?: number;
} = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      ...(options.cwd ? { cwd: options.cwd } : {}), shell: false, windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let overflow = false;
    let timedOut = false;
    const limit = options.maxOutput ?? 256 * 1024;
    const collect = (destination: 'out' | 'err', chunk: Buffer): void => {
      if (stdout.length + stderr.length + chunk.length > limit) {
        overflow = true;
        child.kill();
        return;
      }
      if (destination === 'out') stdout += chunk.toString('utf8');
      else stderr += chunk.toString('utf8');
    };
    child.stdout.on('data', (data: Buffer) => collect('out', data));
    child.stderr.on('data', (data: Buffer) => collect('err', data));
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, options.timeoutMs ?? 60000);
    child.once('error', () => {
      clearTimeout(timer);
      reject(new AhaError('MEDIA_TOOL_MISSING', 'Media tool could not start. Install explicitly or configure its AHA_* path.'));
    });
    child.once('close', code => {
      clearTimeout(timer);
      if (timedOut) reject(new AhaError('MEDIA_TIMEOUT', `${executable} exceeded its time budget.`));
      else if (overflow) reject(new AhaError('MEDIA_OUTPUT_LIMIT', `${executable} exceeded its output budget.`));
      else if (code !== 0) reject(new AhaError('MEDIA_TOOL_FAILED', `Media tool failed (exit ${code}). Provider output is withheld to avoid exposing narration or credentials.`));
      else resolve(stdout);
    });
  });
}

export function ffmpeg(): string { return process.env.AHA_FFMPEG ?? 'ffmpeg'; }
export function ffprobe(): string { return process.env.AHA_FFPROBE ?? 'ffprobe'; }

export function pythonRuntime(options: {
  env?: NodeJS.ProcessEnv; cwd?: string; platform?: NodeJS.Platform;
} = {}): { executable: string; source: 'override' | 'active-venv' | 'project-venv' | 'path' } {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const platform = options.platform ?? process.platform;
  const inVenv = (root: string): string => path.resolve(cwd, root,
    ...(platform === 'win32' ? ['Scripts', 'python.exe'] : ['bin', 'python']));
  if (env.AHA_PYTHON !== undefined) {
    if (!env.AHA_PYTHON.trim()) throw new AhaError('MEDIA_PYTHON_CONFIG', 'AHA_PYTHON must name a Python executable, not an empty value.');
    return { executable: env.AHA_PYTHON, source: 'override' };
  }
  if (env.VIRTUAL_ENV?.trim()) {
    return { executable: inVenv(env.VIRTUAL_ENV), source: 'active-venv' };
  }
  const local = inVenv('.venv-media');
  if (statSync(local, { throwIfNoEntry: false })?.isFile()) {
    return { executable: local, source: 'project-venv' };
  }
  return { executable: 'python', source: 'path' };
}

export function python(): string { return pythonRuntime().executable; }
