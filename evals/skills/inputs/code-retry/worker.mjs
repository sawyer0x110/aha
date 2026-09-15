import { maxAttempts, requestTimeoutMs, retryDelayMs } from './config.mjs';

const realClock = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: timer => clearTimeout(timer),
  sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
};
const cancelled = () => Object.assign(new Error('cancelled'), { name: 'AbortError' });

export async function sendWithRetry(job, { signal, transport, clock = realClock, attempts = maxAttempts }) {
  const connection = await transport.open();
  try {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      if (signal?.aborted) throw cancelled();
      let timer;
      try {
        return await Promise.race([
          connection.send(job, { signal }),
          new Promise((_, reject) => {
            timer = clock.setTimeout(() => reject(new Error('deadline')), requestTimeoutMs);
          }),
        ]);
      } catch (error) {
        if (attempt === attempts) throw error;
        await clock.sleep(retryDelayMs);
      } finally {
        if (timer !== undefined) clock.clearTimeout(timer);
      }
    }
  } finally {
    await connection.close();
  }
}
