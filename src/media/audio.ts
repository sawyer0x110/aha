import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Type } from '@sinclair/typebox';
import { check } from '../core/check.js';
import { fail } from '../core/errors.js';
import { hashValue } from '../core/identity.js';
import { limitedJsonText, readJson, writeNewFile } from '../cli/files.js';
import { AudioManifestSchema, type AudioManifest, type VideoPlan } from './plan.js';
import { ffmpeg, ffprobe, python, runTool } from './process.js';

const Probe = Type.Object({
  format: Type.Object({ duration: Type.String() }),
  streams: Type.Array(Type.Object({
    codec_type: Type.String(), codec_name: Type.String(),
    sample_rate: Type.Optional(Type.String()), channels: Type.Optional(Type.Number()),
  })),
});

export async function fileHash(file: string): Promise<string> {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) fail('MEDIA_FILE_TYPE', 'Media must be a regular local file.', file);
  if (stat.size === 0 || stat.size > 32 * 1024 * 1024) fail('MEDIA_FILE_SIZE', 'Audio/frame exceeds 32 MiB or is empty.', file);
  return createHash('sha256').update(await fs.readFile(file)).digest('hex');
}

export async function audioSeconds(file: string): Promise<number> {
  await fileHash(file);
  const result = await runTool(ffprobe(), [
    '-v', 'error', '-protocol_whitelist', 'file,pipe',
    '-show_entries', 'format=duration:stream=codec_type,codec_name,sample_rate,channels',
    '-of', 'json', path.resolve(file),
  ]);
  const probe = check(Probe, JSON.parse(result));
  const seconds = Number(probe.format.duration);
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 60 || !probe.streams.some(stream => stream.codec_type === 'audio')) {
    fail('AUDIO_DURATION', 'Every narration segment must contain 0-60 seconds of real audio.', file);
  }
  return seconds;
}

export async function normalizeAudio(input: string, output: string): Promise<number> {
  if (!['.wav', '.mp3', '.m4a'].includes(path.extname(input).toLowerCase())) {
    fail('AUDIO_FORMAT', 'Provide a local WAV, MP3 or M4A narration segment.', input);
  }
  const seconds = await audioSeconds(input);
  const frames = Math.ceil(seconds * 30);
  await runTool(ffmpeg(), [
    '-v', 'error', '-nostdin', '-n', '-protocol_whitelist', 'file,pipe',
    '-i', path.resolve(input), '-vn', '-ac', '1', '-ar', '48000',
    '-af', 'apad', '-t', String(frames / 30), '-c:a', 'pcm_s16le', path.resolve(output),
  ]);
  return frames;
}

export async function synthesize(
  plan: VideoPlan, destination: string, allowNetwork: boolean,
  script = fileURLToPath(new URL('./edge_speech.py', import.meta.url)),
): Promise<AudioManifest> {
  if (!allowNetwork) fail('TTS_NETWORK_PERMISSION', 'Edge TTS sends approved narration to Microsoft online services. Explicit --allow-network is required.');
  const version = (await runTool(python(), ['-c', 'import edge_tts; print(edge_tts.__version__)'])).trim();
  if (version !== '7.2.8') fail('TTS_VERSION', 'This adapter requires edge-tts==7.2.8; install the supplied media requirements explicitly.');
  await runTool(ffmpeg(), ['-version']);
  await runTool(ffprobe(), ['-version']);
  const output = path.resolve(destination);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.mkdir(output);
  const planHash = await hashValue(plan);
  const manifest: AudioManifest = { schemaVersion: '0.2.0', planHash, provider: 'edge-tts', voice: plan.voice, segments: [] };
  let stage = 'prepare';
  try {
    for (const [index, segment] of plan.segments.entries()) {
      stage = segment.id;
      const stem = `segment-${String(index + 1).padStart(3, '0')}`;
      const request = path.join(output, `${stem}.request.json`);
      const raw = path.join(output, `${stem}.mp3`);
      await fs.writeFile(request, JSON.stringify({ text: segment.text, voice: plan.voice, rate: plan.rate }), { flag: 'wx' });
      try {
        await runTool(python(), [script, request, raw], { timeoutMs: 90000 });
      } finally {
        await fs.unlink(request);
      }
      const filename = `${stem}.wav`;
      const frames = await normalizeAudio(raw, path.join(output, filename));
      manifest.segments.push({ id: segment.id, filename, frames, sha256: await fileHash(path.join(output, filename)) });
    }
    await writeNewFile(path.join(output, 'manifest.json'), limitedJsonText(manifest, output));
    return manifest;
  } catch (error) {
    await writeNewFile(path.join(output, 'failure.json'), JSON.stringify({
      status: 'failed', stage, planHash, provider: 'edge-tts',
      message: 'Audio incomplete. Existing segments are retained, but this directory is not renderable without a validated manifest.',
    }));
    throw error;
  }
}

