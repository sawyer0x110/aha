import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import PptxGenJS from 'pptxgenjs';
import type { Page, Frame } from 'playwright-core';
import { fail } from '../core/errors.js';
import { limitedJsonText, writeNewFile } from '../cli/files.js';
import { writeDossier } from '../research/dossier.js';
import { openBrowser } from '../media/browser.js';
import { assertAuthored, sourceHash, type Artifact, type Format } from './project.js';
import { outsideProject, noLinks, sourceFiles, hashFiles } from './files.js';
import { prepareHtml } from './html.js';
import { validatePptx } from './pptx-validation.js';

const EXECUTION_MS = 60_000;
const MAX_OUTPUT_BYTES = 128 * 1024 * 1024;

function authorize(allowCode: boolean): void {
  if (!allowCode) fail('CODE_AUTHORIZATION', 'Rendering authored browser/Node code requires --allow-code. Node authorship runs with your account permissions and is NOT a sandbox. Review the source first.');
}

async function expected(directory: string, format: Format): Promise<Awaited<ReturnType<typeof assertAuthored>>> {
  const project = await assertAuthored(directory);
  if (project.artifact.format !== format) fail('ARTIFACT_FORMAT', `Expected a ${format} artifact project; found ${project.artifact.format}.`);
  return project;
}

async function destination(root: string, output: string, extension: string): Promise<string> {
  const file = await outsideProject(root, output);
  if (path.extname(file).toLowerCase() !== extension) fail('OUTPUT_EXTENSION', `Output must end in ${extension}.`, file);
  for (const candidate of [file, `${file}.receipt.json`]) {
    await noLinks(candidate, true);
    try {
      await fs.lstat(candidate);
      fail('OUTPUT_EXISTS', 'Output/receipt already exists; choose a new destination.', candidate);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return file;
}

async function unchanged(directory: string, hash: string): Promise<void> {
  if (await sourceHash(directory) !== hash) fail('ARTIFACT_CHANGED', 'Project changed during rendering; no output was committed. Render again from stable sources.');
}

async function commit(directory: string, output: string, bytes: Uint8Array, artifact: Artifact, hash: string, details: object): Promise<object> {
  if (bytes.byteLength > MAX_OUTPUT_BYTES) fail('OUTPUT_SIZE', 'Rendered output exceeds 128 MiB.');
  await unchanged(directory, hash);
  await outsideProject(directory, output);
  const receipt = {
    schemaVersion: '1.0.0', status: 'delivered', format: artifact.format, title: artifact.title,
    researchHash: artifact.researchHash, sourceHash: hash,
    outputHash: createHash('sha256').update(bytes).digest('hex'),
    output: path.basename(output), createdAt: new Date().toISOString(),
    ...details,
    verification: 'Source/output hashes and declared claim coverage, not semantic truth or visual quality. Receipts describe a specific source revision; recheck the source hash after edits.',
  };
  const receiptFile = `${output}.receipt.json`;
  await writeNewFile(output, bytes);
  try {
    await unchanged(directory, hash);
    await writeNewFile(receiptFile, limitedJsonText(receipt, receiptFile));
  } catch (error) {
    // Remove only the exact output just created by this operation.
    await fs.unlink(output);
    throw error;
  }
  return { ...receipt, output, receipt: receiptFile };
}

export async function renderHtml(directory: string, output: string): Promise<object> {
  const { root, artifact } = await expected(directory, 'html');
  const file = await destination(root, output, '.html');
  const hash = await sourceHash(root);
  const html = await prepareHtml(root);
  return commit(root, file, Buffer.from(html), artifact, hash, { codeExecuted: false, selfContained: true });
}

interface BrowserResult {
  bytes?: Buffer;
  diagnostics: { width: number; height: number; scrollWidth: number; scrollHeight: number; clipped: number; missingImages: number; checkedLanguages?: string[] };
}

async function inspectPage(page: Page | Frame): Promise<BrowserResult['diagnostics']> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const clipped = [...document.querySelectorAll('h1,h2,h3,h4,p,li,td,th,figcaption')].filter(node => {
      const element = node as HTMLElement;
      const style = getComputedStyle(element);
      return ((style.overflowX === 'hidden' || style.overflowX === 'clip') && element.scrollWidth > element.clientWidth + 1)
        || ((style.overflowY === 'hidden' || style.overflowY === 'clip') && element.scrollHeight > element.clientHeight + 1);
    }).length;
    return {
      width: innerWidth, height: innerHeight, scrollWidth: root.scrollWidth, scrollHeight: root.scrollHeight, clipped,
      missingImages: [...document.images].filter(image => !image.complete || image.naturalWidth === 0).length,
    };
  });
}

