import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

if (!process.argv.includes('--allow-code')) throw new Error('Review the source and obtain local browser execution approval, then pass --allow-code.');
const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2).filter(arg => arg !== '--allow-code' && arg !== '--screenshots');
assert(args.length === 2 && args[0] === '--output', 'Usage: node evals/examples/check-html.mjs --allow-code --output <new-repo-relative-directory> [--screenshots]');
const output = path.resolve(root, args[1]);
const relative = path.relative(root, output);
assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Output must be inside the repository');
await mkdir(output); // Exclusive creation: never overwrite or relabel prior QA evidence.
const screenshots = process.argv.includes('--screenshots');
const { chromium } = await import('playwright-core');
const report = {
  observedAt: new Date().toISOString(), cases: [], failures: [],
  scope: 'Fresh offline behavior for four bilingual explanations at 1280/390/320px in both themes. Not new subject experiments, listening, screen-reader or comprehension acceptance.',
};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function check(record, name, action) {
  try { await action(); record.checks.push({ name, passed: true }); }
  catch (error) {
    record.checks.push({ name, passed: false, message: error.message });
    report.failures.push({ case: record.id, name, message: error.message });
  }
}
async function activate(button, keyboard = true) {
  if (keyboard) { await button.focus(); await button.press('Enter'); }
  else await button.click();
  assert.equal(await button.getAttribute('aria-pressed'), 'true');
}
async function ancControls(branch) {
  const gain = branch.locator('.gain'), phase = branch.locator('.phase');
  const result = branch.locator('.result'), wave = branch.locator('.wave-result');
  await gain.focus(); await gain.press('Home');
  await phase.focus(); await phase.press('Home');
  assert.match(await result.innerText(), /1\.00/);
  await gain.press('End');
  assert.equal(await gain.inputValue(), '1.2');
  assert.match(await result.innerText(), /0\.20/);
  await gain.press('ArrowLeft'); await gain.press('ArrowLeft'); await gain.press('ArrowLeft'); await gain.press('ArrowLeft');
  assert.equal(await gain.inputValue(), '1');
  assert.match(await result.innerText(), /0\.00/);
  const cancelled = await wave.getAttribute('d');
  await phase.press('End');
  assert.equal(await phase.inputValue(), '180');
  assert.match(await result.innerText(), /2\.00/);
  assert.notEqual(await wave.getAttribute('d'), cancelled);
  await phase.press('Home');
  assert.equal(await wave.getAttribute('d'), cancelled);
}
async function mechanismControls(topic, branch, page) {
  if (topic === 'anc') return ancControls(branch);
  if (topic === 'greenland') {
    await branch.locator('.position').focus();
    await branch.locator('.position').press('End');
    assert((await page.evaluate(() => window.geographicState.areaError)) < 1e-10);
    assert.equal(await page.evaluate(() => window.geographicState.progress), 1);
  } else if (topic === 'cpython-string') {
    for (const [value, kind] of [['0', '1'], ['1', '2'], ['2', '4']]) {
      await branch.locator('.codepoint').selectOption(value);
      assert.equal(await branch.locator('.mechanism').getAttribute('data-kind'), kind);
    }
  } else {
    for (const stage of ['add', 'delete', 'same', 'base']) {
      await branch.locator('.scenario').selectOption(stage);
      assert.equal(await branch.locator('.mechanism').getAttribute('data-stage'), stage);
    }
  }
}
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.AHA_BROWSER_EXECUTABLE ? { executablePath: process.env.AHA_BROWSER_EXECUTABLE }
      : { channel: process.env.AHA_BROWSER_CHANNEL || 'msedge' }),
  });
  for (const topic of ['anc', 'greenland', 'cpython-string', 'docker-layers']) {
    const file = path.join(root, 'examples', topic, `${topic}.html`);
    const receipt = JSON.parse(await readFile(`${file}.receipt.json`, 'utf8'));
    assert.equal(sha(await readFile(file)), receipt.outputHash, `${topic}: packaged output hash`);
    for (const width of [1280, 390, 320]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({
        viewport: { width, height: 960 }, colorScheme: theme, reducedMotion: 'reduce',
        offline: true, serviceWorkers: 'block',
      });
      try {
        const page = await context.newPage();
        page.setDefaultTimeout(6000);
        const errors = [], blocked = [];
        const url = `${pathToFileURL(file).href}?scoutTheme=${theme}`;
        await context.route('**/*', route => {
          if (route.request().isNavigationRequest() && route.request().url() === url) return route.continue();
          blocked.push(route.request().url()); return route.abort('blockedbyclient');
        });
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        await page.goto(url);
        for (const language of ['en', 'zh']) {
          const record = {
            id: `${topic}-${width}-${theme}-${language}`, topic, width, theme, language,
            outputHash: receipt.outputHash, sourceHash: receipt.sourceHash, researchHash: receipt.researchHash,
            checks: [], screenshots: [],
          };
          report.cases.push(record);
          const branch = page.locator(`section[data-aha-lang="${language}"]`);
          await check(record, 'Language switch and title', async () => {
            const button = page.locator(`.aha-language-controls [data-language="${language}"]`);
            await activate(button, language === 'en');
            assert.equal(await page.locator('html').getAttribute('lang'), language === 'en' ? 'en' : 'zh-CN');
            assert.equal(await page.title(), await branch.getAttribute('data-aha-title'));
            assert(await branch.isVisible());
            assert.equal(await page.locator(`section[data-aha-lang="${language === 'en' ? 'zh' : 'en'}"]`).isVisible(), false);
          });
          await check(record, 'Keyboard and pointer controls', async () => {
            await mechanismControls(topic, branch, page);
          });
          await check(record, 'Viewport, theme and local anchors', async () => {
            assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
            for (const href of await branch.locator('a[href^="#"]').evaluateAll(links => links.map(link => link.getAttribute('href')))) {
              if (href.length > 1) assert(await page.evaluate(id => !!document.getElementById(id), decodeURIComponent(href.slice(1))), href);
            }
          });
          await check(record, 'No page errors or automatic external requests', async () => {
            assert.deepEqual(errors, []); assert.deepEqual(blocked, []);
          });
          if (screenshots) {
            const filename = `${record.id}.png`;
            await page.screenshot({ path: path.join(output, filename), fullPage: true });
            record.screenshots.push(filename);
          }
        }
      } finally { await context.close(); }
    }
  }
} catch (error) {
  report.failures.push({ case: 'runner', message: error.message });
} finally {
  await browser?.close();
  await writeFile(path.join(output, 'runtime.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
}
console.log(JSON.stringify({ cases: report.cases.length, failures: report.failures, output }));
if (report.failures.length) process.exitCode = 1;
