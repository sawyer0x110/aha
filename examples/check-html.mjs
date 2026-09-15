import { chromium } from 'playwright-core';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

if (!process.argv.includes('--allow-code')) throw new Error('Review the source and obtain local browser execution approval, then pass --allow-code.');
const base = dirname(fileURLToPath(import.meta.url));
const output = join(base, 'evaluation');
await mkdir(output, { recursive: true });
const screenshots = process.argv.includes('--screenshots');
if (screenshots) await mkdir(join(output, 'screenshots'), { recursive: true });
const fixtures = JSON.parse(await readFile(join(base, 'git-merge', 'experiment-results-v2.json'), 'utf8')).results;
const normalize = value => value.replace(/\r/g, '').trimEnd();
const report = {
  createdAt: new Date().toISOString(), cases: [], failures: [],
  boundary: 'Observed offline behavior and sampled layout only. Editorial review is separate; no human comprehension or screen-reader acceptance.',
};
async function check(record, name, action) {
  try { await action(); record.checks.push({ name, passed: true }); }
  catch (error) {
    const failure = { case: record.id, name, message: error.message };
    record.checks.push({ name, passed: false, message: error.message });
    report.failures.push(failure);
  }
}
async function capture(locator, name, record) {
  if (!screenshots) return;
  await locator.screenshot({ path: join(output, 'screenshots', `${name}.png`) });
  record.screenshots.push(`screenshots/${name}.png`);
}
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const topic of ['anc', 'git-merge']) {
    const file = join(base, topic, 'index.html');
    const receipt = JSON.parse(await readFile(`${file}.receipt.json`, 'utf8'));
    assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'), receipt.outputHash);
    for (const width of [1280, 390]) {
      for (const theme of ['light', 'dark']) {
        const context = await browser.newContext({ viewport: { width, height: 960 }, colorScheme: theme, reducedMotion: 'reduce', offline: true, serviceWorkers: 'block' });
        const page = await context.newPage();
        page.setDefaultTimeout(6000);
        const errors = [], blocked = [];
        const url = pathToFileURL(file).href + `?scoutTheme=${theme}`;
        await context.route('**/*', route => {
          if (route.request().isNavigationRequest() && route.request().url() === url) return route.continue();
          blocked.push(route.request().url());
          return route.abort('blockedbyclient');
        });
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        await page.goto(url);
        assert.equal(await page.locator('html').getAttribute('lang'), 'en');
        for (const language of ['en', 'zh']) {
          const record = { id: `${topic}-${width}-${theme}-${language}`, outputHash: receipt.outputHash, sourceHash: receipt.sourceHash, checks: [], screenshots: [] };
          report.cases.push(record);
          const root = page.locator(`section[data-aha-lang="${language}"]`);
          const switcher = page.locator(`.aha-language-controls [data-language="${language}"]`);
          await switcher.focus();
          await switcher.press(language === 'zh' ? 'Enter' : 'Space');
          await check(record, 'Localized title, branch visibility and active control', async () => {
            assert.equal(await page.locator('html').getAttribute('lang'), language === 'zh' ? 'zh-CN' : 'en');
            assert.equal(await page.title(), await root.getAttribute('data-aha-title'));
            assert(await root.isVisible());
            assert.equal(await page.locator(`[data-aha-lang="${language === 'en' ? 'zh' : 'en'}"]`).isVisible(), false);
            assert.equal(await switcher.getAttribute('aria-pressed'), 'true');
          });
          await check(record, 'Document fits viewport and intended theme', async () => {
            assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
            const size = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
            assert(size.content <= size.viewport + 1, JSON.stringify(size));
          });
          if (topic === 'git-merge') {
            await check(record, 'Git headline names the question before the lead introduces values', async () => {
              const title = await root.locator('h1').textContent();
              assert.equal(title, await root.getAttribute('data-aha-title'));
              assert.match(title, language === 'en' ? /Git merge.*change.*reverted/ : /Git 合并.*撤销.*修改/);
              assert.doesNotMatch(title, /\d/);
              const lead = await root.locator('.lede').innerText();
              assert.match(lead, language === 'en' ? /configuration file/ : /配置文件/);
              assert(lead.indexOf('timeout') >= 0 && lead.indexOf('timeout') < lead.indexOf('30'));
              assert(lead.includes('60'));
            });
          }
          if (topic === 'git-merge' && width === 390 && language === 'zh') {
            await check(record, 'Chinese mobile heading stays within two lines', async () => {
              const heading = await root.locator('h1').evaluate(el => ({
                height: el.getBoundingClientRect().height,
                lineHeight: Number.parseFloat(getComputedStyle(el).lineHeight),
              }));
              assert(heading.height <= heading.lineHeight * 2 + 1, JSON.stringify(heading));
            });
          }
          if (theme === 'light' && ((width === 1280 && language === 'en') || (width === 390 && language === 'zh'))) {
            await capture(root.locator('header'), `${record.id}-opening`, record);
          }
          if (topic === 'anc') {
            await check(record, 'Phase model at keyboard limits, 60 degrees and reset', async () => {
              const slider = root.locator('input[data-phase]');
              await slider.focus(); await slider.press('Home');
              assert.equal(await root.locator('[data-residual]').innerText(), '0.00');
              const initialPath = await root.locator('[data-pressure="sum"]').getAttribute('d');
              await slider.evaluate(el => { el.value = '60'; el.dispatchEvent(new Event('input', { bubbles: true })); });
              assert.equal(await root.locator('[data-residual]').innerText(), '1.00');
              assert((await slider.getAttribute('aria-valuetext')).includes('60'));
              const middlePath = await root.locator('[data-pressure="sum"]').getAttribute('d');
              assert.notEqual(middlePath, initialPath);
              await slider.press('ArrowRight');
              assert.equal(await slider.inputValue(), '61');
              assert((await root.locator('[data-feedback]').innerText()).includes('61'));
              await slider.press('End');
              assert.equal(await root.locator('[data-residual]').innerText(), '2.00');
              await root.locator('[data-reset]').click();
              assert.equal(await slider.inputValue(), '0');
              assert.equal(await root.locator('[data-pressure="sum"]').getAttribute('d'), initialPath);
            });
            if (theme === 'light' && width === 1280 && language === 'zh') {
              await capture(root.locator('.figure').first(), `${record.id}-mechanism`, record);
              await root.locator('input[data-phase]').evaluate(el => { el.value = '60'; el.dispatchEvent(new Event('input', { bubbles: true })); });
              await capture(root.locator('[data-model]'), `${record.id}-model`, record);
              await root.locator('[data-reset]').click();
            }
          } else {
            await check(record, 'All three recorded cases match every displayed file and commit state', async () => {
              for (const [key, index] of [['one', 0], ['apart', 1], ['clash', 2]]) {
                const button = root.locator(`button[data-case="${key}"]`);
                await button.focus(); await button.press('Enter');
                const fixture = fixtures[index];
                for (const part of ['base', 'ours', 'theirs', 'result']) {
                  assert.equal(normalize(await root.locator(`[data-code="${part}"]`).textContent()), normalize(fixture[`${part}Text`]), `${key}/${part}`);
                }
                assert.equal(await button.getAttribute('aria-pressed'), 'true');
                assert.equal(await button.evaluate(el => el === document.activeElement), true);
                assert.equal(await root.locator('[data-result-state]').getAttribute('data-state'), index === 2 ? 'conflict' : 'resolved');
                assert.equal(await root.locator('[data-index-stages]').isVisible(), index === 2);
                assert.equal(await root.locator('[data-merge-node]').isVisible(), index !== 2);
                assert.equal(normalize(await root.locator('[data-stage-values]').textContent()), fixture.unmergedStages.join('\n'));
                assert((await root.locator('[data-head-state]').innerText()).includes(fixture.headAfter.slice(0, 7)));
              }
            });
            await check(record, 'Methods disclosure opens with keyboard', async () => {
              const details = root.locator('details');
              await details.locator('summary').focus(); await details.locator('summary').press('Enter');
              assert(await details.evaluate(el => el.open));
              await details.locator('summary').press('Enter');
            });
            if (theme === 'light' && width === 1280 && language === 'zh') {
              await capture(root.locator('.comparison'), `${record.id}-conflict`, record);
            }
          }
          await check(record, 'Visible SVG text stays inside diagram viewboxes', async () => {
            const clipped = await root.locator('svg').evaluateAll(elements => elements.flatMap(svg => {
              const box = svg.viewBox.baseVal;
              return [...svg.querySelectorAll('text')].filter(t => t.getBoundingClientRect().width > 0).flatMap(t => {
                const b = t.getBBox();
                return b.x < box.x - 1 || b.y < box.y - 1 || b.x + b.width > box.x + box.width + 1 || b.y + b.height > box.y + box.height + 1
                  ? [t.textContent] : [];
              });
            }));
            assert.deepEqual(clipped, []);
          });
          await check(record, 'No page errors or automatic external requests', async () => {
            assert.deepEqual(errors, []); assert.deepEqual(blocked, []);
          });
        }
        await context.close();
      }
    }
  }
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 960 }, offline: true, serviceWorkers: 'block' });
    const page = await context.newPage();
    const record = { id: `gallery-${width}`, checks: [], screenshots: [] };
    report.cases.push(record);
    const url = pathToFileURL(join(base, 'index.html')).href;
    const errors = [], blocked = [];
    page.on('pageerror', e => errors.push(e.message));
    await context.route('**/*', route => {
      if (route.request().url() === url) return route.continue();
      blocked.push(route.request().url()); return route.abort();
    });
    await page.goto(url);
    await check(record, 'Gallery fits and links to both current HTML files', async () => {
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      for (const relative of ['anc/index.html', 'git-merge/index.html', 'README.md']) {
        assert.equal(await page.locator(`a[href="${relative}"]`).count(), 1);
        await readFile(join(base, ...relative.split('/')));
      }
      assert.deepEqual(errors, []); assert.deepEqual(blocked, []);
    });
    await context.close();
  }
} finally { await browser.close(); }
await writeFile(join(output, 'runtime.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ cases: report.cases.length, checks: report.cases.reduce((sum, item) => sum + item.checks.length, 0), failures: report.failures }));
if (report.failures.length) process.exitCode = 1;