async function browserRender(html: string, artifact: Artifact, capture: boolean): Promise<BrowserResult> {
  const browser = await openBrowser();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const run = async (): Promise<BrowserResult> => {
      const context = await browser.newContext({
        offline: true, serviceWorkers: 'block', acceptDownloads: false,
        viewport: { width: artifact.width, height: artifact.height }, deviceScaleFactor: 1,
        colorScheme: 'light', reducedMotion: 'reduce', permissions: [],
      });
      const external: string[] = [];
      const errors: string[] = [];
      await context.route('**/*', async route => {
        const url = route.request().url();
        if (/^(?:data:|blob:|about:)/i.test(url)) await route.continue();
        else { external.push(url); await route.abort('blockedbyclient'); }
      });
      await context.routeWebSocket('**/*', socket => { external.push(socket.url()); socket.close(); });
      const page = await context.newPage();
      page.setDefaultTimeout(15_000);
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error' && /Content Security Policy|Refused to (?:connect|load|frame)/i.test(message.text())) errors.push(message.text());
      });
      page.on('dialog', dialog => { void dialog.dismiss(); });
      context.on('page', popup => { if (popup !== page) void popup.close(); });
      try {
        // An opaque-origin sandbox also prevents navigation/popups that a meta CSP
        // alone cannot reliably prohibit. Only the trusted outer page is captured.
        await page.setContent(`<!doctype html><html><head>
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' data:; style-src 'unsafe-inline'; frame-src about:; img-src data: blob:; font-src data:; connect-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'">
          <style>html,body{margin:0;width:100%;height:100%;overflow:hidden}iframe{border:0;width:100%;height:100%;display:block}</style>
          </head><body><iframe sandbox="allow-scripts" title="Authored artifact"></iframe></body></html>`, { waitUntil: 'load', timeout: 20_000 });
        await page.locator('iframe').evaluate((node, source) => { (node as HTMLIFrameElement).srcdoc = source; }, html);
        const handle = await page.locator('iframe').elementHandle();
        const frame = await handle!.contentFrame();
        if (!frame) fail('ARTIFACT_BROWSER_ERROR', 'Unable to create isolated authoring frame.');
        await frame.waitForFunction(() => document.readyState === 'complete' && !!document.querySelector('meta[http-equiv]'), undefined, { timeout: 20_000 });
        await frame.evaluate(async () => {
          await document.fonts.ready;
          await (window as unknown as { __ahaReady?: Promise<void> }).__ahaReady;
          const failure = (window as unknown as { __ahaRenderError?: string }).__ahaRenderError;
          if (failure) throw new Error(failure);
        });
        const diagnostics = await inspectPage(frame);
        if (artifact.language === 'bilingual') {
          await frame.locator('.aha-language-controls button[data-language="zh"]').click();
          await frame.evaluate(async () => {
            await document.fonts.ready;
            await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          });
          const chinese = await inspectPage(frame);
          diagnostics.clipped += chinese.clipped;
          diagnostics.missingImages = Math.max(diagnostics.missingImages, chinese.missingImages);
          diagnostics.scrollWidth = Math.max(diagnostics.scrollWidth, chinese.scrollWidth);
          diagnostics.scrollHeight = Math.max(diagnostics.scrollHeight, chinese.scrollHeight);
          diagnostics.checkedLanguages = ['en', 'zh'];
          await frame.locator('.aha-language-controls button[data-language="en"]').click();
        }
        if (external.length || errors.length) fail('ARTIFACT_BROWSER_ERROR', 'Authored page attempted blocked networking or raised a browser error.', [...external, ...errors].slice(0, 5).join('\n'));
        if (diagnostics.missingImages) fail('ARTIFACT_IMAGE_MISSING', 'One or more packaged images failed to decode.');
        if (diagnostics.clipped || (artifact.format === 'image' && (diagnostics.scrollWidth > artifact.width + 1 || diagnostics.scrollHeight > artifact.height + 1))) {
          fail('ARTIFACT_LAYOUT', 'Authored content is clipped or exceeds the requested image dimensions.');
        }
        const bytes = capture ? await page.screenshot({ type: 'png', animations: 'disabled', timeout: 15_000 }) : undefined;
        return { diagnostics, ...(bytes ? { bytes } : {}) };
      } finally { await context.close(); }
    };
    return await Promise.race([
      run(),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Authored browser execution exceeded 60 seconds.')), EXECUTION_MS); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    await browser.close();
  }
}

