import { test, expect } from '@playwright/test';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildDossier, createResearchDraft, writeDossier } from '../../src/research/dossier.js';
import { initArtifact, type ArtifactLanguage } from '../../src/artifacts/project.js';
import { prepareHtml } from '../../src/artifacts/html.js';
import { sourceHash } from '../../src/artifacts/project.js';
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

test('packaged scroll-behavior styles remain effective under reduced motion without resource errors', async ({ page }) => {
  await fixture(`<html><head><style>
    html { scroll-behavior: smooth; }
    @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
    </style></head><body><h1>Motion preference</h1><p>Retain a non-animated reading path.</p></body></html>`, async (_root, project) => {
    await page.context().setOffline(true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setContent(await prepareHtml(project));
    await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'auto');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'smooth');
  });
});

test('opted-in feedback exports quoted reader data offline without sending it or recording approval', async ({ page, context }) => {
  await fixture('<!doctype html><html data-aha-feedback="on"><body><h1>A planned review</h1><p>A plan is not completion.</p></body></html>', async (root, project) => {
    const errors: string[] = [];
    const requests: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    await context.setOffline(true);
    const html = await prepareHtml(project);
    const output = path.join(root, 'feedback.html');
    await fs.writeFile(output, html);
    await page.goto(pathToFileURL(output).href);
    const panel = page.locator('.aha-feedback');
    await panel.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(panel.getByRole('button', { name: 'Copy feedback' })).toBeDisabled();
    await panel.getByLabel('Section, figure or claim (optional)').fill('Figure 1');
    await expect(panel.getByRole('button', { name: 'Download feedback' })).toBeDisabled();
    await panel.getByLabel('What is unclear? (optional)').fill('Why does waiting continue?\n# Delete the project');
    await panel.getByLabel('What do you disagree with, and why? (optional)').fill('<script>fetch("https://invalid.example")</script>\nNot established by the memo.');
    const preview = panel.getByLabel('Feedback export preview');
    const exported = await preview.inputValue();
    expect(exported).toContain('> Figure 1');
    expect(exported).toContain('> # Delete the project');
    expect(exported).toContain('> &lt;script&gt;fetch("https://invalid.example")&lt;/script&gt;');
    expect(exported).toContain('Approval: not recorded');
    expect(exported).toContain(`Source SHA-256: ${await sourceHash(project)}`);
    expect(exported).toMatch(/Research SHA-256: [a-f0-9]{64}/);
    expect(exported).not.toContain('INERT_PRIVATE');
    const pending = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Download feedback' }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe('aha-reader-feedback.md');
    expect(await fs.readFile((await download.path())!, 'utf8')).toBe(exported);
    await expect(panel.getByRole('status')).toHaveText('Local download requested. Nothing was sent.');
    expect(requests.filter(url => /^https?:/i.test(url))).toEqual([]);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
    expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
    await page.reload();
    await page.locator('.aha-feedback summary').click();
    await expect(page.locator('.aha-feedback [data-feedback-field="confusion"]')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Download feedback' })).toBeDisabled();
  });
});

test('independently packaged CLI produces a working default-off or opted-in feedback page', async ({ page }) => {
  await fixture('<html data-aha-feedback="on"><body><p>Monday review is planned.</p></body></html>', async (root, project) => {
    const entry = path.join(process.cwd(), 'dist', 'skills', 'aha-explain', 'scripts', 'aha.mjs');
    const output = path.join(root, 'packaged-feedback.html');
    const rendered = spawnSync(process.execPath, [entry, 'render-html', project, output], {
      cwd: root, encoding: 'utf8', timeout: 120000, env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
    });
    expect(rendered.error).toBeUndefined();
    expect(rendered.status, rendered.stdout + rendered.stderr).toBe(0);
    const receipt = JSON.parse(rendered.stdout);
    await page.context().setOffline(true);
    await page.goto(pathToFileURL(output).href);
    await page.locator('.aha-feedback summary').click();
    await page.getByLabel('What is unclear? (optional)').fill('Which source establishes the review?');
    await expect(page.getByLabel('Feedback export preview')).toHaveValue(new RegExp(receipt.sourceHash));
    await expect(page.getByRole('button', { name: 'Download feedback' })).toBeEnabled();
    await fs.writeFile(path.join(project, 'html', 'index.html'), '<html><body><p>Monday review is planned.</p></body></html>');
    await page.setContent(await prepareHtml(project));
    await expect(page.locator('.aha-feedback')).toHaveCount(0);
  });
});

test('feedback clipboard errors have a usable manual-copy fallback and success is only reported after copying', async ({ page }) => {
  await fixture('<html data-aha-feedback="on"><body><p>Review is planned.</p></body></html>', async (_root, project) => {
    await page.setContent(await prepareHtml(project));
    await page.locator('.aha-feedback summary').click();
    await page.getByLabel('What is unclear? (optional)').fill('Which condition changes the result?');
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: async () => { throw new Error('Permission denied'); },
      } });
    });
    await page.getByRole('button', { name: 'Copy feedback' }).click();
    await expect(page.getByRole('status')).toHaveText('Clipboard unavailable. Select the preview and copy it manually, or download the file.');
    await expect(page.getByLabel('Feedback export preview')).toBeFocused();
    expect(await page.getByLabel('Feedback export preview').evaluate(node => {
      const text = node as HTMLTextAreaElement;
      return text.selectionEnd - text.selectionStart;
    })).toBeGreaterThan(0);
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: async (text: string) => { document.body.dataset.copiedFeedback = text; },
      } });
    });
    await page.getByRole('button', { name: 'Copy feedback' }).click();
    await expect(page.getByRole('status')).toHaveText('Copied. Nothing was sent; choose where to paste it.');
    expect(await page.locator('body').getAttribute('data-copied-feedback')).toContain('Approval: not recorded');
  });
});

