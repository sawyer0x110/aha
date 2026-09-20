import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { createRequire } from 'node:module';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import { AhaError } from '../src/core/errors.js';
import { validatePptx } from '../src/artifacts/pptx-validation.js';
import { renderPptx } from '../src/artifacts/render.js';
import { initArtifact, readArtifact } from '../src/artifacts/project.js';
import { buildDossier, createResearchDraft, writeDossier } from '../src/research/dossier.js';

const execute = promisify(execFile);
const Pptx = ('default' in PptxGenJS ? PptxGenJS.default : PptxGenJS) as unknown as new () => import('pptxgenjs').default;
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const png = 'image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const wav = 'audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
const code = (expected: string) => (error: unknown) => error instanceof AhaError && error.code === expected;

function shape(id = '2', name = 'Text 1', extra = ''): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="-10" y="0"/><a:ext cx="100" cy="0"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${extra}</p:spPr></p:sp>`;
}
function slide(objects = shape(), extra = ''): string {
  return `<p:sld xmlns:p="${P}" xmlns:a="${A}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${objects}</p:spTree></p:cSld>${extra}</p:sld>`;
}
async function packageWith(xml: string, edit?: (zip: JSZip) => void): Promise<Buffer> {
  const pptx = new Pptx();
  pptx.addSlide().addText('Native fixture', { x: 1, y: 1, w: 3, h: 1 });
  const zip = await JSZip.loadAsync(await pptx.write({ outputType: 'nodebuffer' }) as Buffer);
  zip.file('ppt/slides/slide1.xml', xml);
  edit?.(zip);
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function workdir(run: (root: string) => Promise<void>): Promise<void> {
  const root = path.join(process.cwd(), `.pptx-runtime-test-${randomUUID()}`);
  await fs.mkdir(root);
  try { await run(root); }
  finally { await fs.rm(root, { recursive: true, force: true }); }
}
async function projectFixture(root: string, source: string): Promise<string> {
  const dossier = await buildDossier({
    ...createResearchDraft('What is planned?'),
    id: 'pptx-runtime', title: 'Review plan', status: 'complete', report: 'The review is planned.',
    claims: [{ id: 'c1', text: 'Review planned.', evidenceIds: ['e1'], limitations: [] }],
    evidence: [{ id: 'e1', kind: 'provided', title: 'Memo', locator: 'User memo', summary: 'Review planned.', sourceVersion: 'v1' }],
    subquestions: [{ id: 'q1', question: 'What is planned?', status: 'answered', claimIds: ['c1'], gapIds: [] }],
    stopReason: 'Supplied memo answers the question.',
  });
  await writeDossier(path.join(root, 'dossier'), dossier);
  const project = path.join(root, 'project');
  await initArtifact(path.join(root, 'dossier'), 'pptx', project, 'en');
  const { artifact } = await readArtifact(project);
  artifact.status = 'authored';
  artifact.coverage = [{ id: 'argument', claimIds: ['c1'] }];
  await fs.writeFile(path.join(project, 'artifact.json'), JSON.stringify(artifact));
  await fs.writeFile(path.join(project, ...artifact.entry.split('/')), source);
  return project;
}

test('ESM and CJS producers allocate mixed native objects across slides without collisions', async () => {
  const CommonJS = createRequire(import.meta.url)('pptxgenjs') as typeof Pptx;
  for (const Constructor of [Pptx, CommonJS]) {
    const pptx = new Constructor();
    for (let i = 0; i < 6; i++) {
      const s = pptx.addSlide();
      s.addText('Title', { x: 1, y: 0.2, w: 4, h: 0.4, objectName: 'Title' });
      s.addTable([[{ text: 'A' }, { text: 'B' }]], { x: 1, y: 1, w: 3, h: 0.5, valign: 'middle', objectName: 'Table A' });
      s.addText('Takeaway', { x: 1, y: 2, w: 4, h: 0.4 });
      s.addTable([[{ text: 'C' }, { text: 'D' }]], { x: 1, y: 3, w: 3, h: 0.5, objectName: 'Table B' });
      s.addMedia({ type: 'audio', data: wav, cover: png, x: 6, y: 1, w: 1, h: 1 });
      s.addImage({ data: png, x: 7, y: 1, w: 1, h: 1 });
      s.addMedia({ type: 'audio', data: wav, cover: png, x: 6, y: 2, w: 1, h: 1 });
      s.addChart(pptx.ChartType.bar, [{ name: 'series', labels: ['A', 'B'], values: [1, 2] }], { x: 6, y: 3, w: 2, h: 1 });
      for (let n = 0; n < 26; n++) s.addShape(pptx.ShapeType.rect, { x: n / 4, y: 4, w: 0.1, h: 0.1 });
      s.slideNumber = { x: 9, y: 5, w: 0.3, h: 0.3 };
      s.addNotes('Notes have their own nonvisual ID scope.');
    }
    const bytes = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
    assert.equal(await validatePptx(bytes), 6);
    const zip = await JSZip.loadAsync(bytes);
    for (let i = 1; i <= 6; i++) {
      const xml = await zip.file(`ppt/slides/slide${i}.xml`)!.async('string');
      const ids = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map(match => match[1]);
      assert.equal(ids.length, new Set(ids).size);
      assert.match(xml, /<p:cNvPr id="2" name="Title"/);
      for (const pic of xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)) {
        if (!pic[0].includes('<a:videoFile')) continue;
        const id = /<p:cNvPr id="(\d+)"/.exec(pic[0])![1];
        assert.ok(pic[0].includes(`<a:blip r:embed="rId${id}"`), 'media object and preview relationship ID must stay paired');
        assert.ok((await zip.file(`ppt/slides/_rels/slide${i}.xml.rels`)!.async('string')).includes(`Id="rId${id}"`));
      }
    }
  }
});

