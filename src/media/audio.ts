import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Type } from '@sinclair/typebox';
import { check } from '../core/check.js';
import { fail } from '../core/errors.js';
import { hashValue } from '../core/identity.js';
import { assertSafePath, limitedJsonText, readJson, writeNewFile } from '../cli/files.js';
import { AudioManifestSchema, checkAudioTiming, checkPlan, type AudioManifest, type VideoPlan } from './plan.js';
import { ffmpeg, ffprobe, python, runTool } from './process.js';
import { audioTiming } from './duration.js';

const Probe = Type.Object({
  format: Type.Object({ duration: Type.String() }),
  streams: Type.Array(Type.Object({
    codec_type: Type.String(), codec_name: Type.String(),
    sample_rate: Type.Optional(Type.String()), channels: Type.Optional(Type.Number()),
    duration_ts: Type.Optional(Type.Union([Type.Number(), Type.String()])), time_base: Type.Optional(Type.String()),
  })),
});

export async function fileHash(file: string): Promise<string> {
  await assertSafePath(file);
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) fail('MEDIA_FILE_TYPE', 'Media must be a regular local file.', file);
  if (stat.size === 0 || stat.size > 128 * 1024 * 1024) fail('MEDIA_FILE_SIZE', 'Audio/frame exceeds 128 MiB or is empty.', file);
  return createHash('sha256').update(await fs.readFile(file)).digest('hex');
}

async function probeAudio(file: string, normalized = false): Promise<{ seconds: number; frames: number }> {
  await fileHash(file);
  const result = await runTool(ffprobe(), [
    '-v', 'error', '-protocol_whitelist', 'file,pipe',
    '-show_entries', 'format=duration:stream=codec_type,codec_name,sample_rate,channels,duration_ts,time_base',
    '-of', 'json', path.resolve(file),
  ]);
  const probe = check(Probe, JSON.parse(result));
  const audio = probe.streams.filter(stream => stream.codec_type === 'audio');
  if (!audio.length) {
    fail('AUDIO_DURATION', 'Every narration segment must contain positive audio of at most 600 seconds.', file);
  }
  if (normalized && (probe.streams.length !== 1 || probe.streams[0]!.codec_name !== 'pcm_s16le'
    || probe.streams[0]!.sample_rate !== '48000' || probe.streams[0]!.channels !== 1)) {
    fail('AUDIO_FORMAT', 'Normalized audio must be mono 48 kHz PCM s16le.');
  }
  // Multiple audio streams retain the container-duration budget; stream selection is unchanged.
  const stream = audio.length === 1 ? audio[0] : undefined;
  return audioTiming(probe.format.duration, stream?.duration_ts, stream?.time_base, file);
}

export async function audioSeconds(file: string, normalized = false): Promise<number> {
  return (await probeAudio(file, normalized)).seconds;
}

export async function normalizeAudio(input: string, output: string): Promise<number> {
  await assertSafePath(output);
  if (!['.wav', '.mp3', '.m4a'].includes(path.extname(input).toLowerCase())) {
    fail('AUDIO_FORMAT', 'Provide a local WAV, MP3 or M4A narration segment.', input);
  }
  const { frames } = await probeAudio(input);
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
  checkPlan(plan, true);
  if (plan.provider !== 'edge-tts') fail('AUDIO_PROVIDER', 'Synthesis requires an explicitly selected edge-tts plan.');
  if (!allowNetwork) fail('TTS_NETWORK_PERMISSION', 'Edge TTS sends approved narration to Microsoft online services. Explicit --allow-network is required.');
  const version = (await runTool(python(), ['-c', 'import edge_tts; print(edge_tts.__version__)'])).trim();
  if (version !== '7.2.8') fail('TTS_VERSION', 'This adapter requires edge-tts==7.2.8; install the supplied media requirements explicitly.');
  await runTool(ffmpeg(), ['-version']);
  await runTool(ffprobe(), ['-version']);
  const output = path.resolve(destination);
  await assertSafePath(output);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.mkdir(output);
  const planHash = await hashValue(plan);
  const manifest: AudioManifest = { schemaVersion: '1.0.0', planHash, provider: 'edge-tts', voice: plan.voice, segments: [] };
  let stage = 'prepare';
  const deadline = Date.now() + 30 * 60 * 1000;
  try {
    for (const [index, segment] of plan.segments.entries()) {
      if (Date.now() > deadline) fail('MEDIA_TIMEOUT', 'Audio synthesis exceeded its 30 minute total budget.');
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
      await fs.unlink(raw);
      manifest.segments.push({ id: segment.id, filename, frames, sha256: await fileHash(path.join(output, filename)) });
    }
    checkAudioTiming(plan, manifest);
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
  }, { additionalProperties: false }), { minItems: 1, maxItems: 200 }),
}, { additionalProperties: false });

