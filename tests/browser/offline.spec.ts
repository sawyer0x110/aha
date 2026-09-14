import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createDraft, createExample } from '../../src/core/examples.js';
import { runScenario, stateAt } from '../../src/core/engine.js';
import { validateExploration } from '../../src/core/exploration.js';
import { buildPack, sealPack } from '../../src/core/pack.js';
import type { Pack } from '../../src/core/schema.js';
import { renderHtml, serializeInertJson, type RenderAssets } from '../../src/renderers/html.js';
import { renderCardHtml, renderSceneHtml } from '../../src/renderers/card.js';
import { valueLabel } from '../../src/renderers/presentation.js';
import { readerConditions } from '../../src/renderers/learning.js';
import { createLongReaderDraft } from '../helpers/teaching.js';

const directory = path.resolve('tests', 'browser', 'artifacts');
let retryPack: Pack;
let compoundPack: Pack;
let evidencePack: Pack;
let assets: RenderAssets;

async function openFile(page: Page, name: string, theme = 'light'): Promise<void> {
  await page.context().setOffline(true);
  await page.goto(`${pathToFileURL(path.join(directory, name)).href}?scoutTheme=${theme}`);
}

test.beforeAll(async () => {
  const bundle = async (entry: string) => (await build({
    entryPoints: [entry], bundle: true, platform: 'browser', format: 'iife', write: false, target: 'es2022',
  })).outputFiles[0]!.text;
  const [labJs, slidesJs, revealJs, revealCss] = await Promise.all([
    bundle('src\\browser\\lab.ts'), bundle('src\\browser\\slides.ts'),
    readFile(path.resolve('node_modules', 'reveal.js', 'dist', 'reveal.js'), 'utf8'),
    readFile(path.resolve('node_modules', 'reveal.js', 'dist', 'reveal.css'), 'utf8'),
  ]);
  assets = { labJs, slidesJs, revealJs, revealCss };
  [retryPack, compoundPack, evidencePack] = await Promise.all([
    createExample('retry'), createExample('compound'), createExample('evidence'),
  ]);
  evidencePack.brief.explanation!.conditions = ['两个因素并不等于已经证明因果。'];
  evidencePack.brief.explanation!.answer = '还要比较其他条件。';
  evidencePack.brief.explanation!.visual = {
    layout: 'cards', title: '两种可能的解释',
    items: [{ label: '车辆增加', body: '等待时间变化' }, { label: '客流减少', body: '乘客数量不同' }],
    claimIds: [evidencePack.claims[0]!.id, evidencePack.claims[1]!.id],
  };
  evidencePack.narrative.slides[0]!.visual = structuredClone(evidencePack.brief.explanation!.visual);
  evidencePack = await sealPack(evidencePack);
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(path.join(directory, 'retry.html'), renderHtml(retryPack, 'lab', assets)),
    writeFile(path.join(directory, 'compound.html'), renderHtml(compoundPack, 'lab', assets)),
    writeFile(path.join(directory, 'evidence.html'), renderHtml(evidencePack, 'lab', assets)),
    writeFile(path.join(directory, 'slides.html'), renderHtml(compoundPack, 'slides', assets)),
    writeFile(path.join(directory, 'retry-slides.html'), renderHtml(retryPack, 'slides', assets)),
    writeFile(path.join(directory, 'evidence-slides.html'), renderHtml(evidencePack, 'slides', assets)),
    ...[retryPack, compoundPack, evidencePack].flatMap(pack => [
      writeFile(path.join(directory, `${pack.modelSpec.engine}.card.html`), renderCardHtml(pack)),
      ...pack.narrative.slides.map(slide => writeFile(
        path.join(directory, `${pack.modelSpec.engine}-${slide.id}.scene.html`),
        renderSceneHtml(pack, slide.id, slide.notes || slide.body),
      )),
    ]),
  ]);
});

test.afterAll(async () => { await rm(directory, { recursive: true, force: true }); });