export const ProvidedAudioSchema = Type.Object({
  segments: Type.Array(Type.Object({
    id: Type.String(), file: Type.String({ minLength: 1, maxLength: 2000 }),
  }, { additionalProperties: false }), { minItems: 1, maxItems: 40 }),
}, { additionalProperties: false });

export async function importAudio(plan: VideoPlan, input: unknown, listDirectory: string, destination: string): Promise<AudioManifest> {
  const provided = check(ProvidedAudioSchema, input);
  if (provided.segments.length !== plan.segments.length
    || provided.segments.some((item, index) => item.id !== plan.segments[index]?.id)) {
    fail('AUDIO_SEGMENTS', 'Provide one audio file for each approved sentence in the same order.');
  }
  const sources = provided.segments.map(item => path.resolve(listDirectory, item.file));
  for (const source of sources) await audioSeconds(source);
  await fs.mkdir(path.dirname(path.resolve(destination)), { recursive: true });
  await fs.mkdir(destination);
  const manifest: AudioManifest = {
    schemaVersion: '0.2.0', planHash: await hashValue(plan), provider: 'provided-audio', voice: 'user-provided', segments: [],
  };
  for (const [index, source] of sources.entries()) {
    const filename = `segment-${String(index + 1).padStart(3, '0')}.wav`;
    const frames = await normalizeAudio(source, path.join(destination, filename));
    manifest.segments.push({ id: plan.segments[index]!.id, filename, frames, sha256: await fileHash(path.join(destination, filename)) });
  }
  await writeNewFile(path.join(destination, 'manifest.json'), limitedJsonText(manifest, destination));
  return manifest;
}

export async function readAudio(plan: VideoPlan, directory: string): Promise<AudioManifest> {
  const info = await fs.lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) fail('AUDIO_DIRECTORY', 'Expected a local audio directory, not a link.', directory);
  const manifest = check(AudioManifestSchema, await readJson(path.join(directory, 'manifest.json')));
  if (manifest.planHash !== await hashValue(plan)) fail('AUDIO_PLAN_MISMATCH', 'Audio belongs to a different narration/voice revision.');
  if (manifest.provider === 'edge-tts' && manifest.voice !== plan.voice) fail('AUDIO_PLAN_MISMATCH', 'Recorded Edge voice differs from the approved plan.');
  if (manifest.segments.length !== plan.segments.length) fail('AUDIO_SEGMENTS', 'Audio segment count differs from the plan.');
  for (const [index, segment] of manifest.segments.entries()) {
    if (segment.id !== plan.segments[index]!.id || segment.filename !== `segment-${String(index + 1).padStart(3, '0')}.wav`) {
      fail('AUDIO_SEGMENTS', 'Audio order or filenames differ from the plan.');
    }
    const file = path.join(directory, segment.filename);
    if (segment.sha256 !== await fileHash(file)) fail('AUDIO_HASH_MISMATCH', 'Audio file differs from its recorded identity.', file);
    const seconds = await audioSeconds(file);
    if (Math.abs(seconds - segment.frames / 30) > 0.001) fail('AUDIO_TIMING', 'Audio duration is not consistent with frame timing.', file);
  }
  return manifest;
}
