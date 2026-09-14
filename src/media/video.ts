import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Type } from '@sinclair/typebox';
import { check } from '../core/check.js';
import { fail } from '../core/errors.js';
import { hashValue } from '../core/identity.js';
import type { Pack } from '../core/schema.js';
import { writeNewFile, limitedJsonText } from '../cli/files.js';
import { renderSceneHtml } from '../renderers/card.js';
import { readAudio, fileHash } from './audio.js';
import { captureHtml, openBrowser } from './browser.js';
import { subtitles, type VideoPlan } from './plan.js';
import { ffmpeg, ffprobe, runTool } from './process.js';

const VideoProbeSchema = Type.Object({
  streams: Type.Array(Type.Object({
    codec_name: Type.String(), codec_type: Type.String(),
    width: Type.Optional(Type.Number()), height: Type.Optional(Type.Number()),
    r_frame_rate: Type.Optional(Type.String()), nb_frames: Type.Optional(Type.String()),
  })),
  format: Type.Object({ duration: Type.String() }),
});

export async function renderVideo(pack: Pack, plan: VideoPlan, audioDirectory: string, destination: string): Promise<object> {
  const audio = await readAudio(plan, audioDirectory);
  const totalFrames = audio.segments.reduce((sum, item) => sum + item.frames, 0);
  const durationSeconds = totalFrames / 30;
  if (durationSeconds < plan.duration.minSeconds || durationSeconds > plan.duration.maxSeconds) {
    fail('VIDEO_DURATION_RANGE', `Measured audio is ${durationSeconds.toFixed(3)} seconds; approved range is ${plan.duration.minSeconds}-${plan.duration.maxSeconds}. Revise and approve the plan, not playback speed.`);
  }
  const output = path.resolve(destination);
  const sidecars = [`${output}.srt`, `${output}.json`];
  await fs.mkdir(path.dirname(output), { recursive: true });
  for (const file of [output, ...sidecars]) {
    try {
      await fs.lstat(file);
      fail('OUTPUT_EXISTS', 'Video or sidecar already exists; choose a new versioned path.', file);
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    }
  }
  const browser = await openBrowser();
  let temp: string | undefined;
  const written: string[] = [];
  let committed = false;
  try {
    temp = await fs.mkdtemp(path.join(path.dirname(output), '.aha-video-'));
    for (const [index, segment] of plan.segments.entries()) {
      const stem = `segment-${String(index + 1).padStart(3, '0')}`;
      const png = await captureHtml(renderSceneHtml(pack, segment.slideId, segment.text), '#aha-scene', browser);
      await fs.writeFile(path.join(temp, `${stem}.png`), png);
      await runTool(ffmpeg(), [
        '-v', 'error', '-nostdin', '-n', '-loop', '1', '-framerate', '30', '-i', `${stem}.png`,
        '-frames:v', String(audio.segments[index]!.frames), '-an',
        ...(plan.segments[index - 1]?.slideId !== segment.slideId ? ['-vf', 'fade=t=in:st=0:d=0.12'] : []),
        '-c:v', 'libx264', '-preset', 'veryfast',
        '-crf', '20', '-pix_fmt', 'yuv420p', '-threads', '2', `${stem}.mp4`,
      ], { cwd: temp, timeoutMs: 120000 });
      await fs.copyFile(path.join(audioDirectory, audio.segments[index]!.filename), path.join(temp, `${stem}.wav`));
      if (await fileHash(path.join(temp, `${stem}.wav`)) !== audio.segments[index]!.sha256) {
        fail('AUDIO_HASH_MISMATCH', 'Audio changed while the render snapshot was being created.');
      }
    }
    const list = (extension: string): string => plan.segments.map((_, index) =>
      `file 'segment-${String(index + 1).padStart(3, '0')}.${extension}'`).join('\n');
    await fs.writeFile(path.join(temp, 'video-list.txt'), list('mp4'));
    await fs.writeFile(path.join(temp, 'audio-list.txt'), list('wav'));
    await runTool(ffmpeg(), [
      '-v', 'error', '-nostdin', '-n',
      '-f', 'concat', '-safe', '1', '-i', 'video-list.txt',
      '-f', 'concat', '-safe', '1', '-i', 'audio-list.txt',
      '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k',
      '-t', String(durationSeconds), '-movflags', '+faststart', 'movie.mp4',
    ], { cwd: temp, timeoutMs: 120000 });
    const probe = check(VideoProbeSchema, JSON.parse(await runTool(ffprobe(), [
      '-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames:format=duration',
      '-of', 'json', path.join(temp, 'movie.mp4'),
    ])));
    const video = probe.streams.find(stream => stream.codec_type === 'video');
    const sound = probe.streams.find(stream => stream.codec_type === 'audio');
    if (!video || video.codec_name !== 'h264' || video.width !== 1280 || video.height !== 720
      || video.r_frame_rate !== '30/1' || Number(video.nb_frames) !== totalFrames
      || sound?.codec_name !== 'aac' || Math.abs(Number(probe.format.duration) - durationSeconds) > 0.15) {
      fail('VIDEO_OUTPUT_INVALID', 'Encoded output does not match the approved frame/audio specification.');
    }
    const stat = await fs.stat(path.join(temp, 'movie.mp4'));
    if (stat.size > 256 * 1024 * 1024) fail('VIDEO_SIZE', 'Video exceeds the 256 MiB output limit.');
    const videoBytes = await fs.readFile(path.join(temp, 'movie.mp4'));
    const receipt = {
      status: 'delivered', format: 'mp4', rendererVersion: '0.2.0',
      packHash: pack.manifest.contentHash, planHash: await hashValue(plan),
      audioManifestHash: await hashValue(audio), durationSeconds, totalFrames,
      codec: 'h264', width: 1280, height: 720, fps: 30,
      subtitles: 'sentence-level-burned-and-srt', provider: audio.provider,
      animation: 'bounded-state-cards-with-short-fades-not-full-motion-graphics',
      transitions: 'only-at-slide-boundaries',
      artifactHash: createHash('sha256').update(videoBytes).digest('hex'),
      checks: ['pack-and-plan-identity', 'audio-hashes-and-measured-timing', 'offline-scene-layout', 'ffprobe-codec-frames-and-audio'],
      narrationTruthReview: 'requires-human-source-review',
      providerProvenance: 'recorded-local-manifest-not-independent-service-attestation',
    };
    await writeNewFile(sidecars[0]!, subtitles(plan, audio));
    written.push(sidecars[0]!);
    await writeNewFile(sidecars[1]!, limitedJsonText(receipt, sidecars[1]!));
    written.push(sidecars[1]!);
    await writeNewFile(output, videoBytes);
    committed = true;
    return { ...receipt, output, subtitlesFile: sidecars[0], receiptFile: sidecars[1] };
  } finally {
    await browser.close();
    if (!committed) for (const file of written) await fs.unlink(file);
    if (temp) await fs.rm(temp, { recursive: true, force: true });
  }
}