test('source lessons remain readable when JavaScript is disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, offline: true });
  try {
    const page = await context.newPage();
    await page.goto(pathToFileURL(path.join(directory, 'evidence.html')).href);
    await expect(page.locator('#lesson-selector')).toBeDisabled();
    for (const [index, slide] of evidencePack.narrative.slides.entries()) {
      const lesson = page.locator(`[data-lesson-index="${index}"]`);
      await expect(lesson).toBeVisible();
      await expect(lesson).toContainText(slide.body);
    }
  } finally {
    await context.close();
  }
});

  test('synthetic long Chinese content has readable conceptual cards and bounded video scenes', async ({ page }) => {
    const name = 'synthetic-reader';
    const pack = await buildPack(createLongReaderDraft());
    const cardName = `${name}.card.html`;
    await writeFile(path.join(directory, cardName), renderCardHtml(pack));
    await page.setViewportSize({ width: 1080, height: 1600 });
    await openFile(page, cardName);
    await expect(page.locator('.teaching-visual')).toBeVisible();
    await expect(page.locator('#aha-card')).not.toContainText(pack.brief.audience);
    await expect(page.locator('#aha-card')).not.toContainText(pack.manifest.contentHash);
    const bounds = await page.locator('#aha-card').boundingBox();
    expect(bounds!.height).toBeLessThanOrEqual(2400);
    for (const item of pack.brief.explanation!.visual!.items) {
      await expect(page.locator('.teaching-visual')).toContainText(item.label);
    }
    await page.setViewportSize({ width: 1280, height: 720 });
    for (const slide of pack.narrative.slides) {
      const file = `${name}-${slide.id}.scene.html`;
      await writeFile(path.join(directory, file), renderSceneHtml(pack, slide.id, slide.notes || slide.body));
      await openFile(page, file);
      await expect(page.locator('.teaching-visual')).toBeVisible();
      await expect(page.locator('.scene-body')).toHaveText(slide.body);
      const clipped = await page.locator('#aha-scene').evaluate(element => {
        const box = element.getBoundingClientRect();
        return [...element.querySelectorAll('p, h1, h2, h3, li, footer')].some(child => {
          const range = document.createRange();
          range.selectNodeContents(child);
          const rect = range.getBoundingClientRect();
          const style = getComputedStyle(child);
          return rect.right > box.right + 1 || rect.bottom > box.bottom + 1
            || (style.overflowX === 'hidden' && child.scrollWidth > child.clientWidth + 1)
            || (style.overflowY === 'hidden' && child.scrollHeight > child.clientHeight + 1);
        });
      });
      expect(clipped, `${name}/${slide.id} clips reader content`).toBe(false);
      const visible = await page.locator('body').innerText();
      expect(visible).not.toMatch(/为谁讲解|原解释包|非因果模拟|所选材料|SHA-256|再交给 Story/);
    }
  });

