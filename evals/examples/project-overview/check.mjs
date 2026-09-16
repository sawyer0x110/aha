import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { prepareHtml } from '../../../src/artifacts/html.ts';
import { sourceHash } from '../../../src/artifacts/project.ts';

if (!process.argv.includes('--allow-code')) throw new Error('Review this checker and the three browser sources; obtain local execution approval before --allow-code.');
const args = process.argv.slice(2).filter(arg => arg !== '--allow-code');
if (args.length < 2 || args.length > 3) throw new Error('Usage: node --import tsx evals\\examples\\project-overview\\check.mjs <delivery-directory> <new-qa-directory> [projects-directory] --allow-code');
const base = fileURLToPath(new URL('../../../examples/project-overview/', import.meta.url));
const delivery = path.resolve(args[0]);
const output = path.resolve(args[1]);
const projects = path.resolve(args[2] || path.join(base, 'projects'));
await mkdir(output);
const sha = data => createHash('sha256').update(data).digest('hex');
const report = {
  createdAt: new Date().toISOString(), checks: [], sourceHashes: {},
  boundary: 'Offline browser and sampled replay checks only. Replay requires identical DOM state and permits at most one 8-bit color level of browser rasterization variance. Visual/editorial, presentation editing, video listening and human comprehension are separate.',
};
for (const format of ['html', 'image', 'video']) report.sourceHashes[format] = await sourceHash(path.join(projects, format));
function pixelDifference(a, b) {
  const decode = png => {
    const result = spawnSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { input: png, maxBuffer: 8 * 1024 * 1024 });
    assert.equal(result.status, 0, result.stderr.toString());
    return result.stdout;
  };
  const left = decode(a), right = decode(b);
  assert.equal(left.length, right.length);
  let maxChannel = 0, changedChannels = 0;
  for (let i = 0; i < left.length; i++) {
    const difference = Math.abs(left[i] - right[i]);
    maxChannel = Math.max(maxChannel, difference);
    changedChannels += Number(difference > 0);
  }
  return { maxChannel, changedChannels, channelCount: left.length };
}
const browser = await chromium.launch({ channel: process.env.AHA_BROWSER_CHANNEL || 'msedge', headless: true,
  ...(process.env.AHA_BROWSER_EXECUTABLE ? { executablePath: process.env.AHA_BROWSER_EXECUTABLE } : {}) });
