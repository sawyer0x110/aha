import { test, expect } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPack } from '../../src/core/pack.js';
import { renderSceneHtml } from '../../src/renderers/card.js';
import { createTeachingDraft } from '../helpers/teaching.js';

test('all authored teaching video scenes fit their frame without overlapping captions', async ({ page }) => {
  const directory = await mkdtemp(path.resolve('tests', 'browser', 'teaching-video-artifacts-'));
  try {
    const pack = await buildPack(createTeachingDraft());
    const requests: string[] = [];
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.context().setOffline(true);
    for (const slide of pack.narrative.slides) {
      const file = path.join(directory, `${slide.id}.html`);
      await writeFile(file, renderSceneHtml(pack, slide.id, slide.body));
      await page.goto(`${pathToFileURL(file).href}?scoutTheme=light`);
      await page.evaluate(() => document.fonts.ready);
      const scene = page.locator('#aha-scene');
      const size = await scene.evaluate(element => ({
        width: element.clientWidth,
        height: element.clientHeight,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight,
        contentBottom: Math.max(...Array.from(element.querySelector(':scope > div')!.children)
          .map(child => child.getBoundingClientRect().bottom)),
        captionTop: element.querySelector('.scene-caption')!.getBoundingClientRect().top,
      }));
      expect(size.width).toBe(1280);
      expect(size.height).toBe(720);
      expect(size.scrollWidth, slide.id).toBeLessThanOrEqual(1280);
      expect(size.scrollHeight, slide.id).toBeLessThanOrEqual(720);
      expect(size.contentBottom, `${slide.id} content overlaps caption`).toBeLessThanOrEqual(size.captionTop);
      await expect(scene.locator('.scene-caption')).toHaveText(slide.body);
      await expect(scene).not.toContainText(pack.manifest.contentHash);
    }
    expect(requests).toEqual([]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
