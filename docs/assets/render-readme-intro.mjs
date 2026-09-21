import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
if (args.length !== 3 || args[0] !== '--allow-code' || !['en', 'zh-CN'].includes(args[1]) || path.extname(args[2]).toLowerCase() !== '.png') {
  throw new Error('Review the local source and approve offline capture first. Usage: node docs\\assets\\render-readme-intro.mjs --allow-code <en|zh-CN> <new.png>');
}
const source = fileURLToPath(new URL('./readme-intro.html', import.meta.url));
const url = `${pathToFileURL(source).href}?scoutTheme=light&lang=${args[1]}`;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.AHA_BROWSER_EXECUTABLE
    ? { executablePath: process.env.AHA_BROWSER_EXECUTABLE }
    : { channel: process.env.AHA_BROWSER_CHANNEL || 'msedge' }),
});
try {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1040 }, deviceScaleFactor: 1,
    offline: true, serviceWorkers: 'block', reducedMotion: 'reduce',
  });
  const errors = [];
  const blocked = [];
  await context.route('**/*', route => {
    if (route.request().isNavigationRequest() && route.request().url() === url) return route.continue();
    blocked.push(route.request().url());
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(url, { waitUntil: 'load', timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('html').getAttribute('lang'), args[1]);
  if (args[1] === 'en') assert.doesNotMatch(await page.locator('main').innerText(), /\p{Script=Han}/u);
  const layout = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
    outside: [...document.querySelectorAll('main, main *')].filter(node => {
      const r = node.getBoundingClientRect();
      return r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight;
    }).map(node => node.tagName),
  }));
  assert.deepEqual(errors, [], 'No page errors');
  assert.deepEqual(blocked, [], 'No external resources');
  assert.deepEqual(layout, { width: 1600, height: 1040, outside: [] }, 'Full composition fits the image');
  const png = await page.screenshot({ type: 'png', animations: 'disabled' });
  await writeFile(path.resolve(args[2]), png, { flag: 'wx' });
  console.log(JSON.stringify({ output: path.resolve(args[2]), language: args[1], ...layout, errors, blocked }));
} finally {
  await browser.close();
}