test('valid groups, numeric entities, strict/alternate prefixes, connectors and timing are not rewritten', async () => {
  const connector = '<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="5" name="Connector"/><p:cNvCxnSpPr><a:stCxn id="2" idx="0"/><a:endCxn id="4" idx="1"/></p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr><p:spPr/></p:cxnSp>';
  const group = `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="3" name="Group"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shape('4', 'Grouped')}</p:grpSp>`;
  const timing = '<p:timing><p:tnLst><p:par><p:cTn id="2"><p:childTnLst><p:set><p:cBhvr><p:cTn id="3"/><p:tgtEl><p:spTgt spid="2"/></p:tgtEl></p:cBhvr></p:set></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>';
  const original = slide(shape('&#50;', 'Text &amp; quoted') + group + connector, timing);
  for (const xml of [
    original,
    original.replace(/(<\/?)p:/g, '$1s:').replace('xmlns:p=', 'xmlns:s=').replace(/(<\/?)a:/g, '$1d:').replace('xmlns:a=', 'xmlns:d='),
    original.replaceAll(P, 'http://purl.oclc.org/ooxml/presentationml/main').replaceAll(A, 'http://purl.oclc.org/ooxml/drawingml/main'),
  ]) {
    const bytes = await packageWith(xml);
    const before = Buffer.from(bytes);
    assert.equal(await validatePptx(bytes), 1);
    assert.deepEqual(bytes, before);
  }
});

test('duplicates include root/group IDs, entity-equivalent IDs and exact object locators', async () => {
  for (const objects of [
    shape('2', 'First') + shape('&#x32;', 'Second &amp; named'),
    shape('1', 'Root collision'),
    shape('2', 'First') + `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="3" name="Group"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shape('02', 'Nested')}</p:grpSp>`,
  ]) {
    await assert.rejects(validatePptx(await packageWith(slide(objects))), error => {
      assert.ok(error instanceof AhaError);
      assert.equal(error.code, 'PPTX_DUPLICATE_ID');
      assert.match(error.path, /ppt\/slides\/slide1\.xml\/p:sld\[1\]\/p:cSld\[1\]\/p:spTree\[1\].*\/p:cNvPr\[1\].*object/);
      assert.match(error.message, /first occurrence: .*object/);
      return true;
    });
  }
});

