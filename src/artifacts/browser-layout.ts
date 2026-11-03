import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fail } from '../core/errors.js';
import { limitedJsonText, writeNewFile } from '../cli/files.js';
import { assertAuthored, sourceHash } from './project.js';
import { noLinks, outsideProject } from './files.js';
import { prepareHtml } from './html.js';
import { browserRender } from './render.js';
import { captureLayout } from './layout.js';

const hashBytes = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

export async function checkBrowserLayout(directory: string, output: string, allowCode: boolean) {
  if (!allowCode) fail('CODE_AUTHORIZATION', 'Browser layout diagnostics execute authored code and require reviewed --allow-code approval; this is not an OS sandbox.');
  const { root, artifact } = await assertAuthored(directory);
  if (artifact.format !== 'html') fail('ARTIFACT_FORMAT', 'Responsive layout reports require an HTML project.');
  const reportFile = await outsideProject(root, output);
  if (path.extname(reportFile).toLowerCase() !== '.json') fail('OUTPUT_EXTENSION', 'Layout report must end in .json.', reportFile);
  const receiptFile = `${reportFile}.receipt.json`;
  const evidenceDirectory = `${reportFile}.evidence`;
  for (const candidate of [reportFile, receiptFile, evidenceDirectory]) {
    await noLinks(candidate, true);
    try {
      await fs.lstat(candidate);
      fail('OUTPUT_EXISTS', 'Layout report, receipt or evidence already exists; choose a new destination.', candidate);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  const hash = await sourceHash(root);
  const html = await prepareHtml(root);
  const stable = async (): Promise<void> => {
    if (await sourceHash(root) !== hash) fail('ARTIFACT_CHANGED', 'Project changed during layout inspection; no report was committed.');
  };
  await stable();
  const checks: Awaited<ReturnType<typeof captureLayout>>['result'][] = [];
  const screenshots: Awaited<ReturnType<typeof captureLayout>>['screenshots'] = [];
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    await browserRender(html, artifact, false, {
      viewport,
      inspect: async (frame, page, language) => {
        const capture = await captureLayout(frame, page, language);
        checks.push(capture.result);
        screenshots.push(...capture.screenshots);
        if (screenshots.reduce((sum, item) => sum + item.bytes.length, 0) > 128 * 1024 * 1024) fail('OUTPUT_SIZE', 'Layout evidence exceeds 128 MiB.');
      },
    });
  }
  await stable();
  const issueCount = checks.reduce((sum, item) => sum + item.issueCount, 0);
  const report = {
    schemaVersion: '1.0.0', status: issueCount ? 'issues-found' : 'checked', ok: issueCount === 0,
    codeExecuted: true, sourceHash: hash, researchHash: artifact.researchHash, title: artifact.title,
    sourceEntry: artifact.entry,
    createdAt: new Date().toISOString(), issueCount, checks,
    evidenceDirectory: path.basename(evidenceDirectory),
    screenshots: screenshots.map(item => ({ file: item.file, sha256: hashBytes(item.bytes) })),
    scope: 'Offline initial light/reduced-motion layout at two viewports and all declared languages. SVG text geometry only; no OCR, canvas/raster text analysis, general occlusion detection, interaction coverage, translation, factual, comprehension or visual acceptance. Screenshots cover the top and up to 12 issue locations per check, not every page region. Bounding-box warnings may be intentional.',
  };
  const text = limitedJsonText(report, reportFile);
  const receipt = {
    schemaVersion: '1.0.0', status: report.status, codeExecuted: true, sourceHash: hash,
    researchHash: artifact.researchHash, output: path.basename(reportFile), outputHash: hashBytes(Buffer.from(text)),
    screenshots: report.screenshots, verification: report.scope,
  };
  await outsideProject(root, reportFile);
  await noLinks(evidenceDirectory, true);
  await fs.mkdir(path.dirname(evidenceDirectory), { recursive: true });
  await fs.mkdir(evidenceDirectory);
  const written: string[] = [];
  try {
    for (const screenshot of screenshots) {
      const file = path.join(evidenceDirectory, screenshot.file);
      await writeNewFile(file, screenshot.bytes);
      written.push(file);
    }
    await stable();
    await writeNewFile(reportFile, text);
    written.push(reportFile);
    await stable();
    await writeNewFile(receiptFile, limitedJsonText(receipt, receiptFile));
  } catch (error) {
    for (const file of written.reverse()) await fs.unlink(file);
    await fs.rmdir(evidenceDirectory);
    throw error;
  }
  return { ...report, output: reportFile, receipt: receiptFile };
}
