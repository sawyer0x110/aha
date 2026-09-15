import test from 'node:test';
import assert from 'node:assert/strict';
import { sendWithRetry } from './worker.mjs';

test('successful send closes the connection and clears the deadline', async () => {
  const events = [];
  const result = await sendWithRetry('parcel', {
    transport: { open: async () => ({
      send: async () => 'sent',
      close: async () => { events.push('closed'); },
    }) },
    clock: {
      setTimeout: () => 7,
      clearTimeout: timer => events.push(`clear:${timer}`),
      sleep: async () => {},
    },
  });
  assert.equal(result, 'sent');
  assert.deepEqual(events, ['clear:7', 'closed']);
});

test('last failed attempt propagates its error', async () => {
  await assert.rejects(sendWithRetry('parcel', {
    attempts: 1,
    transport: { open: async () => ({
      send: async () => { throw new Error('offline'); },
      close: async () => {},
    }) },
    clock: { setTimeout: () => 8, clearTimeout: () => {}, sleep: async () => {} },
  }), /offline/);
});
