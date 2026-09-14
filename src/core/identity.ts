import { fail } from './errors.js';

export function canonicalize(value: unknown, depth = 0): string {
  if (depth > 64) fail('JSON_DEPTH', 'JSON nesting exceeds the supported limit.');
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(item => canonicalize(item, depth + 1)).join(',')}]`;
  if (typeof value === 'object' && value !== null
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${canonicalize(Reflect.get(value, key), depth + 1)}`).join(',')}}`;
  }
  return fail('JSON_VALUE', 'Only finite JSON values are supported.');
}

export async function hashValue(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalize(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
