import { test, expect } from '@playwright/test';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildDossier, createResearchDraft, writeDossier } from '../../src/research/dossier.js';
import { initArtifact, type ArtifactLanguage } from '../../src/artifacts/project.js';
import { prepareHtml } from '../../src/artifacts/html.js';
import { renderImage, checkBrowser } from '../../src/artifacts/render.js';

async function fixture(source: string, run: (root: string, project: string) => Promise<void>, format: 'html' | 'image' = 'html', language: ArtifactLanguage = 'en'): Promise<void> {
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
    await initArtifact(path.join(root, 'dossier'), format, project, language);
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

test('authored theme modes, tokens and typography survive packaging and style Mermaid', async ({ page }) => {
  await fixture(`<!doctype html><html data-theme="light"><head><style>
    :root, html[data-theme="light"], html[data-theme="dark"] {
      --cp-bg: var(--cp-surface);
      --cp-text: var(--cp-link);
      --cp-border-strong: var(--cp-link);
    }
    body { font-family: Consolas, "Courier New", monospace; }
  </style></head><body><h1>Monday review</h1>
  <pre class="mermaid">flowchart LR\n A[Memo] --> B[Monday plan]</pre></body></html>`, async (_root, project) => {
    await page.context().setOffline(true);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setContent(await prepareHtml(project));
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.evaluate(() => window.ahaMermaidReady);
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.locator('body')).toHaveCSS('color', 'rgb(0, 120, 212)');
    await expect(page.locator('.aha-diagram svg')).toHaveCSS('font-family', /Consolas/);
    await expect(page.locator('.aha-diagram .node rect').first()).toHaveCSS('stroke', 'rgb(0, 120, 212)');
    await expect(page.locator('.aha-diagram-controls button').first()).toHaveCSS('color', 'rgb(0, 120, 212)');
    await page.getByRole('button', { name: 'Zoom in' }).click();

    await page.emulateMedia({ colorScheme: 'light' });
    const html = (await prepareHtml(project)).replace('data-theme="light"', 'data-theme="dark"');
    await page.setContent(html);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.evaluate(() => window.ahaMermaidReady);
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(41, 41, 41)');
    await expect(page.locator('.aha-diagram .node rect').first()).toHaveCSS('stroke', 'rgb(77, 166, 255)');
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

test('bilingual HTML switches offline titles, content, focus and Mermaid labels in both directions', async ({ page }) => {
  await fixture(`<!doctype html><html><head><style>[data-aha-lang]{display:block}</style></head><body>
    <section data-aha-lang="en" data-aha-title="Monday plan">
      <h1>Monday review is planned</h1><p>Not evidence of completion.</p><button>Read evidence</button>
      <pre class="mermaid">flowchart LR\n A[Memo] --> B[Plan]</pre>
    </section>
    <section data-aha-lang="zh" data-aha-title="周一计划">
      <h1>计划周一评审</h1><p>不代表已经完成。</p><button>查看依据</button>
      <pre class="mermaid">flowchart LR\n A[备忘录] --> B[计划]</pre>
    </section></body></html>`, async (_root, project) => {
    await page.context().setOffline(true);
    await page.setContent(await prepareHtml(project));
    await page.evaluate(() => window.ahaMermaidReady);
    await expect(page).toHaveTitle('Monday plan');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('button', { name: 'Read evidence' })).toBeVisible();
    await expect(page.locator('[data-aha-lang="zh"]')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '中文', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveTitle('周一计划');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await expect(page.getByRole('button', { name: '中文', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-aha-lang="en"]')).toBeHidden();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: '查看依据', exact: true })).toBeFocused();
    await expect(page.locator('[data-aha-lang="zh"] .aha-diagram svg')).toBeVisible();
    await page.getByRole('button', { name: '放大', exact: true }).click();
    await page.getByRole('button', { name: '展开', exact: true }).click();
    await expect(page.getByRole('button', { name: '收起', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await expect(page).toHaveTitle('Monday plan');
    await expect(page.getByRole('button', { name: 'Read evidence' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible();
    await page.setViewportSize({ width: 420, height: 900 });
    expect(await page.locator('html').evaluate(node => node.scrollWidth)).toBeLessThanOrEqual(420);
    await page.getByRole('button', { name: '中文', exact: true }).click();
    await expect(page.getByRole('heading', { name: '计划周一评审' })).toBeVisible();
    expect(await page.locator('html').evaluate(node => node.scrollWidth)).toBeLessThanOrEqual(420);
  }, 'html', 'bilingual');
});

test('browser QA also inspects the initially hidden Chinese branch', async () => {
  await fixture(`<!doctype html><html><body>
    <section data-aha-lang="en" data-aha-title="Plan"><p>Monday review is planned.</p></section>
    <section data-aha-lang="zh" data-aha-title="计划"><p style="width:20px;overflow:hidden;white-space:nowrap">周一评审只是计划，并不代表完成。</p></section>
    </body></html>`, async (_root, project) => {
    await expect(checkBrowser(project, true)).rejects.toThrow(/clipped/);
  }, 'html', 'bilingual');
});