test('invalid anchors and extents are rejected with shape/table and property locations', async () => {
  for (const [extra, expected, property] of [
    ['<a:bodyPr anchor="m&#105;d"/>', 'PPTX_ANCHOR', 'a:bodyPr'],
    ['<a:tcPr anchor="mid"/>', 'PPTX_ANCHOR', 'a:tcPr'],
    ['<a:xfrm><a:ext cx="-1" cy="10"/></a:xfrm>', 'PPTX_EXTENT', 'a:ext'],
    ['<a:xfrm><a:chExt cx="1" cy="&#45;2"/></a:xfrm>', 'PPTX_EXTENT', 'a:chExt'],
  ]) {
    const xml = slide(shape('2', 'Bad object', extra));
    await assert.rejects(validatePptx(await packageWith(xml)), error => {
      assert.ok(error instanceof AhaError);
      assert.equal(error.code, expected);
      assert.ok(error.path.includes(property!));
      assert.match(error.path, /object "Bad object", id=2/);
      return true;
    });
  }
  for (const anchor of ['t', 'ctr', 'b', 'just', 'dist']) {
    assert.equal(await validatePptx(await packageWith(slide(shape('2', 'Valid', `<a:tcPr anchor="${anchor}"/><a:extLst><a:ext uri="extension"/></a:extLst>`)))), 1);
  }
});

test('namespace lookalikes, malformed XML, DTDs and unsupported alternate shape branches fail closed', async () => {
  for (const [xml, expected] of [
    [slide().replaceAll(P, 'urn:wrong'), 'PPTX_OUTPUT'],
    [slide().replace('</p:sld>', ''), 'PPTX_XML'],
    [`<!DOCTYPE p:sld [<!ENTITY id "2">]>${slide(shape('&id;'))}`, 'PPTX_XML'],
    [slide(`<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">${shape()}</mc:AlternateContent>`), 'PPTX_UNSUPPORTED'],
  ]) await assert.rejects(validatePptx(await packageWith(xml!)), code(expected!));
});

