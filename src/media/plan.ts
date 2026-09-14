import { Type, type Static } from '@sinclair/typebox';
import { check } from '../core/check.js';
import { fail } from '../core/errors.js';
import { hashValue } from '../core/identity.js';
import type { Pack } from '../core/schema.js';

const closed = { additionalProperties: false } as const;
const Id = Type.String({ pattern: '^[a-z][a-z0-9-]{0,63}(?![\\s\\S])' });
const Hash = Type.String({ pattern: '^[a-f0-9]{64}(?![\\s\\S])' });
export const VideoPlanSchema = Type.Object({
  schemaVersion: Type.Literal('0.2.0'),
  packHash: Hash,
  voice: Type.String({ pattern: '^zh-CN-[A-Za-z]+Neural(?![\\s\\S])', maxLength: 80 }),
  rate: Type.String({ pattern: '^[+-](0|[1-9]|[12][0-9]|30)%(?![\\s\\S])' }),
  duration: Type.Object({
    minSeconds: Type.Number({ minimum: 5, maximum: 180 }),
    maxSeconds: Type.Number({ minimum: 5, maximum: 180 }),
  }, closed),
  segments: Type.Array(Type.Object({
    id: Id, slideId: Id,
    text: Type.String({ minLength: 1, maxLength: 84, pattern: '^[^\\u0000-\\u001f<>]+(?![\\s\\S])' }),
    claimIds: Type.Array(Id, { maxItems: 100, uniqueItems: true }),
  }, closed), { minItems: 1, maxItems: 40 }),
}, { ...closed, $schema: 'http://json-schema.org/draft-07/schema#' });
export type VideoPlan = Static<typeof VideoPlanSchema>;

export function validateVideoPlan(pack: Pack, data: unknown): VideoPlan {
  const plan = check(VideoPlanSchema, data);
  if (plan.packHash !== pack.manifest.contentHash) fail('VIDEO_PACK_MISMATCH', 'Video plan must reference the exact Pack snapshot.', '/packHash');
  if (plan.duration.minSeconds > plan.duration.maxSeconds) fail('VIDEO_DURATION_RANGE', 'Minimum duration exceeds maximum.', '/duration');
  const ids = new Set<string>();
  for (const [index, segment] of plan.segments.entries()) {
    if (ids.has(segment.id)) fail('VIDEO_SEGMENT_ID', 'Segment IDs must be unique.', `/segments/${index}/id`);
    ids.add(segment.id);
    const slide = pack.narrative.slides.find(item => item.id === segment.slideId);
    if (!slide) fail('VIDEO_SLIDE', 'Video segment references an unknown slide.', `/segments/${index}/slideId`);
    for (const id of segment.claimIds) {
      if (!slide.claimIds.includes(id)) fail('VIDEO_CLAIM', 'Narration claim must be attached to its source slide.', `/segments/${index}/claimIds`);
    }
    if (slide.claimIds.some(id => !segment.claimIds.includes(id))) {
      fail('VIDEO_CLAIM', 'Keep every source slide Claim ID in the narration reference list.', `/segments/${index}/claimIds`);
    }
  }
  return plan;
}

export async function approvePlan(pack: Pack, data: unknown, approvedHash: string): Promise<VideoPlan> {
  const plan = validateVideoPlan(pack, data);
  if (!approvedHash || approvedHash !== await hashValue(plan)) {
    fail('NARRATION_APPROVAL_REQUIRED', 'Review the complete narration and provider, then pass its current plan hash via --approve. Editing any text or voice requires approval again.');
  }
  return plan;
}

export function prepareVideoPlan(pack: Pack): VideoPlan {
  const segments: VideoPlan['segments'] = [];
  for (const slide of pack.narrative.slides) {
    const parts = (slide.notes.trim() || slide.body).match(/[^。！？!?；;\n]+[。！？!?；;]?/gu) ?? [];
    for (const text of parts.map(part => part.trim()).filter(Boolean)) {
      if (text.length > 84) fail('NARRATION_LENGTH', `Shorten narration for slide ${slide.id} into sentences of at most 84 characters.`, '/narrative/slides');
      segments.push({ id: `sentence-${segments.length + 1}`, slideId: slide.id, text, claimIds: [...slide.claimIds] });
    }
    if (slide.scenarioId) {
      const trace = pack.traces.find(item => item.scenarioId === slide.scenarioId);
      if (trace && slide.eventStep === undefined && trace.engine !== 'evidence') {
        const text = trace.engine === 'compound'
          ? `在这个模型案例中，最终余额是 ${String(trace.result.balance)}。`
          : `在这个模型案例中，总共尝试 ${String(trace.result.attempt)} 次，累计计划等待 ${String(trace.result.totalDelayMs)} 毫秒，不是真实耗时。`;
        segments.push({ id: `sentence-${segments.length + 1}`, slideId: slide.id, text, claimIds: [...slide.claimIds] });
      }
    }
  }
  return validateVideoPlan(pack, {
    schemaVersion: '0.2.0', packHash: pack.manifest.contentHash,
    voice: 'zh-CN-XiaoxiaoNeural', rate: '+0%',
    duration: { minSeconds: 60, maxSeconds: 90 }, segments,
  });
}

export const AudioManifestSchema = Type.Object({
  schemaVersion: Type.Literal('0.2.0'), planHash: Hash,
  provider: Type.Union([Type.Literal('edge-tts'), Type.Literal('provided-audio')]),
  voice: Type.String({ maxLength: 80 }),
  segments: Type.Array(Type.Object({
    id: Id, filename: Type.String({ pattern: '^segment-[0-9]{3}\\.wav(?![\\s\\S])' }),
    sha256: Hash, frames: Type.Integer({ minimum: 1, maximum: 1800 }),
  }, closed), { minItems: 1, maxItems: 40 }),
}, closed);
export type AudioManifest = Static<typeof AudioManifestSchema>;

export function subtitles(plan: VideoPlan, audio: AudioManifest): string {
  let frame = 0;
  const timestamp = (value: number): string => {
    const total = Math.round(value * 1000 / 30);
    const hours = Math.floor(total / 3600000);
    const minutes = Math.floor(total / 60000) % 60;
    const seconds = Math.floor(total / 1000) % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(total % 1000).padStart(3, '0')}`;
  };
  return audio.segments.map((segment, index) => {
    const start = frame;
    frame += segment.frames;
    return `${index + 1}\n${timestamp(start)} --> ${timestamp(frame)}\n${plan.segments[index]!.text}\n`;
  }).join('\n');
}
