import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { buildDossier, writeDossier } from '../src/research/dossier.js';
import { initArtifact, sourceHash, type Artifact } from '../src/artifacts/project.js';
import { exportHtml, shareSlices } from '../src/artifacts/share.js';
import { renderHtml } from '../src/artifacts/render.js';
import { openBrowser } from '../src/media/browser.js';
import { researchFixture } from './helpers/research.js';

async function fixture(run: (root: string, project: string) => Promise<void>): Promise<void> {
  const root = await fs.mkdtemp(path.resolve('.aha-share-'));
  try {
    await writeDossier(path.join(root, 'research'), await buildDossier(researchFixture()));
    const project = path.join(root, 'project');
    await initArtifact(path.join(root, 'research'), 'html', project, 'bilingual');
    const metadata = path.join(project, 'artifact.json');
    const artifact = JSON.parse(await fs.readFile(metadata, 'utf8')) as Artifact;
    artifact.status = 'authored';
    artifact.width = 640;
    artifact.height = 480;
    artifact.coverage = [{ id: 'explanation', claimIds: ['c1'] }];
    await fs.writeFile(metadata, JSON.stringify(artifact));
    await fs.writeFile(path.join(project, artifact.entry), `<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0}
      section{height:1100px;background:linear-gradient(#fff,#ddd)}
      p{margin:0;height:500px} h1{margin:0}
      </style></head><body>
      <section id="explanation" data-aha-lang="en" data-aha-title="English snapshot">
      <p>FIRST ENGLISH PAGE</p><p>MIDDLE ENGLISH PAGE</p><h1>LAST ENGLISH PAGE</h1></section>
      <section data-aha-lang="zh" data-aha-title="中文快照">
      <p>第一页中文</p><p>中间页中文</p><h1>最后一页中文</h1></section>
      </body></html>`);
    await run(root, project);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}

test('sharing slices cover the exact page boundaries without gaps or an empty trailing page', () => {
  assert.deepEqual(shareSlices(960, 480), [{ y: 0, height: 480 }, { y: 480, height: 480 }]);
  assert.deepEqual(shareSlices(1100, 480), [{ y: 0, height: 480 }, { y: 480, height: 480 }, { y: 960, height: 140 }]);
  assert.deepEqual(shareSlices(1, 240), [{ y: 0, height: 1 }]);
  for (const height of [0, -1, 100001, 24001, NaN]) assert.throws(() => shareSlices(height, 240), { code: 'EXPORT_SIZE' });
  for (const pageHeight of [239, 4097, 240.5, NaN]) assert.throws(() => shareSlices(1000, pageHeight), { code: 'EXPORT_SIZE' });
});

test('sharing authorization, source format/language and existing paths fail before publication', async () => fixture(async (root, project) => {
  const destination = path.join(root, 'export');
  await assert.rejects(exportHtml(project, destination, false, { format: 'png' }), { code: 'CODE_AUTHORIZATION' });
  await assert.rejects(exportHtml(project, destination, true, { format: 'png', pageHeight: 0 }), { code: 'EXPORT_SIZE' });
  await assert.rejects(exportHtml(project, path.join(project, 'share'), true, { format: 'png' }), { code: 'OUTPUT_INSIDE_ARTIFACT' });
  await fs.mkdir(destination);
  await fs.writeFile(path.join(destination, 'keep.txt'), 'old delivery');
  await assert.rejects(exportHtml(project, destination, true, { format: 'pdf' }), { code: 'OUTPUT_EXISTS' });
  assert.equal(await fs.readFile(path.join(destination, 'keep.txt'), 'utf8'), 'old delivery');
  const file = path.join(project, 'artifact.json');
  const artifact = JSON.parse(await fs.readFile(file, 'utf8'));
  artifact.language = 'en';
  await fs.writeFile(file, JSON.stringify(artifact));
  await assert.rejects(exportHtml(project, path.join(root, 'wrong-language'), true, { format: 'png', language: 'zh' }), { code: 'ARTIFACT_LANGUAGE' });
  artifact.format = 'image';
  await fs.writeFile(file, JSON.stringify(artifact));
  await assert.rejects(exportHtml(project, path.join(root, 'wrong-format'), true, { format: 'pdf' }), { code: 'ARTIFACT_FORMAT' });
}));

test('offline bilingual PNG slices preserve language, dimensions, final page and revision identity', async () => fixture(async (root, project) => {
  const before = await sourceHash(project);
  const destination = path.join(root, 'png');
  await exportHtml(project, destination, true, { format: 'png', pageHeight: 480 });
  const receipt = JSON.parse(await fs.readFile(path.join(destination, 'receipt.json'), 'utf8'));
  assert.equal(receipt.sourceHash, before);
  assert.equal(await sourceHash(project), before);
  assert.equal(receipt.sourceFormat, 'html');
  assert.equal(receipt.purpose, 'html-sharing');
  assert.equal(receipt.runtimeLanguageControls, 'omitted');
  assert.match(receipt.interactions, /lost/);
  assert.deepEqual(receipt.languages, ['en', 'zh']);
  assert.equal(receipt.outputs.length, 6);
  for (const output of receipt.outputs) {
    const bytes = await fs.readFile(path.join(destination, output.file));
    assert.equal(bytes.readUInt32BE(16), 640);
    assert.equal(bytes.readUInt32BE(20), output.page === 3 ? 140 : 480);
    assert.equal(output.y, (output.page - 1) * 480);
    assert.equal(output.outputHash, createHash('sha256').update(bytes).digest('hex'));
  }
  assert.notDeepEqual(await fs.readFile(path.join(destination, 'en-001.png')), await fs.readFile(path.join(destination, 'zh-001.png')));
  await assert.rejects(exportHtml(project, destination, true, { format: 'png' }), { code: 'OUTPUT_EXISTS' });
  const chinese = path.join(root, 'chinese-only');
  await exportHtml(project, chinese, true, { format: 'png', language: 'zh', pageHeight: 480 });
  assert.deepEqual((await fs.readdir(chinese)).sort(), ['receipt.json', 'zh-001.png', 'zh-002.png', 'zh-003.png']);
}));

test('legacy single-source exports stay single-language and retain source bytes', async () => fixture(async (root, project) => {
  const file = path.join(project, 'artifact.json');
  const artifact = JSON.parse(await fs.readFile(file, 'utf8'));
  delete artifact.language;
  await fs.writeFile(file, JSON.stringify(artifact));
  const source = '<!doctype html><html><body><h1>Legacy reading copy</h1></body></html>';
  await fs.writeFile(path.join(project, artifact.entry), source);
  const destination = path.join(root, 'legacy');
  await exportHtml(project, destination, true, { format: 'pdf' });
  const receipt = JSON.parse(await fs.readFile(path.join(destination, 'receipt.json'), 'utf8'));
  assert.deepEqual(receipt.languages, ['en']);
  assert.deepEqual((await fs.readdir(destination)).sort(), ['en.pdf', 'receipt.json']);
  assert.equal(await fs.readFile(path.join(project, artifact.entry), 'utf8'), source);
}));

test('static sharing omits only packaged language controls while offline HTML keeps working switches', async () => fixture(async (root, project) => {
  const file = path.join(project, 'html', 'index.html');
  const source = (await fs.readFile(file, 'utf8'))
    .replace('FIRST ENGLISH PAGE', 'FIRST ENGLISH PAGE<button class="aha-language-controls">AUTHORED ACTION</button>')
    .replace('第一页中文', '第一页中文<button class="aha-language-controls">AUTHORED ACTION</button>');
  await fs.writeFile(file, source);
  const before = await sourceHash(project);
  const destination = path.join(root, 'static-pdf');
  await exportHtml(project, destination, true, { format: 'pdf', pageHeight: 480 });
  for (const language of ['en', 'zh']) {
    const pdf = path.join(destination, `${language}.pdf`);
    const extracted = spawnSync('pdftotext', ['-enc', 'UTF-8', '-layout', pdf, '-'], { encoding: 'utf8', windowsHide: true });
    if (!extracted.error) {
      assert.equal(extracted.status, 0, extracted.stderr);
      assert.doesNotMatch(extracted.stdout, /\bEnglish\b/, 'Nonfunctional runtime language buttons must not appear in static copies.');
      assert.match(extracted.stdout, /AUTHORED ACTION/, 'Authored controls must not be hidden just because they share a CSS class.');
      assert.match(extracted.stdout, language === 'en' ? /LAST ENGLISH PAGE/ : /最后一页中文/);
    }
  }
  const html = path.join(root, 'interactive.html');
  await renderHtml(project, html);
  const browser = await openBrowser();
  try {
    const context = await browser.newContext({ offline: true });
    const page = await context.newPage();
    await page.goto(pathToFileURL(html).href);
    const controls = page.locator('nav[data-aha-language-controls]');
    assert.equal(await controls.count(), 1);
    assert.equal(await controls.isVisible(), true);
    await controls.getByRole('button', { name: '中文', exact: true }).click();
    assert.equal(await page.title(), '中文快照');
    assert.equal(await page.locator('[data-aha-lang="zh"]').isVisible(), true);
    await controls.getByRole('button', { name: 'English', exact: true }).click();
    assert.equal(await page.title(), 'English snapshot');
    assert.equal(await page.locator('[data-aha-lang="en"]').isVisible(), true);
  } finally { await browser.close(); }
  assert.equal(await sourceHash(project), before);
}));

test('PNG sharing paints the content of every slice below the original iframe viewport', async () => fixture(async (root, project) => {
  const file = path.join(project, 'html', 'index.html');
  await fs.appendFile(file, '<style>section{background:linear-gradient(to bottom,#f00 0px 500px,#0f0 500px 1000px,#00f 1000px 1100px)}</style>');
  const browser = await openBrowser();
  try {
    const page = await browser.newPage();
    for (const pageHeight of [240, 480, 720, 1600]) {
      const destination = path.join(root, `painted-png-${pageHeight}`);
      await exportHtml(project, destination, true, { format: 'png', pageHeight });
      for (const language of ['en', 'zh']) {
        for (const [index, slice] of shareSlices(1100, pageHeight).entries()) {
          const bytes = await fs.readFile(path.join(destination, `${language}-${String(index + 1).padStart(3, '0')}.png`));
          assert.equal(bytes.readUInt32BE(16), 640);
          assert.equal(bytes.readUInt32BE(20), slice.height);
          const y = Math.min(slice.height - 1, 240);
          const position = slice.y + y;
          const color = position < 500 ? [255, 0, 0] : position < 1000 ? [0, 255, 0] : [0, 0, 255];
          const pixel = await page.evaluate(async ({ image, y }) => {
            const element = new Image();
            element.src = image;
            await element.decode();
            const canvas = document.createElement('canvas');
            canvas.width = element.width;
            canvas.height = element.height;
            const context = canvas.getContext('2d')!;
            context.drawImage(element, 0, 0);
            return [...context.getImageData(639, y, 1, 1).data].slice(0, 3);
          }, { image: `data:image/png;base64,${bytes.toString('base64')}`, y });
          assert.deepEqual(pixel, color, `${language} page ${index + 1} at ${pageHeight}px must contain its actual offscreen content, not a blank capture`);
        }
      }
    }
  } finally { await browser.close(); }
}));

test('bundled CLI publishes a selected-language sharing receipt and refuses reuse', async () => fixture(async (root, project) => {
  const destination = path.join(root, 'cli-share');
  const args = [
    path.resolve('dist', 'cli', 'aha.mjs'), 'export-html', project, destination,
    '--format', 'png', '--language', 'zh', '--page-height', '480', '--allow-code',
  ];
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 90_000, windowsHide: true });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.status, 'delivered');
  assert.deepEqual(receipt.languages, ['zh']);
  assert.equal(receipt.outputs.length, 3);
  assert.equal(receipt.sourceHash, await sourceHash(project));
  const repeated = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 90_000, windowsHide: true });
  assert.equal(repeated.status, 1, repeated.stderr);
  assert.equal(JSON.parse(repeated.stdout).error.code, 'OUTPUT_EXISTS');
}));