for (const theme of ['light', 'dark']) {
  test(`file pages honor explicit ${theme} theme offline and expose accessible controls`, async ({ page }) => {
    const requests: string[] = [];
    const errors: string[] = [];
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    page.on('pageerror', error => errors.push(error.message));
    await page.emulateMedia({ colorScheme: theme === 'light' ? 'dark' : 'light', reducedMotion: 'reduce' });
    await openFile(page, 'retry.html', theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.getByRole('heading', { name: '案例 A', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '运行案例 A' })).toBeEnabled();
    await expect(page.locator('#a-maxRetries')).toHaveAccessibleName(/最大重试次数/);
    await page.locator('#a-next').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#a-selected-state')).toContainText('1 /');
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('retry independent recomputation, stale protection and identity-preserving export', async ({ page }) => {
  await openFile(page, 'retry.html');
  const bResult = await page.locator('#b-result').textContent();
  await page.locator('#a-baseDelayMs').fill('400');
  await expect(page.locator('#a-freshness')).toContainText('尚未运行');
  await expect(page.locator('#input-differences')).toContainText('初始等待');
  await page.locator('#export-exploration').click();
  await expect(page.locator('#export-error')).toContainText('未运行');
  await page.locator('#a-run').click();
  await expect(page.locator('#a-result [data-state-key="totalDelayMs"]')).toHaveText('1200');
  expect(await page.locator('#b-result').textContent()).toEqual(bResult);
  await page.locator('#a-note').fill('等待增加，但尝试次数不变。');
  await page.locator('#b-note').fill('对照案例保持不变。');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-exploration').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('retry-example.exploration.json');
  const target = path.join(directory, 'download.exploration.json');
  await download.saveAs(target);
  const exploration = await validateExploration(retryPack, JSON.parse(await readFile(target, 'utf8')));
  expect(exploration.packHash).toBe(retryPack.manifest.contentHash);
  expect(exploration.cases).toHaveLength(2);
  expect(exploration.cases.map(item => item.scenario.id)).toEqual(['explore-a', 'explore-b']);
  expect(exploration.cases[0]!.scenario.input).toMatchObject({ baseDelayMs: 400 });
  expect(exploration.cases[0]!.trace.result.totalDelayMs).toBe(1200);
  expect(exploration.cases[0]!.note).toBe('等待增加，但尝试次数不变。');
  expect(exploration.cases[1]!.note).toBe('对照案例保持不变。');
  await expect(page.locator('#export-status')).toContainText('已生成并发起下载');
});

test('timeline previous, next, reset and playback use exactly the stored states', async ({ page }) => {
  await openFile(page, 'retry.html');
  const trace = retryPack.traces[0]!;
  async function expectStep(step: number): Promise<void> {
    for (const [key, value] of Object.entries(stateAt(trace, step))) {
      await expect(page.locator(`#a-selected-state [data-state-key="${key}"]`).first()).toHaveText(valueLabel(value));
    }
    await expect(page.locator('#a-timeline [aria-current="step"]')).toHaveAttribute('data-step', String(step));
  }
  await expectStep(0);
  await page.locator('#a-next').click();
  await expectStep(1);
  await page.locator('#a-next').click();
  await expectStep(2);
  await page.locator('#a-prev').click();
  await expectStep(1);
  await page.locator('#a-reset').click();
  await expectStep(0);
  const before = await page.locator('#a-result').textContent();
  await page.locator('#a-interval').selectOption('500');
  await page.locator('#a-play').click();
  await expect(page.locator('#a-playback-status')).toContainText('播放中');
  await expect(page.locator('#a-selected-state')).not.toContainText('0 /');
  await page.locator('#a-pause').click();
  const paused = await page.locator('#a-selected-state').textContent();
  await page.waitForTimeout(650);
  expect(await page.locator('#a-selected-state').textContent()).toBe(paused);
  await page.locator('#a-resume').click();
  await expect(page.locator('#a-playback-status')).toContainText('播放中');
  await page.locator('#a-reset').click();
  await expectStep(0);
  expect(await page.locator('#a-result').textContent()).toBe(before);
});

test('invalid retry domains and missing outcomes are explicit, without stale result replacement', async ({ page }) => {
  await openFile(page, 'retry.html');
  const result = await page.locator('#a-result').textContent();
  await page.locator('#a-maxRetries').fill('21');
  await page.locator('#a-run').click();
  await expect(page.locator('#a-error')).toContainText('0 到 20');
  expect(await page.locator('#a-result').textContent()).toBe(result);
  await page.locator('#a-maxRetries').fill('2');
  await page.locator('#a-outcomes').fill('transient');
  await page.locator('#a-run').click();
  await expect(page.locator('#a-error')).toContainText('序列不完整');
  await page.locator('#a-outcomes').fill('transient,,success');
  await page.locator('#a-run').click();
  await expect(page.locator('#a-error')).toContainText('空项');
  await page.locator('#a-outcomes').fill('success');
  await page.locator('#a-retryableErrors').fill('transient,transient');
  await page.locator('#a-run').click();
  await expect(page.locator('#a-error')).toContainText('不能重复');
});

test('compound preserves exact results and rejects mismatched periods, excess precision and overdrafts', async ({ page }) => {
  await openFile(page, 'compound.html');
  await page.locator('#a-rates').fill('20,-10');
  await page.locator('#a-run').click();
  const scenario = structuredClone(compoundPack.scenarios[0]!);
  if (!('rates' in scenario.input)) throw new Error('错误的测试输入');
  scenario.input.rates = ['20', '-10'];
  const result = runScenario(compoundPack.modelSpec, scenario).result;
  await expect(page.locator('#a-result [data-state-key="balance"]')).toHaveText(String(result.balance));
  await expect(page.locator('#a-result [data-state-key="exactBalance"]')).toHaveText(String(result.exactBalance));
  await page.locator('#a-cashflows').fill('0');
  await page.locator('#a-run').click();
  await expect(page.locator('#a-error')).toContainText('期数完全相同');
  await page.locator('#a-cashflows').fill('0,0');
  await page.locator('#a-principal').fill('1.1234567');
  await page.locator('#a-run').click();
  await expect(page.locator('#a-error')).toContainText('小数最多 6 位');
  await page.locator('#a-principal').fill('100');
  await page.locator('#a-cashflows').fill('-1000,0');
  await page.locator('#a-run').click();
  await expect(page.locator('#a-error')).toContainText('透支');
});

test('evidence page has only source exploration, never fake simulation', async ({ page }) => {
  await openFile(page, 'evidence.html');
  await expect(page.locator('#overview .teaching-visual')).toBeVisible();
  await expect(page.locator('#evidence-selector')).not.toBeVisible();
  await page.locator('#lesson-selector').selectOption('1');
  await expect(page.locator('[data-lesson-index="1"]')).toBeVisible();
  await expect(page.locator('[data-lesson-index="0"]')).not.toBeVisible();
  await page.locator('.check-answer > summary').click();
  await expect(page.locator('.check-answer')).toContainText('还要比较其他条件');
  await page.locator('#reading-sources > summary').click();
  await expect(page.locator('#evidence-cards .evidence-card:visible')).toHaveCount(2);
  await page.locator('#evidence-selector').selectOption('source-b');
  await expect(page.locator('#evidence-cards .evidence-card:visible')).toHaveCount(1);
  await expect(page.locator('#evidence-claims')).toContainText('尚未解决');
  await expect(page.locator('#evidence-claims')).not.toContainText('材料 A 报告候车时间缩短');
  await expect(page.locator('input[type=number]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /运行|播放|暂停|继续/ })).toHaveCount(0);
  await page.locator('#evidence-note').fill('这是我的观察，不是事实。');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#evidence-export').click();
  const download = await downloadPromise;
  const target = path.join(directory, 'evidence.exploration.json');
  await download.saveAs(target);
  const exploration = await validateExploration(evidencePack, JSON.parse(await readFile(target, 'utf8')));
  expect(exploration.cases[0]?.scenario.input).toEqual({ evidenceIds: ['source-b'] });
  expect(exploration.cases[0]?.trace.events).toEqual([]);
  expect(exploration.cases[0]?.trace.mode).toBe('source-based');
  expect(exploration.cases[0]?.note).toBe('这是我的观察，不是事实。');
});

test('source IDs cannot collide with the all-materials selector', async ({ page }) => {
  const draft = createDraft('evidence');
  draft.evidence[0]!.id = 'all';
  const remap = (id: string): string => id === 'source-a' ? 'all' : id;
  draft.modelSpec.evidenceIds = draft.modelSpec.evidenceIds.map(remap);
  draft.claims.forEach(claim => { claim.evidenceIds = claim.evidenceIds.map(remap); });
  draft.scenarios.forEach(scenario => {
    if ('evidenceIds' in scenario.input) scenario.input.evidenceIds = scenario.input.evidenceIds.map(remap);
  });
  const pack = await buildPack(draft);
  await writeFile(path.join(directory, 'all-id.html'), renderHtml(pack, 'lab', assets));
  await openFile(page, 'all-id.html');
  await page.locator('#reading-sources > summary').click();
  await page.locator('#evidence-selector').selectOption('all');
  await expect(page.locator('#evidence-cards .evidence-card:visible')).toHaveCount(1);
  await expect(page.locator('#reading-all')).toBeVisible();
  await page.locator('#evidence-selector').selectOption('');
  await expect(page.locator('#evidence-cards .evidence-card:visible')).toHaveCount(2);
});

test('changed embedded Pack data cannot enable interactive computation', async ({ page }) => {
  const tampered = structuredClone(retryPack);
  tampered.brief.question = 'Changed without rebuilding the snapshot';
  const html = renderHtml(retryPack, 'lab', assets)
    .replace(serializeInertJson(retryPack), serializeInertJson(tampered));
  await writeFile(path.join(directory, 'tampered.html'), html);
  await openFile(page, 'tampered.html');
  await expect(page.locator('main > [role=alert]')).toContainText('初始化失败');
  await expect(page.locator('#a-run')).toBeDisabled();
  await expect(page.locator('#export-exploration')).toBeDisabled();
});

test('slides navigate offline with notes hidden until explicitly toggled and preserve values', async ({ page }) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await openFile(page, 'slides.html');
  await expect(page.locator('#slide-next')).toBeEnabled();
  await expect(page.locator('#slide-position')).toHaveText('第 1 / 6 页');
  await expect(page.locator('.slide-notes:visible')).toHaveCount(0);
  await page.locator('#slide-notes-toggle').click();
  await expect(page.locator('#slide-notes-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#notes-question')).toBeVisible();
  await page.locator('#slide-notes-toggle').click();
  await page.locator('#slide-next').click();
  await page.locator('#slide-next').click();
  await expect(page.locator('#slide-position')).toHaveText('第 3 / 6 页');
  const trace = compoundPack.traces[0]!;
  await expect(page.locator('section.present [data-state-key="balance"]').first()).toHaveText(String(trace.result.balance));
  await page.locator('section.present .slide-sources > summary').click();
  await expect(page.locator('section.present .slide-sources')).toContainText('内置教学模型规则');
  await expect(page.locator('.slide-notes:visible')).toHaveCount(0);
  await page.locator('#slide-prev').click();
  await expect(page.locator('#slide-position')).toHaveText('第 2 / 6 页');
  await page.locator('#slide-next').blur();
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#slide-position')).toHaveText('第 3 / 6 页');
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

for (const file of ['slides.html', 'retry-slides.html', 'evidence-slides.html']) {
  test(`${file} shows every default slide without internal scrolling`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFile(page, file);
    await expect(page.locator('#slide-next')).toBeEnabled();
    const count = await page.locator('.slides > section').count();
    for (let index = 0; index < count; index++) {
      await expect(page.locator('#slide-position')).toHaveText(`第 ${index + 1} / ${count} 页`);
      const size = await page.locator('section.present').evaluate(element => ({
        height: element.clientHeight, scrollHeight: element.scrollHeight,
        width: element.clientWidth, scrollWidth: element.scrollWidth,
      }));
      expect(size.scrollHeight, `slide ${index + 1} vertical overflow`).toBeLessThanOrEqual(size.height + 1);
      expect(size.scrollWidth, `slide ${index + 1} horizontal overflow`).toBeLessThanOrEqual(size.width + 1);
      if (index < count - 1) await page.locator('#slide-next').click();
    }
  });
}

test('malicious inline source text remains inert in the actual file browser', async ({ page }) => {
  const draft = structuredClone(evidencePack);
  const hostile = '</script><script>window.ahaInjected=true</script><img src=x onerror="window.ahaInjected=true">';
  draft.evidence[0]!.summary = hostile;
  draft.evidence[0]!.locator = hostile;
  draft.evidence[0]!.title = '<svg onload="window.ahaInjected=true">材料</svg>';
  const pack = await sealPack(draft);
  await writeFile(path.join(directory, 'hostile.html'), renderHtml(pack, 'lab', assets));
  await openFile(page, 'hostile.html');
  await page.locator('#reading-sources > summary').click();
  await expect(page.locator('#reading-source-a')).toContainText(hostile);
  expect(await page.evaluate(() => 'ahaInjected' in window)).toBe(false);
  await expect(page.locator('#reading-source-a img, #reading-source-a svg')).toHaveCount(0);
  await expect(page.locator('#evidence-selector')).toBeEnabled();
});

test('the first viewport shows the takeaway and committed A/B results, including honest stale state', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await openFile(page, 'compound.html');
  await expect(page.locator('#a-run')).toBeEnabled();
  await expect(page.locator('#overview [data-takeaway]')).toHaveText(compoundPack.brief.explanation!.takeaway);
  for (const id of ['a', 'b']) {
    const bounds = await page.locator(`#${id}-summary`).boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThan(1000);
  }
  const summary = await page.locator('#a-summary').textContent();
  await page.locator('#a-rates').fill('20,-10');
  await expect(page.locator('#a-summary-freshness')).toContainText('尚未运行修改');
  expect(await page.locator('#a-summary').textContent()).toBe(summary);
  await page.locator('#a-run').click();
  await expect(page.locator('#a-summary [data-summary-key=balance]')).toHaveText('11700.00');
  await expect(page.locator('#a-summary-freshness')).not.toContainText('尚未运行');
  await page.locator('#a-next').click();
  await expect(page.locator('#a-summary [data-summary-key=balance]')).toHaveText('11700.00');
  await expect(page.locator('#overview [data-takeaway]')).toHaveText(compoundPack.brief.explanation!.takeaway);
});

test('section navigation is keyboard reachable, reveals source details and works on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openFile(page, 'retry.html');
  await expect(page.locator('#a-run')).toBeEnabled();
  await page.locator('.section-nav a[href="#explain"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#explain')).toBeFocused();
  await expect(page.locator('#explain')).toContainText(retryPack.brief.explanation!.analogy!.limitations);
  await page.locator('.section-nav a[href="#pack-context"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#pack-context')).toHaveAttribute('open', '');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('slide outline can be operated without a pointer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openFile(page, 'slides.html');
  await expect(page.locator('#slide-jump')).toBeEnabled();
  await page.locator('#slide-jump').focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('#slide-position')).toHaveText('第 2 / 6 页');
  await page.locator('#slide-jump').selectOption('5');
  await expect(page.locator('#slide-position')).toHaveText('第 6 / 6 页');
});

for (const engine of ['retry', 'compound', 'evidence'] as const) {
  test(`${engine} image card has a bounded natural layout and visible offline provenance`, async ({ page }) => {
    const requests: string[] = [];
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    await page.setViewportSize({ width: 1080, height: 2400 });
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
    await openFile(page, `${engine}.card.html`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const pack = engine === 'retry' ? retryPack : engine === 'compound' ? compoundPack : evidencePack;
    const card = page.locator('#aha-card');
    const size = await card.evaluate(element => ({
      width: element.clientWidth, height: element.clientHeight,
      scrollWidth: element.scrollWidth, scrollHeight: element.scrollHeight,
      footerBottom: element.querySelector('footer')!.getBoundingClientRect().bottom,
      bottom: element.getBoundingClientRect().bottom,
    }));
    expect(size.width).toBe(1080);
    expect(size.height).toBeLessThanOrEqual(2400);
    expect(size.scrollHeight).toBeLessThanOrEqual(size.height + 1);
    expect(size.scrollWidth).toBeLessThanOrEqual(size.width + 1);
    expect(size.footerBottom).toBeLessThanOrEqual(size.bottom);
    await expect(card).not.toContainText(pack.manifest.contentHash);
    await expect(card).not.toContainText(pack.brief.audience);
    for (const condition of readerConditions(pack)) await expect(card.locator('.reader-conditions')).toContainText(condition);
    for (const source of pack.evidence) await expect(card.locator('footer')).toContainText(source.title);
    if (engine === 'evidence') {
      await expect(card.locator('.teaching-visual')).toBeVisible();
      await expect(card.locator('[data-summary-key=selectedEvidence]')).toHaveCount(0);
    }
    expect(requests).toEqual([]);
  });

  test(`${engine} fixed video scenes fit 1280 by 720 for every narrative reference`, async ({ page }) => {
    const requests: string[] = [];
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const pack = engine === 'retry' ? retryPack : engine === 'compound' ? compoundPack : evidencePack;
    for (const slide of pack.narrative.slides) {
      await openFile(page, `${engine}-${slide.id}.scene.html`);
      const scene = page.locator('#aha-scene');
      const size = await scene.evaluate(element => ({
        width: element.clientWidth, height: element.clientHeight,
        scrollWidth: element.scrollWidth, scrollHeight: element.scrollHeight,
        contentBottom: Math.max(...[...element.querySelector('.scene-content')!.children].map(child => child.getBoundingClientRect().bottom)),
        captionTop: element.querySelector('.scene-caption')!.getBoundingClientRect().top,
      }));
      expect(size.width).toBe(1280);
      expect(size.height).toBe(720);
      expect(size.scrollWidth, slide.id).toBeLessThanOrEqual(1280);
      expect(size.scrollHeight, slide.id).toBeLessThanOrEqual(720);
      expect(size.contentBottom, `${slide.id} content overlaps caption`).toBeLessThanOrEqual(size.captionTop);
      await expect(scene).not.toContainText(pack.manifest.contentHash);
      await expect(scene).not.toContainText(pack.brief.audience);
      await expect(scene.locator('.scene-caption')).toHaveText(slide.notes || slide.body);
      if (slide.scenarioId && engine !== 'evidence') {
        const trace = pack.traces.find(item => item.scenarioId === slide.scenarioId)!;
        const key = engine === 'compound' ? 'balance' : 'attempt';
        await expect(scene.locator(`[data-summary-key="${key}"]`)).toHaveText(String(stateAt(trace, slide.eventStep ?? trace.events.length)[key]));
      }
    }
    expect(requests).toEqual([]);
  });
}

test('video scenes preserve authored line breaks without changing their text', async ({ page }) => {
  const pack = structuredClone(evidencePack);
  const slide = pack.narrative.slides[0]!;
  slide.body = '研究：核对来源。\n探索：比较结果。\n讲解：保留依据。';
  await writeFile(path.join(directory, 'multiline.scene.html'), renderSceneHtml(pack, slide.id, '先看依据，再看表达。'));
  await page.setViewportSize({ width: 1280, height: 720 });
  await openFile(page, 'multiline.scene.html');
  const body = page.locator('.scene-content > .scene-body');
  expect(await body.textContent()).toBe(slide.body);
  await expect(body).toHaveCSS('white-space', 'pre-line');
  const lineCount = await body.evaluate(element => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size;
  });
  expect(lineCount).toBe(3);
});

test('card and scene text cannot execute markup in file browsers', async ({ page }) => {
  const pack = structuredClone(compoundPack);
  const hostile = '</script><svg onload="window.ahaInjected=true"></svg>';
  pack.brief.explanation!.takeaway = hostile;
  pack.brief.explanation!.analogy!.limitations = hostile;
  pack.brief.explanation!.glossary[0]!.meaning = hostile;
  pack.narrative.slides[0]!.body = hostile;
  pack.evidence[0]!.title = hostile;
  await writeFile(path.join(directory, 'hostile.card.html'), renderCardHtml(pack));
  await writeFile(path.join(directory, 'hostile.scene.html'), renderSceneHtml(pack, 'question', hostile));
  for (const file of ['hostile.card.html', 'hostile.scene.html']) {
    await openFile(page, file);
    await expect(page.locator('body')).toContainText(hostile);
    expect(await page.evaluate(() => 'ahaInjected' in window)).toBe(false);
    await expect(page.locator('svg[onload]')).toHaveCount(0);
  }
});
