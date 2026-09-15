import { fail } from '../core/errors.js';
import { FPS, MAX_SECONDS } from './plan.js';

/** Prefer stream ticks over ffprobe's rounded decimal duration (notably for PCM sample counts). */
export function audioTiming(duration: string, ticks?: number | string, timeBase?: string, location?: string): { seconds: number; frames: number } {
  let numerator: bigint;
  let denominator: bigint;
  if (ticks !== undefined && ticks !== 'N/A' && timeBase !== undefined && timeBase !== 'N/A') {
    const value = String(ticks);
    const base = /^([0-9]{1,30})\/([0-9]{1,30})$/.exec(timeBase);
    if (!/^[0-9]{1,30}$/.test(value) || (typeof ticks === 'number' && !Number.isSafeInteger(ticks)) || !base) {
      return fail('AUDIO_DURATION', 'Audio must have a valid exact stream duration.', location);
    }
    numerator = BigInt(value) * BigInt(base[1]!);
    denominator = BigInt(base[2]!);
  } else {
    const decimal = /^([0-9]{1,30})(?:\.([0-9]{1,30}))?$/.exec(duration);
    if (!decimal) return fail('AUDIO_DURATION', 'Audio must have a positive measured duration.', location);
    const fraction = decimal[2] ?? '';
    numerator = BigInt(decimal[1]! + fraction);
    denominator = 10n ** BigInt(fraction.length);
  }
  if (denominator <= 0n || numerator <= 0n || numerator > BigInt(MAX_SECONDS) * denominator) {
    return fail('AUDIO_DURATION', 'Every narration segment must contain positive audio of at most 600 seconds.', location);
  }
  return {
    seconds: Number(numerator) / Number(denominator),
    frames: Number((numerator * BigInt(FPS) + denominator - 1n) / denominator),
  };
}
