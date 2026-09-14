import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalize, hashValue } from '../src/core/identity.js';
import { AhaError } from '../src/core/errors.js';

test('research and artifact identities ignore object key ordering but preserve data', async () => {
  assert.equal(await hashValue({ title: 'Question', claims: ['a', 'b'] }), await hashValue({ claims: ['a', 'b'], title: 'Question' }));
  assert.notEqual(await hashValue(['a', 'b']), await hashValue(['b', 'a']));
  assert.notEqual(await hashValue({ text: 'a' }), await hashValue({ text: 'b' }));
  assert.match(await hashValue({}), /^[a-f0-9]{64}$/);
});

test('identity calculation refuses non-JSON values and excessive depth', async () => {
  for (const input of [NaN, Infinity, undefined, new Date(), () => 1, { missing: undefined }]) {
    assert.throws(() => canonicalize(input), error => error instanceof AhaError && error.code === 'JSON_VALUE');
  }
  let nested: unknown = 'leaf';
  for (let index = 0; index < 70; index++) nested = [nested];
  assert.throws(() => canonicalize(nested), error => error instanceof AhaError && error.code === 'JSON_DEPTH');
});
