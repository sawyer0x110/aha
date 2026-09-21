import { test, expect } from '@playwright/test';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const examples = fileURLToPath(new URL('../../examples/', import.meta.url));
const gallery = pathToFileURL(path.join(examples, 'index.html')).href;
const outputs = [
  'anc/index.html', 'anc/anc.png', 'anc/anc.pptx', 'anc/anc.mp4',
  'git-merge/index.html', 'git-merge/git-merge.png', 'git-merge/git-merge.pptx', 'git-merge/git-merge.mp4',
  'aha-introduction/index.html', 'aha-introduction/overview.png', 'aha-introduction/overview.pptx',
  'greenland/greenland.pptx', 'greenland/greenland.mp4', 'cpython-string/pilot.mp4',
  'docker-layers/pilot.mp4', 'aha-introduction/overview-v5.mp4',
].sort();

for (const width of [1280, 390]) {
  for (const theme of ['light', 'dark']) {
    test(`gallery languages, keyboard and layout at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const externalRequests: string[] = [];
      const errors: string[] = [];
      page.on('request', request => {
        if (!request.url().startsWith('file:')) externalRequests.push(request.url());
      });
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        for (const name of ['localStorage', 'sessionStorage', 'indexedDB']) {
          Object.defineProperty(window, name, {
            get() { throw new Error(`Gallery must not access ${name}`); },
          });
        }
      });
      await page.goto(`${gallery}?scoutTheme=${theme}`);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page).toHaveTitle('Aha — From concrete questions to explanations across media');
      await expect(page.getByRole('navigation')).toHaveAttribute('aria-label', 'Gallery language');
      await expect(page.getByRole('article')).toHaveCount(6);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

      const english = page.locator('[data-gallery-lang="en"]');
      const chinese = page.locator('[data-gallery-lang="zh-CN"]');
      const englishButton = page.locator('[data-gallery-switch="en"]');
      const chineseButton = page.locator('[data-gallery-switch="zh-CN"]');
      await expect(english).toBeVisible();
      await expect(chinese).toBeHidden();
      await expect(chinese).toHaveAttribute('inert', '');
      await page.keyboard.press('Tab');
      await expect(englishButton).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(chineseButton).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(chineseButton).toBeFocused();
      await expect(chineseButton).toHaveAttribute('aria-pressed', 'true');
      await expect(englishButton).toHaveAttribute('aria-pressed', 'false');
      await expect(englishButton).toHaveAttribute('aria-label', 'English — 用英文阅读作品入口');
      await expect(chineseButton).toHaveAttribute('aria-label', '中文 — 用中文阅读作品入口');
      await expect(page.getByRole('navigation')).toHaveAttribute('aria-label', '作品入口语言');
      await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
      await expect(page).toHaveTitle('Aha — 从具体问题到多媒介讲解');
      await expect(chinese).toBeVisible();
      await expect(english).toBeHidden();
      await expect(english).toHaveAttribute('inert', '');
      await expect(page.getByRole('article')).toHaveCount(6);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

      // Even a programmatic focus attempt cannot enter the inactive language.
      await english.locator('a').first().evaluate(link => (link as HTMLElement).focus());
      await expect(chineseButton).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(chinese.locator('a').first()).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

      await englishButton.focus();
      await page.keyboard.press('Space');
      await expect(english).toBeVisible();
      await expect(chinese).toBeHidden();
      await expect(englishButton).toHaveAttribute('aria-pressed', 'true');
      await expect(englishButton).toHaveAttribute('aria-label', 'English — Read the gallery in English');
      await expect(chineseButton).toHaveAttribute('aria-label', '中文 — Read the gallery in Chinese');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await chineseButton.click();
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      expect(externalRequests).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

test('both gallery languages retain all sixteen local outputs and Chinese topic notes', async ({ page }) => {
  await page.goto(gallery);
  for (const language of ['en', 'zh-CN']) {
    const section = page.locator(`[data-gallery-lang="${language}"]`);
    const links = await section.locator('a').evaluateAll(anchors =>
      anchors.map(anchor => anchor.getAttribute('href')!));
    expect(links.some(link => link.startsWith('project-overview/'))).toBe(false);
    expect(await section.locator('.number').allTextContents()).toEqual(['01', '02', '03', '04', '05', '06']);
    for (const link of links) {
      expect(link).not.toMatch(/^(?:[a-z]+:|\/\/|#)/i);
      await access(path.join(examples, link));
    }
    expect([...new Set(links.filter(link => /\.(html|png|pptx|mp4)$/.test(link)))].sort()).toEqual(outputs);
    const notes = section.locator('article a[href$="/README.md"]');
    await expect(notes).toHaveCount(6);
    for (const text of await notes.allTextContents()) {
      expect(text).toContain(language === 'en' ? 'Chinese notes' : '中文说明');
    }
    expect(links).toContain(language === 'en' ? 'README.md' : 'README.zh-CN.md');
    expect(links).toContain('delivery-manifest.json');
    expect(links).toContain('../LICENSE');
    expect(links).toContain('../docs/LICENSE-SCOPE.md');
  }
});