export async function importAudio(plan: VideoPlan, input: unknown, listDirectory: string, destination: string): Promise<AudioManifest> {
  checkPlan(plan, true);
  if (plan.provider !== 'provided-audio') fail('AUDIO_PROVIDER', 'Audio import requires an explicitly selected provided-audio plan.');
  const provided = check(ProvidedAudioSchema, input);
  if (provided.segments.length !== plan.segments.length
    || provided.segments.some((item, index) => item.id !== plan.segments[index]?.id)) {
    fail('AUDIO_SEGMENTS', 'Provide one audio file for each approved sentence in the same order.');
  }
  const sources = provided.segments.map(item => path.resolve(listDirectory, item.file));
  let totalFrames = 0;
  for (const source of sources) totalFrames += (await probeAudio(source)).frames;
  if (totalFrames / 30 < plan.duration.minSeconds || totalFrames / 30 > plan.duration.maxSeconds) {
    fail('VIDEO_DURATION_RANGE', 'Provided audio is outside the approved duration range.');
  }
  await assertSafePath(destination);
  await fs.mkdir(path.dirname(path.resolve(destination)), { recursive: true });
  await fs.mkdir(destination);
  const manifest: AudioManifest = {
    schemaVersion: '1.0.0', planHash: await hashValue(plan), provider: 'provided-audio', voice: plan.voice, segments: [],
  };
  let stage = 'prepare';
  const deadline = Date.now() + 30 * 60 * 1000;
  try {
    for (const [index, source] of sources.entries()) {
      if (Date.now() > deadline) fail('MEDIA_TIMEOUT', 'Audio import exceeded its 30 minute total budget.');
      stage = plan.segments[index]!.id;
      const filename = `segment-${String(index + 1).padStart(3, '0')}.wav`;
      const frames = await normalizeAudio(source, path.join(destination, filename));
      manifest.segments.push({ id: stage, filename, frames, sha256: await fileHash(path.join(destination, filename)) });
    }
    checkAudioTiming(plan, manifest);
    await writeNewFile(path.join(destination, 'manifest.json'), limitedJsonText(manifest, destination));
    return manifest;
  } catch (error) {
    await writeNewFile(path.join(destination, 'failure.json'), JSON.stringify({
      status: 'failed', stage, planHash: manifest.planHash, provider: plan.provider,
      message: 'Audio incomplete; no renderable manifest was published.',
    }));
    throw error;
  }
}

export async function readAudio(plan: VideoPlan, directory: string): Promise<AudioManifest> {
  checkPlan(plan, true);
  await assertSafePath(directory);
  const info = await fs.lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) fail('AUDIO_DIRECTORY', 'Expected a local audio directory, not a link.', directory);
  const manifest = check(AudioManifestSchema, await readJson(path.join(directory, 'manifest.json')));
  if (manifest.planHash !== await hashValue(plan)) fail('AUDIO_PLAN_MISMATCH', 'Audio belongs to a different narration/voice revision.');
  checkAudioTiming(plan, manifest);
  for (const [index, segment] of manifest.segments.entries()) {
    if (segment.id !== plan.segments[index]!.id || segment.filename !== `segment-${String(index + 1).padStart(3, '0')}.wav`) {
      fail('AUDIO_SEGMENTS', 'Audio order or filenames differ from the plan.');
    }
    const file = path.join(directory, segment.filename);
    if (segment.sha256 !== await fileHash(file)) fail('AUDIO_HASH_MISMATCH', 'Audio file differs from its recorded identity.', file);
    const seconds = await audioSeconds(file, true);
    if (Math.abs(seconds - segment.frames / 30) > 0.001) fail('AUDIO_TIMING', 'Audio duration is not consistent with frame timing.', file);
  }
  return manifest;
}