test('PDF export paginates the long HTML in both languages rather than the viewport only', async () => fixture(async (root, project) => {
  const destination = path.join(root, 'pdf');
  await exportHtml(project, destination, true, { format: 'pdf', pageHeight: 480 });
  for (const language of ['en', 'zh']) {
    const file = path.join(destination, `${language}.pdf`);
    const bytes = await fs.readFile(file);
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    assert.equal([...bytes.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length, 3);
    // Optional deeper local evidence; the core suite does not require Poppler.
    const extracted = spawnSync('pdftotext', ['-enc', 'UTF-8', '-layout', file, '-'], { encoding: 'utf8', windowsHide: true });
    if (!extracted.error) {
      assert.equal(extracted.status, 0, extracted.stderr);
      const pages = extracted.stdout.split('\f');
      assert.match(pages[0]!, language === 'en' ? /FIRST ENGLISH PAGE/ : /第一页中文/);
      assert.match(pages[1]!, language === 'en' ? /MIDDLE ENGLISH PAGE/ : /中间页中文/);
      assert.match(pages[2]!, language === 'en' ? /LAST ENGLISH PAGE/ : /最后一页中文/);
      assert.doesNotMatch(extracted.stdout, language === 'en' ? /最后一页中文/ : /LAST ENGLISH PAGE/);
    }
  }
  const source = path.join(project, 'html', 'index.html');
  await fs.writeFile(source, (await fs.readFile(source, 'utf8')).replace('height:1100px', 'height:960px').replace('height:500px', 'height:400px'));
  const exact = path.join(root, 'pdf-exact');
  await exportHtml(project, exact, true, { format: 'pdf', pageHeight: 480, language: 'en' });
  const bytes = await fs.readFile(path.join(exact, 'en.pdf'));
  assert.equal([...bytes.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length, 2, 'An exact page boundary must not add an empty PDF page.');
}));

test('network attempts and clipped layouts leave no sharing delivery or receipt', async () => fixture(async (root, project) => {
  const file = path.join(project, 'html', 'index.html');
  const original = await fs.readFile(file, 'utf8');
  for (const [suffix, expected] of [
    ['<script>fetch("https://example.invalid/no-export").catch(()=>{})</script>', 'ARTIFACT_BROWSER_ERROR'],
    ['<script>addEventListener("aha:languagechange",()=>fetch("https://example.invalid/no-switch").catch(()=>{}))</script>', 'ARTIFACT_BROWSER_ERROR'],
    ['<style>p{width:20px;white-space:nowrap;overflow:hidden}</style>', 'ARTIFACT_LAYOUT'],
    ['<style>body{width:900px}</style>', 'ARTIFACT_LAYOUT'],
    ['<style>section{height:200vh}</style>', 'EXPORT_REFLOW'],
  ]) {
    await fs.writeFile(file, original + suffix);
    const destination = path.join(root, `blocked-${expected}`);
    await assert.rejects(exportHtml(project, destination, true, { format: 'png' }), { code: expected });
    await assert.rejects(fs.stat(destination), { code: 'ENOENT' });
  }
}));
