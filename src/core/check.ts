import { type Static, type TSchema } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { fail, failDiagnostics } from './errors.js';

export function check<T extends TSchema>(schema: T, data: unknown, path = '/'): Static<T> {
  if (Value.Check(schema, data)) return data;
  const errors = [...Value.Errors(schema, data)];
  failDiagnostics(errors.map(error => ({
    code: 'SCHEMA_INVALID', message: error.message,
    path: `${path === '/' ? '' : path}${error.path}` || '/',
    suggestion: 'Edit this input field to satisfy the stated schema constraint; retain unrelated valid fields.',
  })));
  const error = errors[0];
  return fail('SCHEMA_INVALID', error?.message ?? 'Invalid data.', `${path === '/' ? '' : path}${error?.path ?? ''}` || '/');
}
