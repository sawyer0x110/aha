import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fail } from '../core/errors.js';
import { limitedJsonText, writeNewFile } from '../cli/files.js';
import { outsideProject } from './files.js';
import { prepareHtml } from './html.js';
import { assertAuthored, sourceHash } from './project.js';
import { browserRender, inspectPage } from './render.js';

export interface ShareOptions {
  format: 'pdf' | 'png';
  language?: 'en' | 'zh' | 'all';
  pageHeight?: number;
}

export function shareSlices(height: number, pageHeight: number): { y: number; height: number }[] {
  if (!Number.isInteger(pageHeight) || pageHeight < 240 || pageHeight > 4096) {
    fail('EXPORT_SIZE', 'Page height must be an integer from 240 to 4096 CSS pixels.');
  }
  if (!Number.isInteger(height) || height < 1 || height > 100_000 || Math.ceil(height / pageHeight) > 100) {
    fail('EXPORT_SIZE', 'A language export must fit within 100 pages and 100000 CSS pixels.');
  }
  return Array.from({ length: Math.ceil(height / pageHeight) }, (_, index) => ({
    y: index * pageHeight, height: Math.min(pageHeight, height - index * pageHeight),
  }));
}

/** A static reading snapshot, not an image-format authored composition or QA. */
export async function exportHtml(directory: string, output: string, allowCode: boolean, options: ShareOptions): Promise<object> {
  if (!allowCode) fail('CODE_AUTHORIZATION', 'HTML sharing executes authored browser code. Review the source and pass --allow-code; this is not an OS sandbox.');
  if (!['pdf', 'png'].includes(options.format)) fail('EXPORT_FORMAT', 'Choose pdf or png.');
  const pageHeight = options.pageHeight ?? 1600;
  shareSlices(1, pageHeight);
  const { root, artifact } = await assertAuthored(directory);
  if (artifact.format !== 'html') fail('ARTIFACT_FORMAT', 'Sharing exports require an HTML project; use render-image for an authored image composition.');
  const available = artifact.language === 'bilingual' ? ['en', 'zh'] : [artifact.language ?? 'en'];
  const selected = options.language ?? 'all';
  if (!['en', 'zh', 'all'].includes(selected) || (selected !== 'all' && !available.includes(selected))) {
    fail('ARTIFACT_LANGUAGE', 'Choose all or a language present in the HTML project. Legacy projects without language metadata are treated as en.');
  }
  const languages = selected === 'all' ? available : [selected];
  const destination = await outsideProject(root, output);
  try {
    await fs.lstat(destination);
    fail('OUTPUT_EXISTS', 'Export directory already exists; choose a fresh versioned destination.', destination);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const hash = await sourceHash(root);
  const html = await prepareHtml(root);
  const outputs: { file: string; language: string; page?: number; y?: number; width: number; height: number; outputHash: string }[] = [];
  let totalBytes = 0;
  // Reserve only a fresh directory. On failure remove only files created here.
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.mkdir(destination);
  const created: string[] = [];
  const save = async (name: string, bytes: Buffer, details: Omit<typeof outputs[number], 'file' | 'outputHash'>): Promise<void> => {
    totalBytes += bytes.length;
    if (totalBytes > 128 * 1024 * 1024) fail('OUTPUT_SIZE', 'Sharing export exceeds 128 MiB.');
    const file = path.join(destination, name);
    await writeNewFile(file, bytes);
    created.push(file);
    outputs.push({ file: name, ...details, outputHash: createHash('sha256').update(bytes).digest('hex') });
  };
  try {
    await browserRender(html, artifact, false, {
      inspect: async (frame, page, language) => {
        if (!languages.includes(language)) return;
        await frame.evaluate(async () => {
          for (const animation of document.getAnimations()) animation.pause();
          await document.fonts.ready;
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        });
        const dimensions = await inspectPage(frame);
        if (dimensions.clipped || dimensions.scrollWidth > artifact.width + 1) {
          fail('ARTIFACT_LAYOUT', 'HTML sharing does not crop clipped text or horizontal overflow. Repair the source at the declared width.');
        }
        const slices = shareSlices(dimensions.scrollHeight, pageHeight);
        const iframe = page.locator('iframe');
        const previous = await iframe.getAttribute('style');
        try {
          await iframe.evaluate((node, height) => { (node as HTMLElement).style.height = `${height}px`; }, dimensions.scrollHeight);
          await page.addStyleTag({ content: 'html,body{height:auto!important;overflow:visible!important}' });
          await frame.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
          const expanded = await inspectPage(frame);
          if (expanded.missingImages) fail('ARTIFACT_IMAGE_MISSING', 'One or more packaged images failed to decode in the sharing layout.');
          if (expanded.scrollHeight > dimensions.scrollHeight + 1 || expanded.scrollWidth > artifact.width + 1 || expanded.clipped) {
            fail('EXPORT_REFLOW', 'Extending the reading viewport changes or clips this layout. Use a stable document-flow layout for sharing, or retain the interactive HTML.');
          }
          if (options.format === 'pdf') {
            await page.emulateMedia({ media: 'screen' });
            const bytes = await page.pdf({
              width: `${artifact.width}px`, height: `${pageHeight}px`, printBackground: true,
              margin: { top: 0, bottom: 0, left: 0, right: 0 }, preferCSSPageSize: false,
            });
            await save(`${language}.pdf`, bytes, { language, width: artifact.width, height: pageHeight });
          } else {
            for (const [index, slice] of slices.entries()) {
              const bytes = await page.screenshot({
                type: 'png', fullPage: true, animations: 'disabled', timeout: 15_000,
                clip: { x: 0, y: slice.y, width: artifact.width, height: slice.height },
              });
              await save(`${language}-${String(index + 1).padStart(3, '0')}.png`, bytes,
                { language, page: index + 1, y: slice.y, width: artifact.width, height: slice.height });
            }
          }
        } finally {
          await iframe.evaluate((node, style) => {
            if (style === null) node.removeAttribute('style');
            else node.setAttribute('style', style);
          }, previous);
        }
      },
    });
    if (await sourceHash(root) !== hash) fail('ARTIFACT_CHANGED', 'Source changed during export; retry from stable sources.');
    const receipt = {
      schemaVersion: '1.0.0', status: 'delivered', purpose: 'html-sharing', sourceFormat: 'html', format: options.format,
      title: artifact.title, researchHash: artifact.researchHash, sourceHash: hash,
      languages, width: artifact.width, pageHeight, outputs, codeExecuted: true,
      interactions: 'lost: static snapshots of initial language states; no hover, disclosure, animation, feedback or navigation behavior is preserved.',
      pagination: 'Fixed-height reading pages/slices; boundaries may split text or figures. Review every boundary. This is not an image-format composition or visual QA.',
      verification: 'Source/output hashes only, not factual, semantic or visual acceptance. No upload or network authorization.',
      createdAt: new Date().toISOString(),
    };
    const receiptFile = path.join(destination, 'receipt.json');
    await writeNewFile(receiptFile, limitedJsonText(receipt, receiptFile));
    created.push(receiptFile);
    return { ...receipt, directory: destination, receipt: receiptFile };
  } catch (error) {
    for (const file of created.reverse()) await fs.unlink(file);
    await fs.rmdir(destination);
    throw error;
  }
}
