import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Type } from '@sinclair/typebox';
import { check } from '../core/check.js';
import { fail } from '../core/errors.js';
import { hashValue } from '../core/identity.js';
import { VERSION } from '../core/version.js';
import { assertOutsideSource, writeNewFile, limitedJsonText } from '../cli/files.js';
import { prepareHtml } from '../artifacts/html.js';
import { readArtifact } from '../artifacts/project.js';
import { readAudio, fileHash } from './audio.js';
import { createFrameRenderer, openBrowser } from './browser.js';
import { checkPlan, FPS, subtitles, validateVideoPlan, type VideoPlan } from './plan.js';
import { ffmpeg, ffprobe, runTool } from './process.js';

const VideoProbeSchema = Type.Object({
  streams: Type.Array(Type.Object({
    codec_name: Type.String(), codec_type: Type.String(),
    width: Type.Optional(Type.Number()), height: Type.Optional(Type.Number()),
    r_frame_rate: Type.Optional(Type.String()), nb_frames: Type.Optional(Type.String()),
  })),
  format: Type.Object({ duration: Type.String() }),
});

export async function renderVideo(directory: string, input: VideoPlan, audioDirectory: string, destination: string, allowCode: boolean): Promise<object> {
  if (!allowCode) fail('AUTHOR_CODE_PERMISSION', 'Rendering executes authored JavaScript. Review the source and pass --allow-code. Browser isolation is not a hostile-code sandbox.');
  const plan = await validateVideoPlan(directory, input);
  checkPlan(plan, true);
  const { artifact } = await readArtifact(directory);
  if (artifact.status !== 'authored') fail('ARTIFACT_DRAFT', 'Author the video source before rendering.');
  const audio = await readAudio(plan, audioDirectory);
  const totalFrames = audio.segments.reduce((sum, item) => sum + item.frames, 0);
  const durationSeconds = totalFrames / FPS;
  const output = path.resolve(destination);
  await assertOutsideSource(directory, output);
  const sidecars = [`${output}.srt`, `${output}.receipt.json`];
  const failureFile = `${output}.failure.json`;
  await fs.mkdir(path.dirname(output), { recursive: true });
  for (const file of [output, ...sidecars, failureFile]) {
    try {
      await fs.lstat(file);
      fail('OUTPUT_EXISTS', 'Video or sidecar already exists; choose a new versioned path.');
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    }
  }
  const html = await prepareHtml(directory);
  await validateVideoPlan(directory, plan);
  const work = await fs.mkdtemp(path.join(path.dirname(output), '.aha-video-'));
  const written: string[] = [];
  let committed = false;
  let stage = 'browser';
  let browser: Awaited<ReturnType<typeof openBrowser>> | undefined;
  let renderer: Awaited<ReturnType<typeof createFrameRenderer>> | undefined;
  const deadline = Date.now() + 30 * 60 * 1000;
  const budget = (): number => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) fail('MEDIA_TIMEOUT', 'Video exceeded its 30 minute total render budget.');
    return Math.min(remaining, 120000);
  };
  try {
    browser = await openBrowser();
    renderer = await createFrameRenderer(html, browser);
    let globalFrame = 0;
    const samples: { frame: number; segmentIndex: number; sha256: string }[] = [];
    for (const [index, segment] of plan.segments.entries()) {
      stage = 'frames';
      const segmentFrames = audio.segments[index]!.frames;
      const sampleFrames = new Set([0, Math.floor(segmentFrames / 2), segmentFrames - 1]);
      let pngBytes = 0;
      for (let frame = 0; frame < segmentFrames; frame++) {
        budget();
        const result = await renderer.render({
          frame: globalFrame, fps: FPS, segmentIndex: index, segmentFrame: frame, segmentFrames, text: segment.text,
        }, sampleFrames.has(frame));
        pngBytes += result.png.length;
        if (pngBytes > 1024 * 1024 * 1024) fail('VIDEO_FRAME_SIZE', 'A segment exceeds the 1 GiB transient frame budget. Use shorter segments.');
        if (result.visualHash) samples.push({ frame: globalFrame, segmentIndex: index, sha256: result.visualHash });
        await fs.writeFile(path.join(work, `frame-${String(frame).padStart(5, '0')}.png`), result.png, { flag: 'wx' });
        globalFrame++;
      }
      stage = 'encode-segment';
      const stem = `segment-${String(index + 1).padStart(3, '0')}`;
      await runTool(ffmpeg(), [
        '-v', 'error', '-nostdin', '-n', '-framerate', String(FPS), '-i', 'frame-%05d.png',
        '-frames:v', String(segmentFrames), '-an', '-c:v', 'libx264', '-preset', 'veryfast',
        '-crf', '20', '-pix_fmt', 'yuv420p', '-threads', '2', `${stem}.mp4`,
      ], { cwd: work, timeoutMs: budget() });
      for (let frame = 0; frame < segmentFrames; frame++) await fs.unlink(path.join(work, `frame-${String(frame).padStart(5, '0')}.png`));
      await fs.copyFile(path.join(audioDirectory, audio.segments[index]!.filename), path.join(work, `${stem}.wav`));
      if (await fileHash(path.join(work, `${stem}.wav`)) !== audio.segments[index]!.sha256) {
        fail('AUDIO_HASH_MISMATCH', 'Audio changed while creating the render snapshot.');
      }
    }
    stage = 'mux';
    const list = (extension: string): string => plan.segments.map((_, index) =>
      `file 'segment-${String(index + 1).padStart(3, '0')}.${extension}'`).join('\n');
    await fs.writeFile(path.join(work, 'video-list.txt'), list('mp4'));
    await fs.writeFile(path.join(work, 'audio-list.txt'), list('wav'));
    await runTool(ffmpeg(), [
      '-v', 'error', '-nostdin', '-n',
      '-f', 'concat', '-safe', '1', '-i', 'video-list.txt',
      '-f', 'concat', '-safe', '1', '-i', 'audio-list.txt',
      '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k',
      '-t', String(durationSeconds), '-movflags', '+faststart', 'movie.mp4',
    ], { cwd: work, timeoutMs: budget() });
    stage = 'verify';
    const probe = check(VideoProbeSchema, JSON.parse(await runTool(ffprobe(), [
      '-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames:format=duration',
      '-of', 'json', path.join(work, 'movie.mp4'),
    ], { timeoutMs: budget() })));
    const video = probe.streams.find(stream => stream.codec_type === 'video');
    const sound = probe.streams.find(stream => stream.codec_type === 'audio');
    if (!video || video.codec_name !== 'h264' || video.width !== 1280 || video.height !== 720
      || video.r_frame_rate !== '30/1' || Number(video.nb_frames) !== totalFrames
      || sound?.codec_name !== 'aac' || !Number.isFinite(Number(probe.format.duration))
      || Math.abs(Number(probe.format.duration) - durationSeconds) > 0.15) {
      fail('VIDEO_OUTPUT_INVALID', 'Encoded output does not match the approved frame/audio specification.');
    }
    if ((await fs.stat(path.join(work, 'movie.mp4'))).size > 256 * 1024 * 1024) fail('VIDEO_SIZE', 'Video exceeds the 256 MiB output limit.');
    await validateVideoPlan(directory, plan);
    const videoBytes = await fs.readFile(path.join(work, 'movie.mp4'));
    const srt = subtitles(plan, audio);
    const receipt = {
      status: 'delivered', format: 'mp4', output: path.basename(output), rendererVersion: VERSION,
      researchHash: plan.researchHash, sourceHash: plan.sourceHash, planHash: await hashValue(plan),
      audioManifestHash: await hashValue(audio), durationSeconds, totalFrames,
      codec: 'h264', width: 1280, height: 720, fps: FPS,
      subtitles: 'sentence-level-burned-and-srt', provider: audio.provider,
      renderer: 'browser-authored-per-frame-ffmpeg',
      sampledSourceFrames: samples,
      sampledVisualChange: plan.segments.some((_, index) =>
        new Set(samples.filter(sample => sample.segmentIndex === index).map(sample => sample.sha256)).size > 1),
      determinism: 'not-verified-author-must-avoid-time-random-and-uncontrolled-state',
      audioReuse: 'visual-source-edits-invalidate-plan-and-audio-reimport-or-resynthesis-requires-explicit-approval',
      visualQuality: 'requires-human-review-frame-capability-is-not-art-quality-assurance',
      artifactHash: createHash('sha256').update(videoBytes).digest('hex'),
      subtitleHash: createHash('sha256').update(srt).digest('hex'),
      checks: ['research-source-plan-identity', 'audio-hashes-and-measured-timing', 'isolated-offline-frames', 'ffprobe-codec-frames-and-audio'],
      narrationTruthReview: 'requires-human-source-review',
      providerProvenance: 'recorded-local-manifest-not-independent-service-attestation',
    };
    stage = 'publish';
    await writeNewFile(sidecars[0]!, srt);
    written.push(sidecars[0]!);
    await writeNewFile(output, videoBytes);
    written.push(output);
    // The delivered receipt is the commit marker; failures roll back only files we created.
    await writeNewFile(sidecars[1]!, limitedJsonText(receipt, sidecars[1]!));
    written.push(sidecars[1]!);
    committed = true;
    return { ...receipt, output, subtitlesFile: sidecars[0], receiptFile: sidecars[1] };
  } catch (error) {
    await writeNewFile(failureFile, JSON.stringify({
      status: 'failed', stage, planHash: await hashValue(plan),
      message: 'No successful video delivery. Provider and authored-source error details are withheld.',
    })).catch(() => {});
    throw error;
  } finally {
    await renderer?.close().catch(() => {});
    await browser?.close().catch(() => {});
    if (!committed) for (const file of written.reverse()) await fs.unlink(file);
    await fs.rm(work, { recursive: true, force: true });
  }
}
