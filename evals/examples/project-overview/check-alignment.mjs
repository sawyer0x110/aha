import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { prepareHtml } from '../../../src/artifacts/html.ts';
import { sourceHash } from '../../../src/artifacts/project.ts';

if (!process.argv.includes('--allow-code')) throw new Error('Review the sources and obtain local browser execution approval.');
const [project, wordFile, output] = process.argv.slice(2).filter(value => value !== '--allow-code');
assert(project && wordFile && output, 'Provide project, word-timing evidence and a new report directory.');
await mkdir(output);
const words = JSON.parse(await readFile(wordFile, 'utf8'));
const browser = await chromium.launch({ channel: process.env.AHA_BROWSER_CHANNEL || 'msedge', headless: true });
const checks = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, offline: true, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const errors = [];
  await context.route('**/*', route => { errors.push(route.request().url()); return route.abort(); });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<iframe sandbox="allow-scripts" style="position:fixed;inset:0;border:0;width:100%;height:100%" title="Narration alignment"></iframe>');
  await page.locator('iframe').evaluate((el, html) => { el.srcdoc = html; }, await prepareHtml(project));
  const frame = await (await page.locator('iframe').elementHandle()).contentFrame();
  await frame.waitForFunction(() => document.readyState === 'complete' && !!window.ahaVideo);
  await frame.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode())); });
  const timing = await frame.evaluate(() => window.ahaNarrationTiming);
  assert.equal(timing.segments.length, words.segments.length);
  const normalize = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const observed = () => frame.evaluate(() => {
    const root = document.querySelector('.scene:not([hidden])');
    const selected = (selector, attribute, indexAttribute) => [...root.querySelectorAll(selector)].flatMap((el, index) => el.getAttribute(attribute) === 'true' ? [indexAttribute ? Number(el.getAttribute(indexAttribute)) : index] : []);
    const result = {
      guide: selected('[data-guide]', 'data-current', 'data-guide'),
      step: selected('.step', 'data-active'),
      format: selected('.format-card', 'data-active'),
      note: [...root.querySelectorAll('.sample-note,.end-note')].some(el => el.dataset.speaking === 'true'),
    };
    for (const key of ['headline', 'skill', 'takeaway', 'usecase']) result[key] = selected(`[data-${key}]`, 'data-speaking', `data-${key}`);
    return result;
  });
  for (const [index, segment] of timing.segments.entries()) {
    const original = words.segments[index];
    assert.equal(segment.audioHash, original.audioHash);
    assert.equal(normalize(segment.narration), normalize(original.recognizedText));
    const render = n => frame.evaluate(({ index, n }) => window.ahaVideo.renderFrame({ frame: n, fps: 30, segmentIndex: index, segmentFrame: n, segmentFrames: window.ahaNarrationTiming.segments[index].frames }), { index, n });
    for (const cue of segment.cues) {
      assert(original.words.some(word => word.word === cue.word && Math.abs(word.start - cue.wordStart) < .0001));
      const delta = cue.frame / 30 - cue.wordStart;
      assert(delta >= -1e-7 && delta < 1 / 30 + 1e-7, `Cue outside one frame: ${segment.id}/${cue.word}`);
      for (const n of [cue.frame - 1, cue.frame, cue.frame + 1]) {
        const state = { headline: -1, guide: -1, step: -1, skill: -1, format: -1, takeaway: -1, usecase: -1, note: false, ...segment.base };
        for (const event of segment.cues) if (event.frame <= n) state[event.property] = event.value;
        await render(n);
        const actual = await observed();
        for (const key of Object.keys(actual)) {
          const expected = key === 'note' ? state.note : state[key] < 0 ? [] : [state[key]];
          assert.deepEqual(actual[key], expected, `${segment.id}/${cue.word}/${n}/${key}`);
        }
        if (index === 8 && state.format === 3) {
          const height = await frame.locator('.bar').nth(2).evaluate(el => parseFloat(el.style.height));
          assert.equal(height, Math.round(24 + 100 * (segment.envelope[n] ?? 0)));
        }
      }
      await render(cue.frame);
      const before = await frame.evaluate(() => document.documentElement.outerHTML);
      await render(segment.frames - 1);
      await render(cue.frame);
      assert.equal(await frame.evaluate(() => document.documentElement.outerHTML), before, `Cue replay: ${segment.id}/${cue.word}`);
      checks.push({ segment: segment.id, word: cue.word, property: cue.property, value: cue.value, wordStart: cue.wordStart, frame: cue.frame, offsetSeconds: delta, boundaryAndReplay: true });
    }
    if (segment.cues.length) {
      await render(segment.cues.at(-1).frame);
      await page.screenshot({ path: path.join(output, `segment-${index + 1}.png`) });
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'alignment.json'), JSON.stringify({
    sourceHash: await sourceHash(project), method: timing.method, checks,
    scope: 'Every emphasis transition tested immediately before, at and after the estimated spoken-word cue. DOM rewind checked. Each cue lies within one video frame of its estimated word onset. Not a human listening verdict.',
  }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ cues: checks.length, maxOffsetSeconds: Math.max(...checks.map(check => check.offsetSeconds)) }));
} finally { await browser.close(); }
