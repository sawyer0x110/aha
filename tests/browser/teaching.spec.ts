import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPack, sealPack } from '../../src/core/pack.js';
import { createExample } from '../../src/core/examples.js';
import type { Pack } from '../../src/core/schema.js';
import { renderHtml, type RenderAssets } from '../../src/renderers/html.js';
import { renderCardHtml } from '../../src/renderers/card.js';
import { createTeachingDraft } from '../helpers/teaching.js';

const directory = path.resolve('tests', 'browser', 'teaching-artifacts');
let pack: Pack;
let assets: RenderAssets;
const file = (name: string) => `${pathToFileURL(path.join(directory, name)).href}?scoutTheme=light`;
const currentTurn = (index: number) => `[data-teaching-turn="${index}"]`;

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
  pack = await buildPack(createTeachingDraft());
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(path.join(directory, 'lab.html'), renderHtml(pack, 'lab', assets)),
    writeFile(path.join(directory, 'slides.html'), renderHtml(pack, 'slides', assets)),
    writeFile(path.join(directory, 'card.html'), renderCardHtml(pack)),
    createExample('retry').then(legacy => writeFile(path.join(directory, 'legacy.html'), renderHtml(legacy, 'lab', assets))),
  ]);
});

test.afterAll(async () => { await rm(directory, { recursive: true, force: true }); });

test('synthetic replay asks before revealing; wrong/right feedback, frozen state, transfer and restart work', async ({ page }) => {
  await page.context().setOffline(true);
  await page.goto(file('lab.html'));
  const teaching = pack.teaching!;
  const root = page.locator('[data-teaching="lab"]');
  await expect(root).toHaveClass(/teaching-ready/);
  for (const [index, transition] of teaching.transitions.entries()) {
    const turn = page.locator(currentTurn(index));
    const check = teaching.checks.find(item => item.id === transition.predictionId)!;
    await expect(turn).toBeVisible();
    await expect(turn.locator('[data-teaching-before]')).toBeVisible();
    await expect(turn.locator('[data-teaching-result]')).toBeHidden();
    await expect(turn.locator('[data-teaching-answer]')).toBeHidden();
    await expect(turn.locator('[data-teaching-reveal]')).toBeDisabled();
    const wrong = check.choices.find(item => item.id !== check.correctChoiceId)!;
    const right = check.choices.find(item => item.id === check.correctChoiceId)!;
    await turn.locator(`[data-choice-id="${wrong.id}"]`).click();
    await expect(turn.locator('[data-teaching-feedback]')).toHaveText(`再想一步。${wrong.feedback}`);
    await expect(turn.locator('[data-teaching-result]')).toBeHidden();
    await turn.locator(`[data-choice-id="${right.id}"]`).focus();
    await page.keyboard.press('Enter');
    await expect(turn.locator('[data-teaching-feedback]')).toHaveText(`判断正确。${right.feedback}`);
    await turn.locator('[data-teaching-reveal]').click();
    await expect(turn.locator('[data-teaching-result]')).toBeVisible();
    await expect(turn.locator('[data-teaching-before]')).toBeHidden();
    const result = turn.locator('[data-teaching-result]');
    await expect(result.locator(`[data-entity-id="${transition.targetEntityId}"]`)).toHaveAttribute('data-changed', 'true');
    const after = teaching.states.find(state => state.id === transition.to)!;
    for (const value of after.values) {
      const entity = result.locator(`[data-entity-id="${value.entityId}"]`);
      const lines = value.content.split('\n');
      if (lines.at(-1) === '') lines.pop();
      expect(await entity.locator('.teaching-line').allTextContents()).toEqual(lines);
      if (value.content !== '') expect(await entity.locator('.teaching-code code').textContent()).toBe(value.content);
    }
    if (teaching.outcome?.fromStateId === after.id) {
      const outcome = result.locator('[data-teaching-outcome]');
      await expect(outcome).toBeVisible();
      await expect(outcome).toContainText('如果此刻执行');
      await expect(outcome).not.toContainText('不是新执行记录');
    }
    for (const entity of teaching.entities.filter(item => item.id !== transition.targetEntityId)) {
      await expect(result.locator(`[data-entity-id="${entity.id}"]`)).toHaveAttribute('data-changed', 'false');
      await expect(result.locator(`[data-entity-id="${entity.id}"]`)).toContainText('保持原样');
      await expect(result.locator(`[data-entity-id="${entity.id}"] [data-changed-line]`)).toHaveCount(0);
    }
    await turn.locator('[data-teaching-next]').click();
  }
  const transfer = page.locator('[data-teaching-transfer]');
  await expect(transfer).toBeVisible();
  for (const check of teaching.checks.filter(item => item.kind === 'transfer')) {
    const field = transfer.locator(`[data-check-id="${check.id}"]`);
    const wrong = check.choices.find(item => item.id !== check.correctChoiceId)!;
    await field.locator(`[data-choice-id="${wrong.id}"]`).click();
    await expect(field.locator('[data-teaching-feedback]')).toContainText(wrong.feedback);
    await expect(page.locator('[data-teaching-conclusion]')).toBeHidden();
    await field.locator(`[data-choice-id="${check.correctChoiceId}"]`).focus();
    await page.keyboard.press('Space');
    await expect(field.locator('[data-teaching-feedback]')).toContainText(check.choices.find(item => item.id === check.correctChoiceId)!.feedback);
  }
  await expect(page.locator('[data-teaching-conclusion]')).toBeVisible();
  await page.locator('[data-teaching-restart]').click();
  await expect(page.locator(currentTurn(0))).toBeVisible();
  await expect(page.locator(`${currentTurn(0)} [data-teaching-reveal]`)).toBeDisabled();
  await expect(page.locator('[data-teaching-feedback]').filter({ hasText: /./ })).toHaveCount(0);
  await expect(page.locator('[data-choice-id][aria-pressed="true"]')).toHaveCount(0);
  await expect(transfer).toBeHidden();
});

