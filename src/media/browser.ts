import { chromium, type Browser } from 'playwright-core';
import { createHash } from 'node:crypto';
import { AhaError, fail } from '../core/errors.js';

export async function openBrowser(): Promise<Browser> {
  const executablePath = process.env.AHA_BROWSER_EXECUTABLE;
  const channel = process.env.AHA_BROWSER_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chrome');
  try {
    return await chromium.launch({
      headless: true, timeout: 30000,
      ...(executablePath ? { executablePath } : { channel }),
    });
  } catch {
    throw new AhaError('MEDIA_BROWSER_MISSING', 'No approved local browser could start. Set AHA_BROWSER_EXECUTABLE or AHA_BROWSER_CHANNEL (msedge/chrome); no browser was downloaded.');
  }
}

export interface FrameInput {
  frame: number; fps: number; segmentIndex: number; segmentFrame: number; segmentFrames: number; text: string;
}

export async function bounded<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new AhaError('MEDIA_TIMEOUT', 'Authored frame exceeded its time budget.')), timeoutMs);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

/** Isolation and request blocking are defense in depth, not a hostile-code sandbox. */
export async function createFrameRenderer(html: string, browser: Browser) {
  const context = await browser.newContext({
    offline: true, serviceWorkers: 'block', viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1, reducedMotion: 'reduce', acceptDownloads: false,
  });
  let unsafe = false;
  await context.route('**/*', route => { unsafe = true; return route.abort('blockedbyclient'); });
  await context.routeWebSocket('**/*', socket => { unsafe = true; socket.close(); });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', () => { unsafe = true; });
  page.on('console', message => { if (message.type() === 'error') unsafe = true; });
  context.on('page', popup => { if (popup !== page) { unsafe = true; void popup.close(); } });
  page.on('dialog', dialog => { unsafe = true; void dialog.dismiss(); });
  const policy = "default-src 'none'; script-src 'unsafe-inline' data:; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; media-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src about:";
  try {
    await bounded(page.setContent(`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${policy}">
      <style>html,body{margin:0;width:1280px;height:720px;overflow:hidden;background:#000}
      iframe{border:0;width:1280px;height:720px;position:absolute;inset:0}
      #subtitle{position:absolute;z-index:2;left:64px;right:64px;bottom:24px;padding:12px 20px;
      color:white;background:rgba(0,0,0,.85);font:28px/1.4 sans-serif;text-align:center;
      white-space:pre-wrap;overflow-wrap:anywhere;box-sizing:border-box;pointer-events:none}</style></head>
      <body><iframe sandbox="allow-scripts" title="Authored video"></iframe><div id="subtitle"></div></body></html>`), 10000);
    await page.locator('iframe').evaluate((node, source) => { (node as HTMLIFrameElement).srcdoc = source; }, html);
    const frame = await page.locator('iframe').elementHandle().then(handle => handle!.contentFrame());
    if (!frame) fail('VIDEO_SOURCE', 'Unable to create the isolated authored frame.');
    await bounded(frame.waitForFunction(() => {
      const api = (window as unknown as { ahaVideo?: { renderFrame?: unknown } }).ahaVideo;
      return typeof api?.renderFrame === 'function';
    }), 10000);
    await bounded(frame.evaluate(async () => {
      await (window as unknown as { ahaMermaidReady?: Promise<unknown> }).ahaMermaidReady;
      await document.fonts.ready;
      const style = document.createElement('style');
      style.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}html,body{margin:0!important;overflow:hidden!important}';
      document.head.append(style);
    }), 10000);
    return {
      async render(input: FrameInput, sample = false): Promise<{ png: Buffer; visualHash?: string }> {
        try {
          await bounded(frame.evaluate(async args => {
            const api = (window as unknown as { ahaVideo: { renderFrame: (input: FrameInput) => unknown } }).ahaVideo;
            await api.renderFrame(args);
            await document.fonts.ready;
            for (const animation of document.getAnimations()) animation.pause();
            await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          }, input), 10000);
          await page.locator('#subtitle').evaluate((node, text) => { node.textContent = text; }, input.text);
          const overflow = await page.locator('#subtitle').evaluate(node => node.clientHeight > 150 || node.scrollWidth > node.clientWidth);
          if (overflow) fail('VIDEO_SUBTITLE_OVERFLOW', 'Sentence subtitle exceeds three-line budget; split the narration into shorter segments.');
          if (unsafe) fail('MEDIA_PAGE_ERROR', 'Authored source raised an error or attempted prohibited browser activity.');
          let visualHash: string | undefined;
          if (sample) {
            await page.locator('#subtitle').evaluate(node => { (node as HTMLElement).style.visibility = 'hidden'; });
            visualHash = createHash('sha256').update(await page.locator('iframe').screenshot({ type: 'png' })).digest('hex');
            await page.locator('#subtitle').evaluate(node => { (node as HTMLElement).style.visibility = 'visible'; });
          }
          const png = await page.screenshot({ type: 'png' });
          if (unsafe) fail('MEDIA_PAGE_ERROR', 'Authored source raised an error or attempted prohibited browser activity.');
          return { png, ...(visualHash ? { visualHash } : {}) };
        } catch (error) {
          if (error instanceof AhaError) throw error;
          throw new AhaError('MEDIA_PAGE_ERROR', 'Authored frame failed. Source error details are withheld.');
        }
      },
      close: () => context.close(),
    };
  } catch (error) {
    await context.close();
    if (error instanceof AhaError) throw error;
    throw new AhaError('MEDIA_PAGE_ERROR', 'Authored source could not initialize. Source error details are withheld.');
  }
}
