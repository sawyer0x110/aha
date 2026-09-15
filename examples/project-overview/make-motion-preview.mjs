import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { prepareHtml } from '../../src/artifacts/html.ts';
import { sourceHash } from '../../src/artifacts/project.ts';

if (!process.argv.includes('--allow-code')) throw new Error('Review the source and obtain local browser/FFmpeg execution approval before --allow-code.');
const args = process.argv.slice(2).filter(arg => arg !== '--allow-code');
if (args.length !== 1) throw new Error('Provide a new output directory for a silent illustrative GIF, not a narrated-video receipt.');
const base = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(args[0]);
const project = path.join(base, 'projects', 'motion-preview');
await mkdir(output);
await mkdir(path.join(output, 'frames'));
const hash = await sourceHash(project);
const html = await prepareHtml(project);
const browser = await chromium.launch({ channel: process.env.AHA_BROWSER_CHANNEL || 'msedge', headless: true,
  ...(process.env.AHA_BROWSER_EXECUTABLE ? { executablePath: process.env.AHA_BROWSER_EXECUTABLE } : {}) });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, offline: true, serviceWorkers: 'block', acceptDownloads: false, reducedMotion: 'reduce' });
  const errors = [];
  await context.route('**/*', route => { errors.push(route.request().url()); return route.abort(); });
  await context.routeWebSocket('**/*', socket => { errors.push(socket.url()); socket.close(); });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<iframe sandbox="allow-scripts" title="Silent scene preview" style="position:fixed;inset:0;border:0;width:100%;height:100%"></iframe>');
  await page.locator('iframe').evaluate((el, source) => { el.srcdoc = source; }, html);
  const frame = await (await page.locator('iframe').elementHandle()).contentFrame();
  await frame.waitForFunction(() => !!window.ahaVideo);
  await frame.evaluate(async () => { await document.fonts.ready; await window.__ahaReady; });
  for (let index = 0; index < 120; index++) {
    await frame.evaluate(index => window.ahaVideo.renderFrame({
      frame: index, fps: 15, segmentIndex: index < 60 ? 2 : 3,
      segmentFrame: index % 60, segmentFrames: 60, text: ''
    }), index);
    await page.screenshot({ path: path.join(output, 'frames', `frame-${String(index).padStart(3, '0')}.png`) });
  }
  if (errors.length) throw new Error(`Unexpected browser activity: ${errors.join('; ')}`);
} finally { await browser.close(); }
await promisify(execFile)(process.env.AHA_FFMPEG || 'ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-n', '-framerate', '15', '-i', path.join(output, 'frames', 'frame-%03d.png'),
  '-filter_complex', '[0:v]scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer',
  '-loop', '0', path.join(output, 'motion-preview.gif')
], { timeout: 120000, windowsHide: true });
if (hash !== await sourceHash(project)) throw new Error('Source changed during preview creation.');
await writeFile(path.join(output, 'motion-preview.json'), JSON.stringify({
  kind: 'silent-illustrative-preview', sourceHash: hash,
  outputHash: createHash('sha256').update(await readFile(path.join(output, 'motion-preview.gif'))).digest('hex'),
  width: 960, height: 540, fps: 15, frames: 120, seconds: 8,
  scenes: [2, 3], timing: 'Four illustrative seconds per scene; not measured narration timing.',
  boundary: 'Supplementary GIF for slide illustration. Not an Aha narrated MP4 or successful Edge TTS receipt.'
}, null, 2), { flag: 'wx' });
console.log(path.join(output, 'motion-preview.gif'));