async function isolated(width, height, theme = 'light', allowedUrl) {
  const context = await browser.newContext({ viewport: { width, height }, offline: true, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: theme, acceptDownloads: false });
  const errors = [];
  await context.route('**/*', route => {
    if (allowedUrl && route.request().isNavigationRequest() && route.request().url() === allowedUrl) return route.continue();
    errors.push(`Blocked request: ${route.request().url()}`);
    return route.abort('blockedbyclient');
  });
  await context.routeWebSocket('**/*', socket => { errors.push(`Blocked websocket: ${socket.url()}`); socket.close(); });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', dialog => { errors.push('Unexpected dialog'); void dialog.dismiss(); });
  return { context, page, errors };
}
async function ready(page) {
  await page.waitForFunction(() => document.readyState === 'complete');
  await page.evaluate(async () => { await document.fonts.ready; await window.__ahaReady; await Promise.all([...document.images].map(image => image.decode())); });
}
async function geometry(page, fixedHeight) {
  const result = await page.evaluate(() => ({
    width: innerWidth, height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight,
    clipped: [...document.querySelectorAll('h1,h2,h3,p,li,button')].filter(el => {
      if (!el.getClientRects().length) return false;
      const style = getComputedStyle(el);
      return el.scrollWidth > el.clientWidth + 2
        || (['hidden', 'clip'].includes(style.overflowY) && el.scrollHeight > el.clientHeight + 2);
    }).map(el => el.textContent.slice(0, 70)),
    svgOverflow: [...document.querySelectorAll('svg text')].filter(el => {
      if (getComputedStyle(el).visibility === 'hidden') return false;
      const text = el.getBoundingClientRect(), svg = el.ownerSVGElement.getBoundingClientRect();
      return text.left < svg.left - 1 || text.right > svg.right + 1 || text.top < svg.top - 1 || text.bottom > svg.bottom + 1;
    }).map(el => el.textContent),
  }));
  assert(result.scrollWidth <= result.width + 1, JSON.stringify(result));
  if (fixedHeight) assert(result.scrollHeight <= result.height + 1, JSON.stringify(result));
  assert.deepEqual(result.clipped, []);
  assert.deepEqual(result.svgOverflow, []);
  return result;
}
try {
  const file = path.join(delivery, 'index.html');
  const receipt = JSON.parse(await readFile(`${file}.receipt.json`, 'utf8'));
  assert.equal(sha(await readFile(file)), receipt.outputHash);
  assert.equal(receipt.sourceHash, report.sourceHashes.html);
  for (const width of [1280, 390]) for (const theme of ['light', 'dark']) {
    const url = `${pathToFileURL(file).href}?scoutTheme=${theme}`;
    const { context, page, errors } = await isolated(width, 960, theme, url);
    try {
      await page.goto(url);
      await ready(page);
      assert.equal(await page.locator('html').getAttribute('lang'), 'en');
      for (const language of ['en', 'zh']) {
        const switcher = page.locator(`.aha-language-controls [data-language="${language}"]`);
        await switcher.focus(); await switcher.press('Enter');
        const root = page.locator(`[data-aha-lang="${language}"]`);
        assert.equal(await page.title(), await root.getAttribute('data-aha-title'));
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
        assert.equal(await page.locator('html').getAttribute('lang'), language === 'zh' ? 'zh-CN' : 'en');
        assert.equal(await page.locator(`[data-aha-lang="${language === 'en' ? 'zh' : 'en'}"]`).isVisible(), false);
        const previewImages = new Set();
        for (const format of ['html', 'image', 'pptx', 'video']) {
          const button = root.locator(`[data-format="${format}"]`);
          await button.focus(); await button.press('Space');
          assert.equal(await button.getAttribute('aria-pressed'), 'true');
          assert((await root.locator('[data-medium-copy]').textContent()).length > 25);
          assert.equal(await root.locator('[data-format][aria-pressed="true"]').count(), 1);
          assert.equal(await root.locator('.format-preview').getAttribute('data-current-format'), format);
          assert.equal(await root.locator('[data-preview]:visible').count(), 1);
          const panel = root.locator(`[data-preview="${format}"]`);
          assert(await panel.isVisible());
          assert((await panel.locator('figcaption').textContent()).length > 20);
          const image = panel.locator('img');
          assert(await image.evaluate(el => el.complete && el.naturalWidth > 0));
          previewImages.add(await image.getAttribute('src'));
          if (width === 1280 && theme === 'light') {
            await panel.screenshot({ path: path.join(output, `preview-${language}-${format}.png`) });
          }
          await geometry(page, false);
        }
        assert.equal(previewImages.size, 4, 'Each format must show a distinct corresponding image.');
        await root.locator('[data-format="html"]').click();
        assert(await root.locator('[data-preview="html"]').isVisible());
        assert.equal(await root.locator('[data-preview]:visible').count(), 1);
        if (width === 1280 && theme === 'light' && language === 'en') {
          await root.locator('#en-formats').screenshot({ path: path.join(output, 'html-example.png') });
        }
        if (width === 1280 && theme === 'light') {
          for (const section of ['purpose', 'examples', 'closing']) {
            await root.locator(`#${language}-${section}`).screenshot({ path: path.join(output, `html-${language}-${section}.png`) });
          }
        }
        const summary = root.locator('summary');
        await summary.focus(); await summary.press('Enter');
        assert.equal(await root.locator('details').evaluate(el => el.open), true);
        await summary.press('Enter');
        await page.screenshot({ path: path.join(output, `html-${width}-${theme}-${language}.png`), fullPage: true });
        report.checks.push({ id: `html-${width}-${theme}-${language}`, passed: true, geometry: await geometry(page, false) });
      }
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  for (const format of ['image', 'video']) {
    const metadata = JSON.parse(await readFile(path.join(projects, format, 'artifact.json'), 'utf8'));
    const { width, height } = metadata;
    const { context, page, errors } = await isolated(width, height);
    try {
      const html = await prepareHtml(path.join(projects, format));
      await page.setContent('<iframe sandbox="allow-scripts" style="position:fixed;inset:0;border:0;width:100%;height:100%" title="Isolated authored preview"></iframe>');
      await page.locator('iframe').evaluate((el, source) => { el.srcdoc = source; }, html);
      const frame = await (await page.locator('iframe').elementHandle()).contentFrame();
      await frame.waitForFunction(() => document.readyState === 'complete' && !!document.querySelector('h1'));
      await ready(frame);
      if (format === 'image') {
        report.checks.push({ id: 'image-size', passed: true, geometry: await geometry(frame, true) });
        await page.screenshot({ path: path.join(output, 'image-preview.png') });
      } else {
        assert.equal(await frame.locator('.scene').count(), 6);
        assert.equal(await frame.locator('.pulse, #anc-focus, #git-focus').count(), 0);
        assert.equal(await frame.locator('#anc .sample').count(), 2);
        assert.equal(await frame.locator('#git .sample').count(), 2);
        const narrationTiming = await frame.evaluate(() => window.ahaNarrationTiming);
        assert.equal(narrationTiming.segments.length, 12);
        for (let scene = 0; scene < 6; scene++) {
          const render = n => frame.evaluate(async ({ scene, n }) => {
            await window.ahaVideo.renderFrame({
              frame: n, fps: 30, segmentIndex: scene * 2, segmentFrame: n, segmentFrames: window.ahaNarrationTiming.segments[scene * 2].frames, text: 'QA frame'
            });
            await document.fonts.ready;
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          }, { scene, n });
          const finalCue = narrationTiming.segments[scene * 2].cues.at(-1).frame;
          await render(0); const a = await page.screenshot();
          const imagePositions = await frame.locator('.scene:visible .sample').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().toJSON()));
          if (scene === 1 || scene === 2) {
            const current = frame.locator('.scene:visible');
            assert.equal(await current.locator('[data-guide][data-current="true"]').count(), 0, 'Do not emphasize a diagram before the narrator mentions it.');
            assert(!/Chinese|\p{Script=Han}/u.test(await current.innerText()));
          }
          const stateA = await frame.evaluate(() => document.documentElement.outerHTML);
          await render(finalCue + 1); const b = await page.screenshot({ path: path.join(output, `video-scene-${scene}-end.png`) });
          if (scene === 1 || scene === 2) {
            assert.equal(await frame.locator('.scene:visible [data-guide][data-current="true"]').getAttribute('data-guide'), '1');
            assert.deepEqual(await frame.locator('.scene:visible .sample').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().toJSON())), imagePositions, 'Example images remain stationary; numbered reading hints change emphasis.');
          }
          await geometry(frame, true);
          const unsafe = await frame.locator('h1,h2,h3,p,img').evaluateAll(elements => elements.filter(el => el.getClientRects().length && el.getBoundingClientRect().bottom > 550).map(el => el.textContent || el.alt));
          assert.deepEqual(unsafe, [], `Caption safe area in scene ${scene}`);
          await render(0); const replay = await page.screenshot({ path: path.join(output, `video-scene-${scene}-start.png`) });
          assert.equal(stateA, await frame.evaluate(() => document.documentElement.outerHTML), `DOM replay scene ${scene}`);
          const raster = pixelDifference(a, replay);
          assert(raster.maxChannel <= 1, `Raster replay scene ${scene}: ${JSON.stringify(raster)}`);
          assert.notEqual(sha(a), sha(b), `Motion scene ${scene}`);
          report.checks.push({ id: `video-scene-${scene}`, passed: true, exactPngReplay: sha(a) === sha(replay), raster, firstHash: sha(a), replayHash: sha(replay), changedHash: sha(b) });
        }
      }
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
  await writeFile(path.join(output, 'runtime.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ status: 'passed', checks: report.checks.length, report: path.join(output, 'runtime.json') }));
} catch (error) {
  await writeFile(path.join(output, 'failure.json'), JSON.stringify({ ...report, error: error.message }, null, 2), { flag: 'wx' });
  throw error;
} finally { await browser.close(); }
