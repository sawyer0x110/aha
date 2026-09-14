import { Type, type Static } from '@sinclair/typebox';
import { createHash } from 'node:crypto';
import { check } from '../core/check.js';
import { fail } from '../core/errors.js';
import { canonicalize, hashValue } from '../core/identity.js';
import { readArtifact, sourceHash } from '../artifacts/project.js';

const closed = { additionalProperties: false } as const;
const Id = Type.String({ pattern: '^[a-z][a-z0-9-]{0,63}(?![\\s\\S])' });
const ClaimId = Type.String({ pattern: '^[A-Za-z0-9][A-Za-z0-9_-]{0,127}(?![\\s\\S])' });
const Hash = Type.String({ pattern: '^[a-f0-9]{64}(?![\\s\\S])' });
const Provider = Type.Union([Type.Literal('edge-tts'), Type.Literal('provided-audio')]);
export const FPS = 30;
export const MAX_SECONDS = 600;
export const VideoPlanSchema = Type.Object({
  schemaVersion: Type.Literal('1.0.0'),
  status: Type.Union([Type.Literal('draft'), Type.Literal('authored')]),
  researchHash: Hash, sourceHash: Hash, provider: Provider,
  voice: Type.String({ minLength: 1, maxLength: 80, pattern: '^[A-Za-z0-9-]+(?![\\s\\S])' }),
  rate: Type.String({ pattern: '^[+-](0|[1-9]|[12][0-9]|30)%(?![\\s\\S])' }),
  duration: Type.Object({
    minSeconds: Type.Number({ exclusiveMinimum: 0, maximum: MAX_SECONDS }),
    maxSeconds: Type.Number({ exclusiveMinimum: 0, maximum: MAX_SECONDS }),
  }, closed),
  segments: Type.Array(Type.Object({
    id: Id,
    text: Type.String({ minLength: 1, maxLength: 1000, pattern: '^[^\\u0000-\\u001f\\u007f\\u2028\\u2029]+(?![\\s\\S])' }),
    claimIds: Type.Array(ClaimId, { maxItems: 2000, uniqueItems: true }),
  }, closed), { minItems: 1, maxItems: 200 }),
}, { ...closed, $schema: 'http://json-schema.org/draft-07/schema#' });
export type VideoPlan = Static<typeof VideoPlanSchema>;

export function checkPlan(input: unknown, requireAuthored = false): VideoPlan {
  const plan = check(VideoPlanSchema, input);
  if (plan.duration.minSeconds > plan.duration.maxSeconds) fail('VIDEO_DURATION_RANGE', 'Minimum duration exceeds maximum.');
  if (new Set(plan.segments.map(segment => segment.id)).size !== plan.segments.length) {
    fail('VIDEO_SEGMENT_ID', 'Segment IDs must be unique.');
  }
  if (plan.segments.some(segment => !segment.text.trim())) fail('NARRATION_EMPTY', 'Narration cannot be blank.');
  if (plan.provider === 'edge-tts' && !/^[A-Za-z]{2,3}-[A-Za-z]{2,4}-[A-Za-z0-9-]+Neural$/.test(plan.voice)) {
    fail('AUDIO_VOICE', 'Edge TTS requires an explicit locale-prefixed Neural voice identifier.');
  }
  if (requireAuthored && plan.status !== 'authored') {
    fail('NARRATION_DRAFT', 'Author and review the narration, then set plan status to authored before approval or audio production.');
  }
  return plan;
}

export async function validateVideoPlan(directory: string, input: unknown): Promise<VideoPlan> {
  const plan = checkPlan(input);
  const { artifact, dossier } = await readArtifact(directory);
  if (artifact.format !== 'video' || artifact.width !== 1280 || artifact.height !== 720) {
    fail('VIDEO_ARTIFACT', 'Video requires a 1280 by 720 video artifact.');
  }
  if (plan.researchHash !== dossier.manifest.contentHash || plan.researchHash !== artifact.researchHash) {
    fail('VIDEO_RESEARCH_MISMATCH', 'Video plan references a different research snapshot.');
  }
  if (plan.sourceHash !== await sourceHash(directory)) fail('VIDEO_SOURCE_MISMATCH', 'Visual source changed. Recheck the plan and explicitly approve the new snapshot.');
  const known = new Set(dossier.research.claims.map(claim => claim.id));
  const narrated = new Set(plan.segments.flatMap(segment => segment.claimIds));
  for (const id of narrated) if (!known.has(id)) fail('VIDEO_CLAIM', 'Narration references an unknown research claim.');
  for (const id of artifact.coverage.flatMap(item => item.claimIds)) {
    if (!narrated.has(id)) fail('VIDEO_CLAIM', 'Keep all covered research claims in the narration reference list.');
  }
  return plan;
}

