import { test, expect } from '@playwright/test';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { themeCss } from '../../src/artifacts/theme.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('optional diagram recipes render through the existing strict local Mermaid runtime offline', async ({ page, context }) => {
  const guide = await fs.readFile(path.join(root, 'skills', 'aha-explain', 'references', 'diagram-recipes.md'), 'utf8');
  const fragments = [...guide.matchAll(/```html\r?\n([\s\S]*?)\r?\n```/g)].map(match => match[1]!);
  expect(fragments).toHaveLength(3);
  await context.setOffline(true);
  await page.setContent(`<!doctype html><html lang="en"><head><style>${themeCss}</style></head><body>${fragments.join('\n')}</body></html>`);
  await page.addScriptTag({ path: path.join(root, 'dist', 'assets', 'runtime', 'mermaid.js') });
  await page.evaluate(async () => { await window.ahaMermaidReady; });
  await expect(page.locator('.aha-diagram svg')).toHaveCount(2);
  await expect(page.locator('.aha-diagram-error')).toHaveCount(0);
  await expect(page.locator('table th[scope="col"]')).toHaveCount(3);
  await expect(page.locator('table th[scope="row"]')).toHaveCount(1);
  for (const figure of await page.locator('.aha-diagram').all()) {
    await expect(figure.locator('.aha-diagram-controls')).toBeVisible();
    await expect(figure.locator('svg')).toBeVisible();
  }
});
