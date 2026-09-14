import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import JSZip from 'jszip';
import { AhaError } from '../src/core/errors.js';
import { buildDossier, createResearchDraft, writeDossier } from '../src/research/dossier.js';
import { initArtifact, readArtifact, checkArtifact, sourceHash, type Format, type Artifact } from '../src/artifacts/project.js';
import { prepareHtml } from '../src/artifacts/html.js';
import { renderHtml, renderImage, renderPptx, runPptxWorker, checkBrowser } from '../src/artifacts/render.js';

const code = (value: string) => (error: unknown) => error instanceof AhaError && error.code === value;
async function fixture(run: (root: string, project: string) => Promise<void>, format: Format = 'html'): Promise<void> {
  const root = path.join(process.cwd(), `.artifacts-test-${randomUUID()}`);
  await fs.mkdir(root);
  try {
    const dossier = await buildDossier({
      ...createResearchDraft('When is the review?'),
      id: 'artifact-research', title: 'Monday review', status: 'complete',
      report: 'INERT_PRIVATE_RESEARCH_REPORT: the review is planned for Monday.',
      claims: [
        { id: 'c1', text: 'The review is planned for Monday.', evidenceIds: ['e1'], limitations: ['A plan is not completion.'] },
        { id: 'c2', text: 'Completion is not established.', evidenceIds: ['e1'], limitations: [] },
      ],
      evidence: [{ id: 'e1', kind: 'provided', title: 'Memo', locator: 'User memo', summary: 'Monday review planned.', sourceVersion: 'revision-1' }],
      subquestions: [{ id: 'q1', question: 'When is the review?', status: 'answered', claimIds: ['c1', 'c2'], gapIds: [] }],
      stopReason: 'The supplied memo answers the scoped question.',
    });
    await writeDossier(path.join(root, 'dossier'), dossier);
    const project = path.join(root, 'project');
    await initArtifact(path.join(root, 'dossier'), format, project);
    await run(root, project);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}

async function metadata(project: string, edit: (artifact: Artifact) => void): Promise<void> {
  const file = path.join(project, 'artifact.json');
  const artifact = JSON.parse(await fs.readFile(file, 'utf8')) as Artifact;
  edit(artifact);
  await fs.writeFile(file, JSON.stringify(artifact));
}

async function author(project: string, html = '<!doctype html><html><head><title>A free layout</title></head><body><article id="argument"><h1>Monday, not completion</h1><p>A memo is a plan, not a completion record.</p></article></body></html>'): Promise<void> {
  await metadata(project, artifact => {
    artifact.status = 'authored';
    artifact.coverage = [{ id: 'argument', claimIds: ['c1'] }];
    artifact.omissions = [{ claimId: 'c2', reason: 'The audience only requested the planned date.' }];
  });
  const { artifact } = await readArtifact(project);
  await fs.writeFile(path.join(project, artifact.entry), html);
}

test('draft source remains editable, but cannot pass readiness with only status changed', async () => fixture(async (_root, project) => {
  const { artifact } = await readArtifact(project);
  assert.equal(artifact.status, 'draft');
  await assert.rejects(checkArtifact(project), code('ARTIFACT_DRAFT'));
  await metadata(project, value => { value.status = 'authored'; });
  await assert.rejects(checkArtifact(project), code('ARTIFACT_DRAFT'));
}));

test('custom authored layout is packaged without execution or research leakage and has a revision receipt', async () => fixture(async (root, project) => {
  await author(project, '<!doctype html><main id="argument"><h1>One custom argument</h1><script>throw new Error("not executed during packaging");</script></main>');
  const checked = await checkArtifact(project) as { ready: boolean };
  assert.equal(checked.ready, true);
  const output = path.join(root, 'explanation.html');
  const receipt = await renderHtml(project, output) as { status: string; sourceHash: string; outputHash: string };
  assert.equal(receipt.status, 'delivered');
  const html = await fs.readFile(output, 'utf8');
  assert.match(html, /One custom argument/);
  assert.match(html, /--cp-panel-strong/);
  assert.match(html, /Segoe UI/);
  assert.match(html, /Content-Security-Policy/);
  assert.doesNotMatch(html, /INERT_PRIVATE_RESEARCH_REPORT/);
  assert.equal(receipt.outputHash, createHash('sha256').update(html).digest('hex'));
  assert.equal(receipt.sourceHash, await sourceHash(project));
  await fs.appendFile(path.join(project, 'html', 'index.html'), '\n<!-- revised -->');
  assert.notEqual(receipt.sourceHash, await sourceHash(project));
  assert.equal(JSON.parse(await fs.readFile(`${output}.receipt.json`, 'utf8')).sourceHash, receipt.sourceHash);
  await assert.rejects(renderHtml(project, output), code('OUTPUT_EXISTS'));
}));

test('every claim is mapped or explicitly omitted, with unique IDs and known references', async () => fixture(async (_root, project) => {
  await author(project);
  for (const [edit, expected] of [
    [(a: Artifact) => { a.coverage[0]!.claimIds = ['unknown']; }, 'COVERAGE_UNKNOWN'],
    [(a: Artifact) => { a.coverage.push({ ...a.coverage[0]! }); }, 'COVERAGE_DUPLICATE'],
    [(a: Artifact) => { a.omissions.push({ claimId: 'c1', reason: 'Both is invalid' }); }, 'COVERAGE_DUPLICATE'],
    [(a: Artifact) => { a.omissions = []; }, 'COVERAGE_MISSING'],
    [(a: Artifact) => { a.omissions[0]!.claimId = 'unknown'; }, 'COVERAGE_UNKNOWN'],
    [(a: Artifact) => { a.omissions[0]!.reason = ' '; }, 'SCHEMA_INVALID'],
  ] as const) {
    await author(project);
    await metadata(project, edit);
    await assert.rejects(checkArtifact(project), code(expected));
  }
}));

test('snapshot identity and entry confinement are checked before reading authored sources', async () => fixture(async (_root, project) => {
  await author(project);
  await metadata(project, a => { a.researchHash = '0'.repeat(64); });
  await assert.rejects(readArtifact(project), code('RESEARCH_MISMATCH'));
  for (const entry of ['../outside.html', 'html/../../outside.html', 'C:\\outside.html', '/outside.html', 'html/%2e%2e/x.html', 'research/report.md']) {
    await metadata(project, a => { a.entry = entry; });
    await assert.rejects(readArtifact(project), code('ARTIFACT_PATH'));
  }
}));

test('source identity excludes dist and qa but includes all source assets and metadata', async () => fixture(async (_root, project) => {
  await author(project);
  const original = await sourceHash(project);
  await fs.mkdir(path.join(project, 'qa'));
  await fs.writeFile(path.join(project, 'qa', 'capture.png'), 'not part of authoring');
  await fs.mkdir(path.join(project, 'dist'));
  await fs.writeFile(path.join(project, 'dist', 'output.html'), 'not part of authoring');
  assert.equal(original, await sourceHash(project));
  await fs.mkdir(path.join(project, 'assets'));
  await fs.writeFile(path.join(project, 'assets', 'notes.txt'), 'authored source');
  assert.notEqual(original, await sourceHash(project));
}));

test('stylesheets, scripts and images are inlined with source-text injection handled safely', async () => fixture(async (_root, project) => {
  await author(project, '<!doctype html><head><link rel="stylesheet" href="../assets/style.css"><script src="../assets/logic.js"></script></head><body><img src="../assets/pixel.png"><h1>Free layout</h1></body>');
  await fs.mkdir(path.join(project, 'assets'));
  await fs.writeFile(path.join(project, 'assets', 'style.css'), 'body { background-image: url("pixel.png"); color: var(--cp-text); }');
  await fs.writeFile(path.join(project, 'assets', 'logic.js'), 'window.example = "</script><img src=https://invalid.example/hidden>";');
  await fs.writeFile(path.join(project, 'assets', 'pixel.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64'));
  const html = await prepareHtml(project);
  assert.match(html, /data:image\/png;base64/);
  assert.doesNotMatch(html, /<script src/);
  assert.match(html, /<\\\/script>/);
  assert.doesNotMatch(html, /<link rel="stylesheet"/);
}));

test('offline parser rejects remote, hidden, missing and unsupported resource contexts without execution', async () => fixture(async (_root, project) => {
  const cases = [
    '<img src="https://invalid.example/a.png">',
    '<img src="//invalid.example/a.png">',
    '<img src="missing.png">',
    '<img src="../../../outside.png">',
    '<img src="%2e%2e/escape.png">',
    '<img srcset="https://invalid.example/a.png 1x">',
    '<iframe srcdoc="<script>fetch(1)</script>"></iframe>',
    '<base href="https://invalid.example/">',
    '<link rel="preconnect" href="https://invalid.example/">',
    '<meta http-equiv="refresh" content="0;https://invalid.example/">',
    '<style>@import "https://invalid.example/hidden.css";</style>',
    '<style>body { background: u\\72l(https://invalid.example/a); }</style>',
    '<style>body { background: image-set("https://invalid.example/a" 1x); }</style>',
    '<svg><image href="https://invalid.example/a.svg"></image></svg>',
    '<svg><set attributeName="href" to="https://invalid.example/a"></set></svg>',
    '<script type="module">import "https://invalid.example/code.js"</script>',
    '<form action="https://invalid.example/send"></form>',
  ];
  for (const source of cases) {
    await author(project, `<!doctype html><html><head></head><body>${source}</body></html>`);
    await assert.rejects(prepareHtml(project), error => error instanceof AhaError);
  }
}));

test('output paths stay outside sources, use correct extensions and never overwrite', async () => fixture(async (root, project) => {
  await author(project);
  await assert.rejects(renderHtml(project, path.join(project, 'dist', 'output.html')), code('OUTPUT_INSIDE_ARTIFACT'));
  await assert.rejects(renderHtml(project, path.join(root, 'wrong.png')), code('OUTPUT_EXTENSION'));
  await fs.writeFile(path.join(root, 'existing.html.receipt.json'), 'reserved');
  await assert.rejects(renderHtml(project, path.join(root, 'existing.html')), code('OUTPUT_EXISTS'));
}));

test('ancestor links and hard-linked source files are rejected', async context => fixture(async (root, project) => {
  await author(project);
  const alias = path.join(root, 'alias');
  try { await fs.symlink(project, alias, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) {
    if (['EPERM', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) { context.skip('Symlink creation unavailable'); return; }
    throw error;
  }
  await assert.rejects(readArtifact(alias), code('ARTIFACT_LINK'));
  await fs.link(path.join(project, 'html', 'index.html'), path.join(project, 'linked.html'));
  await assert.rejects(readArtifact(project), code('ARTIFACT_FILE'));
}));

test('source project enforces bounded resource size', async () => fixture(async (_root, project) => {
  await author(project);
  const handle = await fs.open(path.join(project, 'oversized.bin'), 'w');
  await handle.truncate(16 * 1024 * 1024 + 1);
  await handle.close();
  await assert.rejects(sourceHash(project), code('ARTIFACT_SIZE'));
}));

test('authored browser and native Node rendering require explicit authorization', async () => {
  await assert.rejects(renderImage('not-read', 'image.png', false), code('CODE_AUTHORIZATION'));
  await assert.rejects(renderPptx('not-read', 'deck.pptx', false), code('CODE_AUTHORIZATION'));
  await assert.rejects(checkBrowser('not-read', false), code('CODE_AUTHORIZATION'));
});

test('native PPTX authors can create more than twelve slides without imports or a fixed layout DSL', async () => fixture(async (root, project) => {
  await author(project, `export default async function({pptx, research}) {
    for (let i=0; i<18; i++) {
      const slide = pptx.addSlide();
      slide.addText(research.title + ' ' + i, {x:1,y:1,w:10,h:1,fontSize:28});
      slide.addShape(pptx.ShapeType.rect, {x:1,y:3,w:3,h:1,fill:{color:'B11F4B'}});
    }
  }`);
  const output = path.join(root, 'native.pptx');
  await runPptxWorker(project, output);
  const zip = await JSZip.loadAsync(await fs.readFile(output));
  assert.equal(Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length, 18);
  assert.match(await zip.file('ppt/slides/slide1.xml')!.async('string'), /Monday review/);
  assert.match(await zip.file('ppt/slides/slide1.xml')!.async('string'), /<p:sp>/);
}, 'pptx'));

test('video scaffold declares deterministic frame interface but is not a ready deliverable', async () => fixture(async (_root, project) => {
  const { artifact } = await readArtifact(project);
  const html = await fs.readFile(path.join(project, artifact.entry), 'utf8');
  assert.match(html, /window\.ahaVideo/);
  assert.match(html, /segmentFrame \/ \(segmentFrames - 1\)/);
  await assert.rejects(checkArtifact(project), code('ARTIFACT_DRAFT'));
}, 'video'));

test('authorized PPTX worker renders a snapshot and never labels an edited source as current', async () => fixture(async (root, project) => {
  await author(project, `export default async function({pptx}) {
    for (let i=0;i<15;i++) pptx.addSlide().addText('Native authored slide '+i,{x:1,y:1,w:9,h:1});
  }`);
  const output = path.join(root, 'authored.pptx');
  const receipt = await renderPptx(project, output, true) as { slides: number; sourceHash: string };
  assert.equal(receipt.slides, 15);
  assert.equal(receipt.sourceHash, await sourceHash(project));
  await assert.rejects(renderPptx(project, output, true), code('OUTPUT_EXISTS'));
  const source = path.join(project, 'pptx', 'main.mjs');
  await author(project, `import {appendFile} from 'node:fs/promises';
  export default async function({pptx}) {
    pptx.addSlide().addText('A changed source must not get a receipt',{x:1,y:1,w:9,h:1});
    await appendFile(${JSON.stringify(source)}, '\\n// changed during render');
  }`);
  const stale = path.join(root, 'stale.pptx');
  await assert.rejects(renderPptx(project, stale, true), code('ARTIFACT_CHANGED'));
  await assert.rejects(fs.access(stale));
  await assert.rejects(fs.access(`${stale}.receipt.json`));
}, 'pptx'));

test('native renderer refuses screenshot-only slides and mislabeled non-PowerPoint output', async () => fixture(async (root, project) => {
  await author(project, `export default async function({pptx}) {
    pptx.addSlide().addImage({data:'image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=',x:0,y:0,w:10,h:5});
  }`);
  await assert.rejects(renderPptx(project, path.join(root, 'screenshots.pptx'), true), code('PPTX_NATIVE'));
  await author(project, `export default async function({pptx}) {
    pptx.write = async () => Buffer.from('this is not a PowerPoint file');
  }`);
  await assert.rejects(renderPptx(project, path.join(root, 'fake.pptx'), true), code('PPTX_OUTPUT'));
}, 'pptx'));