test('external relationships, native/type/ZIP/path/entry/expanded-size protections remain enforced', async () => {
  const rel = (type: string) => `<r:Relationships xmlns:r="http://schemas.openxmlformats.org/package/2006/relationships"><r:Relationship Id="rId99" Target="https://example.test" TargetMode="Exter&#110;al" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}"/></r:Relationships>`;
  await assert.rejects(validatePptx(await packageWith(slide(), zip => zip.file('ppt/slides/_rels/slide1.xml.rels', rel('image')))), code('PPTX_EXTERNAL'));
  assert.equal(await validatePptx(await packageWith(slide(), zip => zip.file('ppt/slides/_rels/slide1.xml.rels', rel('hyperlink')))), 1);
  await assert.rejects(validatePptx(Buffer.from('not a zip')), code('PPTX_OUTPUT'));
  await assert.rejects(validatePptx(await packageWith(slide(), zip => zip.remove('ppt/presentation.xml'))), code('PPTX_OUTPUT'));
  await assert.rejects(validatePptx(await packageWith(slide(), zip => zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/wrong.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>'))), code('PPTX_OUTPUT'));
  await assert.rejects(validatePptx(await packageWith(slide(), zip => zip.remove('ppt/slides/slide1.xml'))), code('PPTX_EMPTY'));
  await assert.rejects(validatePptx(await packageWith(slide(''))), code('PPTX_NATIVE'));
  await assert.rejects(validatePptx(await packageWith(slide(), zip => zip.file('../unsafe.xml', 'unsafe'))), code('PPTX_OUTPUT'));
  await assert.rejects(validatePptx(await packageWith(slide(), zip => {
    for (let i = 0; i < 10001; i++) zip.file(`extra${i}`, '');
  })), code('PPTX_SIZE'));
  const oversized = await packageWith(slide());
  // Set one central-directory expanded-size field; rejection must precede inflation.
  let central = oversized.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  assert.ok(central > 0);
  while (oversized.toString('utf8', central + 46, central + 46 + oversized.readUInt16LE(central + 28)) !== '[Content_Types].xml') {
    central += 46 + oversized.readUInt16LE(central + 28) + oversized.readUInt16LE(central + 30) + oversized.readUInt16LE(central + 32);
    assert.equal(oversized.readUInt32LE(central), 0x02014b50);
  }
  oversized.writeUInt32LE(128 * 1024 * 1024 + 1, central + 24);
  await assert.rejects(validatePptx(oversized), code('PPTX_SIZE'));
});

test('bundled renderer delivers mixed tables on six slides and rejects invalid output without receipt or leftovers', async () => workdir(async root => {
  const valid = `export default ({pptx}) => {
    for (let i=0;i<6;i++) {
      const s=pptx.addSlide();
      s.addText('Title',{x:1,y:0.2,w:4,h:0.5});
      s.addTable([['A','B']],{x:1,y:1,w:3,h:0.5,valign:'middle'});
      s.addText('Takeaway',{x:1,y:2,w:4,h:0.5});
      s.addTable([['C','D']],{x:1,y:3,w:3,h:0.5});
      for(let j=0;j<25;j++) s.addShape(pptx.ShapeType.rect,{x:j/4,y:4,w:0.1,h:0.1});
      s.slideNumber={x:9,y:5,w:0.3,h:0.3};
    }
  };`;
  const project = await projectFixture(root, valid);
  const output = path.join(root, 'valid.pptx');
  assert.equal((await renderPptx(project, output, true) as { slides: number }).slides, 6);
  assert.equal(await validatePptx(await fs.readFile(output)), 6);
  await fs.access(`${output}.receipt.json`);
  const duplicate = await packageWith(slide(shape('2', 'First') + shape('2', 'Second')));
  for (const [name, source, expected] of [
    ['anchor', `export default ({pptx})=>pptx.addSlide().addTable([['Bad']],{x:1,y:1,w:3,h:1,valign:'mid'});`, 'PPTX_ANCHOR'],
    ['extent', `export default ({pptx})=>pptx.addSlide().addShape(pptx.ShapeType.line,{x:4,y:2,w:-2,h:-1});`, 'PPTX_EXTENT'],
    ['duplicate', `export default ({pptx})=>{pptx.write=async()=>Buffer.from('${duplicate.toString('base64')}','base64');};`, 'PPTX_DUPLICATE_ID'],
  ]) {
    await fs.writeFile(path.join(project, 'pptx', 'main.mjs'), source!);
    const invalid = path.join(root, `${name}.pptx`);
    await assert.rejects(renderPptx(project, invalid, true), error => {
      assert.ok(error instanceof AhaError);
      assert.equal(error.code, expected);
      assert.match(error.path, /ppt\/slides\/slide1\.xml.*object/);
      if (name === 'anchor') assert.match(error.path, /a:tr\[1\]\/a:tc\[1\]\/a:tcPr\[1\]/);
      return true;
    });
    await assert.rejects(fs.access(invalid));
    await assert.rejects(fs.access(`${invalid}.receipt.json`));
    assert.ok(!(await fs.readdir(root)).some(name => name.startsWith('.aha-pptx-')));
  }
}));

test('persistent producer patch is idempotent and refuses changed source/version', async () => workdir(async root => {
  const script = path.join(root, 'scripts', 'patch-pptxgenjs.mjs');
  const dependency = path.join(root, 'node_modules', 'pptxgenjs');
  await fs.mkdir(path.dirname(script), { recursive: true });
  await fs.mkdir(path.join(dependency, 'dist'), { recursive: true });
  await fs.copyFile(path.join('scripts', 'patch-pptxgenjs.mjs'), script);
  for (const file of ['package.json', path.join('dist', 'pptxgen.cjs.js'), path.join('dist', 'pptxgen.es.js')]) {
    await fs.copyFile(path.join('node_modules', 'pptxgenjs', file), path.join(dependency, file));
  }
  await execute(process.execPath, [script]);
  await execute(process.execPath, [script]);
  await fs.appendFile(path.join(dependency, 'dist', 'pptxgen.cjs.js'), '\n// unexpected source change');
  await assert.rejects(execute(process.execPath, [script]), /Unrecognized PptxGenJS source/);
  await fs.writeFile(path.join(dependency, 'package.json'), '{"version":"4.0.2"}');
  await assert.rejects(execute(process.execPath, [script]), /Review the PptxGenJS object-ID patch/);
}));