export async function approvePlan(plan: VideoPlan, approval: string | undefined): Promise<string> {
  checkPlan(plan, true);
  const hash = await hashValue(plan);
  if (approval !== hash) {
    fail('NARRATION_APPROVAL_REQUIRED', 'Review the exact narration, provider, voice and source, then pass the current plan hash via --approve. Any edit revokes approval.');
  }
  return hash;
}

export async function prepareVideoPlan(directory: string): Promise<VideoPlan> {
  const { artifact, dossier } = await readArtifact(directory);
  const ids = new Set(artifact.coverage.flatMap(item => item.claimIds));
  const segments = dossier.research.claims.filter(claim => ids.has(claim.id)).map((claim, index) => ({
    id: `sentence-${index + 1}`,
    text: claim.text.length <= 1000 ? claim.text.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ')
      : `Author and review a concise narration for research claim ${claim.id}.`,
    claimIds: [claim.id],
  }));
  if (!segments.length) segments.push({ id: 'sentence-1', text: 'Author and review the narration for this video.', claimIds: [] });
  return validateVideoPlan(directory, {
    schemaVersion: '1.0.0', status: 'draft', researchHash: dossier.manifest.contentHash,
    sourceHash: await sourceHash(directory), provider: 'edge-tts',
    voice: 'zh-CN-XiaoxiaoNeural', rate: '+0%',
    duration: { minSeconds: 1, maxSeconds: MAX_SECONDS }, segments,
  });
}

export const AudioManifestSchema = Type.Object({
  schemaVersion: Type.Literal('1.0.0'), planHash: Hash, provider: Provider,
  voice: Type.String({ minLength: 1, maxLength: 80 }),
  segments: Type.Array(Type.Object({
    id: Id, filename: Type.String({ pattern: '^segment-[0-9]{3}\\.wav(?![\\s\\S])' }),
    sha256: Hash, frames: Type.Integer({ minimum: 1, maximum: MAX_SECONDS * FPS }),
  }, closed), { minItems: 1, maxItems: 200 }),
}, closed);
export type AudioManifest = Static<typeof AudioManifestSchema>;

export function checkAudioTiming(plan: VideoPlan, input: unknown): AudioManifest {
  checkPlan(plan, true);
  const audio = check(AudioManifestSchema, input);
  if (audio.planHash !== createHash('sha256').update(canonicalize(plan)).digest('hex')) {
    fail('AUDIO_PLAN_MISMATCH', 'Audio belongs to a different immutable plan snapshot.');
  }
  if (audio.provider !== plan.provider || audio.voice !== plan.voice) fail('AUDIO_PLAN_MISMATCH', 'Audio provider or voice differs from the plan.');
  if (audio.segments.length !== plan.segments.length || audio.segments.some((segment, index) =>
    segment.id !== plan.segments[index]!.id || segment.filename !== `segment-${String(index + 1).padStart(3, '0')}.wav`)) {
    fail('AUDIO_SEGMENTS', 'Audio order, filenames or segment count differ from the plan.');
  }
  const seconds = audio.segments.reduce((sum, item) => sum + item.frames, 0) / FPS;
  if (seconds < plan.duration.minSeconds || seconds > plan.duration.maxSeconds || seconds > MAX_SECONDS) {
    fail('VIDEO_DURATION_RANGE', 'Measured audio is outside the approved duration range (maximum resource budget: 600 seconds).');
  }
  return audio;
}

export function subtitles(plan: VideoPlan, audio: AudioManifest): string {
  checkAudioTiming(plan, audio);
  let frame = 0;
  const timestamp = (value: number): string => {
    const total = Math.round(value * 1000 / FPS);
    const hours = Math.floor(total / 3600000);
    const minutes = Math.floor(total / 60000) % 60;
    const seconds = Math.floor(total / 1000) % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(total % 1000).padStart(3, '0')}`;
  };
  return audio.segments.map((segment, index) => {
    const start = frame;
    frame += segment.frames;
    const text = plan.segments[index]!.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `${index + 1}\n${timestamp(start)} --> ${timestamp(frame)}\n${text}\n`;
  }).join('\n');
}
