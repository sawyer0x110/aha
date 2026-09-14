import { test, expect } from '@playwright/test';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildDossier, createResearchDraft, writeDossier } from '../../src/research/dossier.js';
import { initArtifact } from '../../src/artifacts/project.js';
import { prepareHtml } from '../../src/artifacts/html.js';
import { renderImage, checkBrowser } from '../../src/artifacts/render.js';

async function fixture(source: string, run: (root: string, project: string) => Promise<void>, format: 'html' | 'image' = 'html'): Promise<void> {
  const root = path.join(process.cwd(), `.browser-artifact-${randomUUID()}`);
  await fs.mkdir(root);
  try {
    const dossier = await buildDossier({
      ...createResearchDraft('What did the memo establish?'), id: 'browser-research', title: 'Browser research', status: 'complete',
      report: 'The memo plans a Monday review.',
      claims: [{ id: 'c1', text: 'Review planned for Monday.', evidenceIds: ['e1'], limitations: [] }],
      evidence: [{ id: 'e1', kind: 'provided', title: 'Memo', locator: 'User memo', summary: 'Monday review', sourceVersion: 'v1' }],
      subquestions: [{ id: 'q1', question: 'What day?', status: 'answered', claimIds: ['c1'], gapIds: [] }],
      stopReason: 'Provided memo answers the question.',
    });
    await writeDossier(path.join(root, 'dossier'), dossier);
    const project = path.join(root, 'project');
    await initArtifact(path.join(root, 'dossier'), format, project);
    const file = path.join(project, 'artifact.json');
    const artifact = JSON.parse(await fs.readFile(file, 'utf8'));
    artifact.status = 'authored';
    artifact.coverage = [{ id: 'explanation', claimIds: ['c1'] }];
    artifact.width = 800; artifact.height = 600;
    await fs.writeFile(file, JSON.stringify(artifact));
    await fs.writeFile(path.join(project, 'html', 'index.html'), source);
    await run(root, project);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}

test('arbitrary interactive explanation works offline with full Clawpilot light/dark tokens', async ({ page }) => {
  await fixture('<!doctype html><main style="padding:32px"><h1>A custom argument</h1><button id="reveal">Show limitation</button><p id="limitation" hidden>A plan is not completion.</p></main><script>document.querySelector("#reveal").onclick=()=>document.querySelector("#limitation").hidden=false;</script>', async (_root, project) => {
    await page.context().setOffline(true);
    await page.setContent(await prepareHtml(project));
    await expect(page.getByRole('heading')).toHaveText('A custom argument');
    await page.getByRole('button', { name: 'Show limitation' }).click();
    await expect(page.locator('#limitation')).toBeVisible();
    await expect(page.locator('body')).toHaveCSS('font-family', /Segoe UI/);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(61, 59, 58)');
  });
});

test('Mermaid renders SVG offline and provides keyboard-accessible zoom and expansion', async ({ page }) => {
  await fixture('<!doctype html><main><h1>Decision path</h1><pre class="mermaid">flowchart LR\n A[Memo] --> B[Monday plan]\n B --> C[Not completion]</pre></main>', async (_root, project) => {
    await page.context().setOffline(true);
    await page.setContent(await prepareHtml(project));
    await expect(page.locator('.aha-diagram svg')).toBeVisible();
    const width = await page.locator('.aha-diagram svg').evaluate(node => node.getBoundingClientRect().width);
    await page.getByRole('button', { name: 'Zoom in' }).click();
    expect(await page.locator('.aha-diagram svg').evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(width);
    await page.getByRole('button', { name: /Expand/ }).click();
    await expect(page.getByRole('button', { name: /Collapse/ })).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /Expand/ })).toHaveAttribute('aria-expanded', 'false');
  });
});

test('image workflow captures authored content to a real PNG with dimensions and a receipt', async () => {
  await fixture('<!doctype html><main style="padding:32px"><h1>Monday review</h1><svg width="300" height="150" role="img"><rect width="300" height="150" fill="var(--cp-accent)"/></svg><p>Planned, not completed.</p></main>', async (root, project) => {
    const output = path.join(root, 'result.png');
    const result = await renderImage(project, output, true) as { browser: { width: number; height: number } };
    expect(result.browser.width).toBe(800);
    expect(result.browser.height).toBe(600);
    const bytes = await fs.readFile(output);
    expect(bytes.subarray(1, 4).toString()).toBe('PNG');
    expect(bytes.readUInt32BE(16)).toBe(800);
    expect(bytes.readUInt32BE(20)).toBe(600);
    await expect(fs.access(`${output}.receipt.json`)).resolves.toBeUndefined();
  }, 'image');
});

test('browser QA rejects script errors and hidden network attempts', async () => {
  for (const script of ['throw new Error("authored failure")', 'fetch("https://invalid.example/no-network").catch(()=>{})']) {
    await fixture(`<!doctype html><h1>Authored explanation</h1><script>${script}</script>`, async (_root, project) => {
      await expect(checkBrowser(project, true)).rejects.toThrow(/browser error|blocked networking/);
    });
  }
});

test('image capture rejects content exceeding the requested canvas', async () => {
  await fixture('<!doctype html><main style="height:1200px"><h1>Too tall</h1></main>', async (root, project) => {
    await expect(renderImage(project, path.join(root, 'clipped.png'), true)).rejects.toThrow(/clipped|exceeds/);
  }, 'image');
});
