import { chromium, type Browser } from 'playwright-core';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
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

export async function captureHtml(html: string, selector: '#aha-card' | '#aha-scene', browser: Browser): Promise<Uint8Array> {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'aha-capture-'));
  const context = await browser.newContext({
    offline: true, serviceWorkers: 'block',
    viewport: selector === '#aha-scene' ? { width: 1280, height: 720 } : { width: 1080, height: 1600 },
    deviceScaleFactor: 1, reducedMotion: 'reduce',
  });
  const external: string[] = [];
  const errors: string[] = [];
  context.on('request', request => { if (/^https?:/i.test(request.url())) external.push(request.url()); });
  try {
    const file = path.join(temp, 'frame.html');
    await fs.writeFile(file, html, 'utf8');
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${pathToFileURL(file).href}?scoutTheme=light`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const element = page.locator(selector);
    const layout = await element.evaluate(node => ({
      width: node.clientWidth, height: node.clientHeight,
      scrollWidth: node.scrollWidth, scrollHeight: node.scrollHeight,
    }));
    if (layout.width !== (selector === '#aha-scene' ? 1280 : 1080)
      || layout.height > (selector === '#aha-scene' ? 720 : 2400)
      || layout.scrollWidth > layout.width + 1 || layout.scrollHeight > layout.height + 1) {
      fail('MEDIA_LAYOUT_OVERFLOW', 'The image/scene exceeds its visible content budget. Shorten the narrative without dropping evidence or key facts.');
    }
    const clipped = await element.locator('h1,h2,h3,p,li,figcaption,td,th').evaluateAll(nodes => nodes.some(node => {
      const style = getComputedStyle(node);
      return (style.overflowX === 'hidden' && node.scrollWidth > node.clientWidth + 1)
        || (style.overflowY === 'hidden' && node.scrollHeight > node.clientHeight + 1);
    }));
    if (clipped) fail('MEDIA_LAYOUT_OVERFLOW', 'A scene/card text block is clipped. Shorten the narrative before capture.');
    if (external.length || errors.length) fail('MEDIA_PAGE_ERROR', 'Image page tried an external request or raised a script error.');
    return await element.screenshot({ type: 'png', animations: 'disabled' });
  } finally {
    await context.close();
    await fs.rm(temp, { recursive: true, force: true });
  }
}
