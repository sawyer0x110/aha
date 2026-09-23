import { chromium } from 'playwright-core';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';

if (!process.argv.includes('--allow-code')) throw new Error('Obtain local browser playback approval before using --allow-code.');
const args = process.argv.slice(2).filter(arg => arg !== '--allow-code');
if (args.length !== 2) throw new Error('Usage: node check-playback.mjs <video.mp4> <new-report.json> --allow-code');
const root = fileURLToPath(new URL('../../', import.meta.url));
const file = path.resolve(root, args[0]);
const receipt = JSON.parse(await readFile(`${file}.receipt.json`, 'utf8'));
const artifactHash = createHash('sha256').update(await readFile(file)).digest('hex');
assert.equal(artifactHash, receipt.artifactHash);
const url = pathToFileURL(file).href;
const browser = await chromium.launch({
  channel: process.env.AHA_BROWSER_CHANNEL || 'msedge', headless: true,
  ...(process.env.AHA_BROWSER_EXECUTABLE ? { executablePath: process.env.AHA_BROWSER_EXECUTABLE } : {}),
});
try {
  const context = await browser.newContext({ offline: true, serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const errors = [];
  await context.route('**/*', route => {
    if (route.request().url() === url) return route.continue();
    errors.push(`Blocked request: ${route.request().url()}`);
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.locator('video').evaluate(async video => {
    video.muted = true;
    video.currentTime = 0;
    await video.play();
  });
  await page.waitForFunction(() => document.querySelector('video')?.ended, undefined, { timeout: Math.ceil(receipt.durationSeconds * 1000) + 30000 });
  const result = await page.locator('video').evaluate(video => ({
    ended: video.ended, seconds: video.currentTime, width: video.videoWidth, height: video.videoHeight,
    error: video.error?.message ?? null,
    decodedFrames: video.getVideoPlaybackQuality().totalVideoFrames,
    droppedFrames: video.getVideoPlaybackQuality().droppedVideoFrames,
  }));
  assert(result.ended && !result.error);
  assert.equal(result.width, receipt.width);
  assert.equal(result.height, receipt.height);
  assert(Math.abs(result.seconds - receipt.durationSeconds) < .1);
  assert.deepEqual(errors, []);
  await writeFile(path.resolve(root, args[1]), JSON.stringify({
    artifactHash, ...result, observedAt: new Date().toISOString(),
    scope: 'Actual complete muted playback in headless Edge; not audio listening or human visual acceptance.',
  }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