test('source selection and note export remain secondary and functional', async ({ page }) => {
  await page.goto(file('lab.html'));
  await expect(page.locator('#lesson-selector')).toHaveCount(0);
  await page.locator('#reading-sources > summary').click();
  await page.locator('#evidence-selector').selectOption(pack.evidence[0]!.id);
  await expect(page.locator('#evidence-cards [data-evidence-id]:visible')).toHaveCount(1);
  await page.locator('#evidence-note').fill('我的预测与核对记录。');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#evidence-export').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.exploration\.json$/);
  const downloadedPath = path.join(directory, 'source-note.exploration.json');
  await download.saveAs(downloadedPath);
  const exported = JSON.parse(await readFile(downloadedPath, 'utf8'));
  expect(exported.cases[0].note).toBe('我的预测与核对记录。');
  await expect(page.locator('#export-error')).toBeEmpty();
});

test('no JavaScript retains every state, prediction, answer and truthful basis', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setScriptExecutionDisabled', { value: true });
    await page.context().setOffline(true);
    await page.goto(file('lab.html'));
    for (const [index, transition] of pack.teaching!.transitions.entries()) {
      const turn = page.locator(currentTurn(index));
      await expect(turn).toBeVisible();
      await expect(turn.locator('[data-teaching-result]')).toBeVisible();
      await turn.locator('[data-teaching-answer] > summary').click();
      await expect(turn.locator('[data-teaching-answer]')).toContainText(pack.teaching!.checks.find(check => check.id === transition.predictionId)!.choices[0]!.feedback);
    }
    await expect(page.locator('[data-teaching-transfer]')).toBeVisible();
    await expect(page.locator('#reading-sources .teaching-basis:not(.teaching-scope)')).toContainText(pack.teaching!.basis.note);
    await expect(page.locator('.teaching-intro .teaching-safety')).toContainText('不执行命令');
    await page.goto(file('slides.html'));
    await expect(page.locator('[data-slide-index]:visible')).toHaveCount(pack.narrative.slides.length);
});

