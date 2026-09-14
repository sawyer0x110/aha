import { type Static, type TSchema } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { fail } from './errors.js';

export function check<T extends TSchema>(schema: T, data: unknown, path = '/'): Static<T> {
  if (Value.Check(schema, data)) return data;
  const error = Value.Errors(schema, data).First();
  return fail('SCHEMA_INVALID', error?.message ?? 'Invalid data.', `${path === '/' ? '' : path}${error?.path ?? ''}` || '/');
}