export async function renderImage(directory: string, output: string, allowCode: boolean): Promise<object> {
  authorize(allowCode);
  const { root, artifact } = await expected(directory, 'image');
  const file = await destination(root, output, '.png');
  const hash = await sourceHash(root);
  const html = await prepareHtml(root);
  await unchanged(root, hash);
  const result = await browserRender(html, artifact, true);
  return commit(root, file, result.bytes!, artifact, hash, { codeExecuted: true, browser: result.diagnostics });
}

export async function checkBrowser(directory: string, allowCode: boolean): Promise<object> {
  authorize(allowCode);
  const { root, artifact } = await assertAuthored(directory);
  if (artifact.format === 'pptx') fail('ARTIFACT_FORMAT', 'Browser checks require HTML, image, or video source.');
  const hash = await sourceHash(root);
  const html = await prepareHtml(root);
  await unchanged(root, hash);
  const result = await browserRender(html, artifact, false);
  await unchanged(root, hash);
  return { ok: true, codeExecuted: true, sourceHash: hash, researchHash: artifact.researchHash, ...result.diagnostics };
}

/** Invoked only in a dedicated CLI worker after the caller authorizes Node execution. */
export async function runPptxWorker(directory: string, output: string): Promise<void> {
  const { root, artifact, dossier } = await expected(directory, 'pptx');
  const file = await destination(root, output, '.pptx');
  const Pptx = ('default' in PptxGenJS ? PptxGenJS.default : PptxGenJS) as unknown as new () => import('pptxgenjs').default;
  const pptx = new Pptx();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = artifact.title;
  pptx.subject = dossier.research.question;
  const author = await import(pathToFileURL(path.join(root, ...artifact.entry.split('/'))).href);
  if (typeof author.default !== 'function') fail('PPTX_AUTHOR', 'PPTX entry must export default async function({ pptx, research }).');
  await author.default({ pptx, research: dossier.research });
  const buffer = await pptx.write({ outputType: 'nodebuffer' });
  if (!(buffer instanceof Uint8Array)) fail('PPTX_OUTPUT', 'Native PPTX generator did not return bytes.');
  await outsideProject(root, file);
  await writeNewFile(file, buffer);
}

async function worker(directory: string, output: string): Promise<void> {
  const cli = fileURLToPath(import.meta.url.endsWith('.mjs')
    ? new URL(import.meta.url) : new URL('../../dist/cli/aha.mjs', import.meta.url));
  await fs.access(cli).catch(() => fail('PPTX_WORKER_MISSING', 'Build the Aha CLI before running authored PowerPoint code.'));
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [cli, '_pptx-worker', directory, output, '--allow-code'], {
      cwd: directory, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
      env: { ...process.env, AHA_PPTX_WORKER: '1' },
    });
    let diagnostics = '';
    const collect = (chunk: Buffer): void => { diagnostics = (diagnostics + chunk.toString('utf8')).slice(-8192); };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    let expired = false;
    const timer = setTimeout(() => {
      expired = true;
      child.kill();
      child.stdout.destroy();
      child.stderr.destroy();
      reject(new Error('Authored Node execution exceeded 60 seconds and was terminated.'));
    }, EXECUTION_MS);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => {
      clearTimeout(timer);
      if (expired) reject(new Error('Authored Node execution exceeded 60 seconds and was terminated.'));
      else if (code !== 0) reject(new Error(`Authored PPTX worker failed (${code}): ${diagnostics}`));
      else resolve();
    });
  });
}

export async function renderPptx(directory: string, output: string, allowCode: boolean): Promise<object> {
  authorize(allowCode);
  const { root, artifact, dossier } = await expected(directory, 'pptx');
  const file = await destination(root, output, '.pptx');
  const files = await sourceFiles(root);
  const hash = hashFiles(files);
  await unchanged(root, hash);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const workspace = path.join(path.dirname(file), `.aha-pptx-${randomUUID()}`);
  await fs.mkdir(workspace);
  const snapshot = path.join(workspace, 'project');
  const rendered = path.join(workspace, 'rendered.pptx');
  try {
    await fs.mkdir(snapshot);
    for (const [name, bytes] of files) await writeNewFile(path.join(snapshot, ...name.split('/')), bytes);
    await writeDossier(path.join(snapshot, 'research'), dossier);
    await worker(snapshot, rendered);
    await noLinks(rendered);
    const stat = await fs.lstat(rendered);
    if (!stat.isFile() || stat.size > MAX_OUTPUT_BYTES) fail('PPTX_SIZE', 'Rendered PPTX must be a regular file under 128 MiB.');
    const bytes = await fs.readFile(rendered);
    const slides = await validatePptx(bytes);
    return await commit(root, file, bytes, artifact, hash, { codeExecuted: true, sandboxed: false, native: true, slides });
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
}