for (const width of [1280, 390]) {
  test(`Lab and Story maintain readable stable layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 });
    await page.goto(file('lab.html'));
    await expect(page.locator('[data-teaching="lab"]')).toHaveClass(/teaching-ready/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const boxes = await page.locator(`${currentTurn(0)} [data-teaching-before] .entity`).evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, top: rect.top, width: rect.width };
    }));
    expect(boxes[0]!.top).toEqual(boxes[1]!.top);
    expect(boxes[0]!.width).toBeGreaterThan(width === 390 ? 140 : 300);
    await page.goto(file('slides.html'));
    await expect(page.locator('body')).not.toHaveClass(/no-js-deck/);
    for (let index = 0; index < pack.narrative.slides.length; index++) {
      await page.locator('#slide-jump').selectOption(String(index));
      const section = page.locator(`[data-slide-index="${index}"]`);
      await expect(section).toBeVisible();
      expect(await section.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(2);
      if (width === 1280) expect(await section.evaluate(node => node.scrollHeight - node.clientHeight)).toBeLessThanOrEqual(2);
      for (const code of await section.locator('.teaching-code').all()) {
        expect(await code.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(2);
        expect(await code.evaluate(node => node.scrollHeight - node.clientHeight)).toBeLessThanOrEqual(2);
        expect(pack.teaching!.states.flatMap(state => state.values.map(value => value.content)))
          .toContain(await code.locator('code').textContent());
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  });
}

test('Story transfer choice has independent reasoned feedback and deterministic navigation', async ({ page }) => {
  await page.goto(file('slides.html'));
  const index = pack.narrative.slides.findIndex(slide => slide.scene?.kind === 'transfer');
  await page.locator('#slide-jump').selectOption(String(index));
  const check = pack.teaching!.checks.find(item => item.id === pack.narrative.slides[index]!.scene!.checkId)!;
  const field = page.locator(`[data-slide-index="${index}"] [data-check-id="${check.id}"]`);
  for (const choice of check.choices) await expect(field.locator(`[data-choice-id="${choice.id}"]`)).toHaveText(choice.text);
  await expect(field.locator('[data-teaching-answer]')).toBeHidden();
  const wrong = check.choices.find(item => item.id !== check.correctChoiceId)!;
  await field.locator(`[data-choice-id="${wrong.id}"]`).click();
  await expect(field.locator('[data-teaching-feedback]')).toContainText(wrong.feedback);
  await field.locator(`[data-choice-id="${check.correctChoiceId}"]`).focus();
  await page.keyboard.press('Space');
  await expect(field.locator('[data-teaching-feedback]')).toHaveAttribute('data-correct', 'true');
  const colors = await field.locator('[data-teaching-feedback]').evaluate(node => ({
    body: getComputedStyle(document.body).color,
    reason: getComputedStyle(node).color,
    cue: getComputedStyle(node, '::before').color,
  }));
  expect(colors.reason).toBe(colors.body);
  expect(colors.cue).not.toBe(colors.body);
  await expect(page.locator('#slide-position')).toHaveText(`第 ${index + 1} / ${pack.narrative.slides.length} 页`);
});

test('teaching card shows exact authored content in bounded capture dimensions', async ({ page }) => {
  await page.setViewportSize({ width: 1080, height: 1600 });
  await page.goto(file('card.html'));
  const card = page.locator('#aha-card');
  const bounds = await card.boundingBox();
  expect(bounds!.width).toBe(1080);
  expect(bounds!.height).toBeGreaterThanOrEqual(1100);
  expect(bounds!.height).toBeLessThanOrEqual(1500);
  await expect(card.locator('[data-changed-line]').first()).toBeVisible();
  await expect(card).toContainText('保持原样');
  await expect(card).not.toContainText(pack.brief.audience);
  for (const check of pack.teaching!.checks) await expect(card).not.toContainText(check.question);
});

test('hostile teaching content never becomes executable markup', async ({ page }) => {
  const hostile = structuredClone(pack);
  hostile.teaching!.title = '<img src=x onerror="window.pwned=true">';
  hostile.teaching!.checks[0]!.choices[0]!.feedback = '<svg onload="window.pwned=true">';
  const safePack = await sealPack(hostile);
  await writeFile(path.join(directory, 'hostile.html'), renderHtml(safePack, 'lab', assets));
  await page.goto(file('hostile.html'));
  await expect(page.locator('[data-teaching="lab"]')).toHaveClass(/teaching-ready/);
  await expect(page.locator('img, svg')).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, 'pwned'))).toBeUndefined();
  await page.locator(`${currentTurn(0)} [data-choice-id]`).first().click();
  await expect(page.locator(`${currentTurn(0)} [data-teaching-feedback]`)).toContainText('<svg onload=');
  await expect(page.locator('svg')).toHaveCount(0);
});

test('a failed runtime validation restores the complete readable record instead of hiding results', async ({ page }) => {
  const broken = structuredClone(pack);
  broken.manifest.contentHash = '0'.repeat(64);
  await writeFile(path.join(directory, 'invalid.html'), renderHtml(broken, 'lab', assets));
  await page.goto(file('invalid.html'));
  await expect(page.locator('main > [role="alert"]')).toContainText('仍可阅读静态内容');
  await expect(page.locator('[data-teaching-result]:visible')).toHaveCount(pack.teaching!.transitions.length);
  await expect(page.locator('[data-teaching-transfer]')).toBeVisible();
});

test('entity positions and output-source alignment remain stable across story scenes and the card', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(file('slides.html'));
  const teaching = pack.teaching!;
  for (const [index, slide] of pack.narrative.slides.entries()) {
    if (!slide.scene || !['hook', 'mechanism', 'transition', 'outcome'].includes(slide.scene.kind)) continue;
    await page.locator('#slide-jump').selectOption(String(index));
    const section = page.locator(`[data-slide-index="${index}"]`);
    expect(await section.locator('[data-entity-id]').evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.entityId))).toEqual(teaching.entities.map(entity => entity.id));
    const boxes = await section.locator('[data-entity-id]').all();
    for (let i = 1; i < boxes.length; i++) expect((await boxes[i]!.boundingBox())!.x).toBeGreaterThan((await boxes[i - 1]!.boundingBox())!.x);
    if (slide.scene.kind === 'hook' && slide.scene.statePhase === 'after') {
      const transition = teaching.transitions.find(item => item.id === slide.scene!.transitionId)!;
      await expect(section.locator('[data-teaching-state]')).toHaveAttribute('data-teaching-state', transition.to);
      await expect(section).not.toContainText('接下来：');
    }
    if (slide.scene.kind === 'outcome') {
      const source = section.locator(`[data-entity-id="${teaching.outcome!.sourceEntityId}"]`);
      const output = section.locator('[data-outcome-source]');
      expect(Math.abs((await source.boundingBox())!.x - (await output.boundingBox())!.x)).toBeLessThan(2);
    }
  }
  await page.goto(file('card.html'));
  if (teaching.outcome) {
    const source = page.locator(`[data-teaching-state="${teaching.outcome.fromStateId}"] [data-entity-id="${teaching.outcome.sourceEntityId}"]`);
    expect(Math.abs((await source.boundingBox())!.x - (await page.locator('[data-outcome-source]').boundingBox())!.x)).toBeLessThan(2);
    await expect(page.locator('[data-teaching-outcome]')).toContainText('如果此刻执行');
    await expect(page.locator('[data-teaching-outcome]')).not.toContainText('规则推演');
  }
});

test('numerical UI still runs and resets with the same bundled Lab runtime', async ({ page }) => {
  await page.goto(file('legacy.html'));
  await expect(page.locator('#a-run')).toBeEnabled();
  await page.locator('#a-next').click();
  await expect(page.locator('#a-playback-status')).toContainText('第 1');
  await page.locator('#a-reset').click();
  await expect(page.locator('#a-playback-status')).toContainText('第 0');
  await expect(page.locator('[data-teaching="lab"]')).toHaveCount(0);
});