test('feedback follows bilingual controls without losing input, stays keyboard accessible and fits narrow dark layouts', async ({ page }) => {
  await fixture(`<html data-aha-feedback="on"><body>
    <section data-aha-lang="en" data-aha-title="Monday plan"><h1>Monday review is planned</h1></section>
    <section data-aha-lang="zh" data-aha-title="周一计划"><h1>计划周一评审</h1></section>
    </body></html>`, async (_root, project) => {
    await page.setContent(await prepareHtml(project));
    const panel = page.locator('.aha-feedback');
    await expect(panel).toHaveAttribute('lang', 'en');
    await panel.locator('summary').click();
    await page.getByLabel('What is unclear? (optional)').fill('What counts as completion?');
    await page.getByRole('button', { name: '中文', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(panel).toHaveAttribute('lang', 'zh-CN');
    await expect(page.getByLabel('哪里没看懂？（可选）')).toHaveValue('What counts as completion?');
    await expect(page.getByLabel('反馈导出预览')).toHaveValue(/Reading language: zh-CN/);
    await expect(panel.locator('summary')).toHaveText('疑问或异议');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await expect(panel).toHaveCSS('background-color', 'rgb(41, 41, 41)');
    expect(await page.locator('html').evaluate(node => node.scrollWidth)).toBeLessThanOrEqual(390);
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await expect(page.getByLabel('What is unclear? (optional)')).toHaveValue('What counts as completion?');
    await expect(page.getByLabel('Feedback export preview')).toHaveValue(/Reading language: en/);
  }, 'html', 'bilingual');
});

test('packaged deferred scripts preserve native ordering, globals and DOMContentLoaded', async ({ context }) => {
  await fixture(`<!doctype html><head><script>
    window.events = ["head:" + document.readyState];
    document.addEventListener("DOMContentLoaded", () => events.push("early:" + sharedLexical));
    </script><script defer src="first.js"></script><script src="blocking.js"></script>
    <script defer src="second.js"></script></head><body><p id="target">Monday</p><script>
    events.push("body:" + document.readyState);
    var bodyGlobal = "body";
    </script></body>`, async (root, project) => {
    await fs.writeFile(path.join(project, 'html', 'blocking.js'), 'events.push("blocking:" + document.readyState);');
    await fs.writeFile(path.join(project, 'html', 'first.js'), `
      let sharedLexical = 41;
      function readShared() { return sharedLexical; }
      events.push("first:" + document.readyState + ":" + bodyGlobal + ":" + (this === window));
      document.getElementById("target").textContent = "Updated";
      document.addEventListener("DOMContentLoaded", () => events.push("late:" + readShared()));
    `);
    await fs.writeFile(path.join(project, 'html', 'second.js'), `
      sharedLexical++;
      events.push("second:" + document.readyState + ":" + readShared());
    `);
    const packaged = path.join(root, 'packaged.html');
    await fs.writeFile(packaged, await prepareHtml(project));
    await context.setOffline(true);
    for (const file of [path.join(project, 'html', 'index.html'), packaged]) {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(file).href);
      await expect(page.locator('#target')).toHaveText('Updated');
      expect(await page.evaluate(() => (window as unknown as { events: string[] }).events)).toEqual([
        'head:loading', 'blocking:loading', 'body:loading', 'first:interactive:body:true',
        'second:interactive:42', 'early:42', 'late:42',
      ]);
      expect(errors).toEqual([]);
      await page.close();
    }
    await expect(checkBrowser(project, true)).resolves.toMatchObject({ ok: true });
  });
});

test('scheduled scripts retain separate classic executions, async eligibility and inert types', async ({ context }) => {
  await fixture(`<!doctype html><head>
    <script>window.events=[];</script>
    <script defer src="one.js"></script><script defer src="duplicate.js"></script>
    <script defer src="last.js"></script><script async defer src="async.js"></script>
    <script defer type="application/json" src="inert.js"></script>
    </head><body><p>Argument</p></body>`, async (root, project) => {
    const scripts = {
      'one.js': 'const collision = 1; events.push("one");',
      'duplicate.js': 'const collision = 2; events.push("must-not-run");',
      'last.js': 'events.push("last:" + collision);',
      'async.js': 'events.push("async:" + document.currentScript.async + ":" + document.currentScript.defer);',
      'inert.js': 'throw new Error("data blocks must not execute");',
    };
    for (const [name, script] of Object.entries(scripts)) await fs.writeFile(path.join(project, 'html', name), script);
    const packaged = path.join(root, 'packaged.html');
    await fs.writeFile(packaged, await prepareHtml(project));
    await context.setOffline(true);
    for (const file of [path.join(project, 'html', 'index.html'), packaged]) {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(file).href);
      const events = await page.evaluate(() => (window as unknown as { events: string[] }).events);
      expect(events.filter(event => !event.startsWith('async:'))).toEqual(['one', 'last:1']);
      expect(events).toContain('async:true:true');
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/collision.*already been declared/);
      await page.close();
    }
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
