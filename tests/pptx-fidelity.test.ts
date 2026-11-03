import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import { AhaError } from '../src/core/errors.js';
import { comparePptx, inventoryPptx, readPptx } from '../src/artifacts/pptx-fidelity.js';

const execute = promisify(execFile);
const Pptx = ('default' in PptxGenJS ? PptxGenJS.default : PptxGenJS) as unknown as new () => import('pptxgenjs').default;
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const code = (expected: string) => (error: unknown) => error instanceof AhaError && error.code === expected;

async function fixture(options: { title?: string; caveat?: string; value?: number; category?: string; chartTitle?: string; notes?: string; merge?: boolean } = {}): Promise<Buffer> {
  const pptx = new Pptx();
  const slide = pptx.addSlide();
  if (options.title !== '') slide.addText(options.title ?? 'Revenue & scope', { x: 1, y: 0.3, w: 5, h: 0.5 });
  slide.addText(options.caveat ?? 'Only for sampled users; not a forecast.', { x: 1, y: 1, w: 6, h: 0.5 });
  slide.addTable([
    options.merge ? [{ text: 'Region', options: { colspan: 2 } }] : [{ text: 'Region' }, { text: 'Revenue' }],
    [{ text: 'West' }, { text: '10 USD' }],
  ], { x: 1, y: 2, w: 5, h: 1 });
  slide.addChart(pptx.ChartType.bar, [{ name: 'Revenue', labels: [options.category ?? 'West'], values: [options.value ?? 10] }],
    { x: 1, y: 3, w: 5, h: 2, showTitle: true, title: options.chartTitle ?? 'Sample revenue (USD)' });
  slide.addNotes(options.notes ?? 'Speaker-only derivation.');
  return await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
}
async function mutate(bytes: Buffer, run: (zip: JSZip) => Promise<void> | void): Promise<Buffer> {
  const zip = await JSZip.loadAsync(bytes);
  await run(zip);
  return zip.generateAsync({ type: 'nodebuffer' });
}
async function withoutChart(bytes: Buffer): Promise<Buffer> {
  return mutate(bytes, async zip => {
    const part = 'ppt/slides/slide1.xml';
    zip.file(part, (await zip.file(part)!.async('string')).replace(/<p:graphicFrame>[^]*?<\/p:graphicFrame>/g, frame => frame.includes('<c:chart') ? '' : frame));
  });
}

test('identical OOXML retains full text, qualifiers, chart caches, cells and separate notes without executing anything', async () => {
  const bytes = await fixture();
  const original = Buffer.from(bytes);
  const report = await comparePptx(bytes, bytes);
  assert.equal(report.changes.length, 0);
  assert.equal(report.codeExecuted, false);
  assert.equal(report.externalTruthVerified, false);
  assert.equal(report.visualReviewPerformed, false);
  assert.ok(report.before.items.some(item => item.kind === 'text' && item.channel === 'slide' && item.value === 'Only for sampled users; not a forecast.'));
  assert.ok(report.before.items.some(item => item.kind === 'text' && item.channel === 'notes' && item.value === 'Speaker-only derivation.'));
  for (const [kind, value] of [['table-cell', '10 USD'], ['chart-category', 'West'], ['chart-value', '10'], ['chart-title', 'Sample revenue (USD)']]) {
    assert.ok(report.before.items.some(item => item.kind === kind && item.value === value), `${kind}: ${value}`);
  }
  assert.deepEqual(bytes, original);
  assert.match(report.scope, /not fact verification/);
  assert.ok(report.before.diagnostics.some(item => /workbook/.test(item.message)));
  assert.equal(report.status, 'review-required', 'unsupported workbook reconciliation remains explicit even for identical files');
});

test('title deletion, changed chart title/category/value and dropped qualification are reported despite remaining native objects', async () => {
  const before = await fixture();
  for (const [options, kind, value] of [
    [{ title: '' }, 'text', 'Revenue & scope'],
    [{ chartTitle: 'New title' }, 'chart-title', 'Sample revenue (USD)'],
    [{ category: 'East' }, 'chart-category', 'West'],
    [{ value: 100 }, 'chart-value', '10'],
    [{ caveat: 'For sampled users; a forecast.' }, 'text', 'Only for sampled users; not a forecast.'],
  ] as const) {
    const report = await comparePptx(before, await fixture(options));
    assert.equal(report.status, 'review-required');
    assert.ok(report.changes.some(change => change.before?.kind === kind && change.before.value === value), JSON.stringify(options));
  }
});

test('merged table regions and changed cell values cannot be masked by unchanged text elsewhere', async () => {
  const before = await fixture();
  const merged = await comparePptx(before, await fixture({ merge: true }));
  assert.ok(merged.changes.some(change => change.before?.kind === 'table-structure'));
  assert.ok(merged.changes.some(change => change.before?.kind === 'table-cell' && change.before.value === 'Revenue' && change.after?.value !== 'Revenue'));
  const changed = await mutate(before, async zip => {
    const part = 'ppt/slides/slide1.xml';
    zip.file(part, (await zip.file(part)!.async('string')).replace('10 USD', '100 USD'));
  });
  const report = await comparePptx(before, changed);
  assert.ok(report.changes.some(change => change.before?.kind === 'table-cell' && change.before.value === '10 USD' && change.after?.value === '100 USD'));
});

test('a numeric cache change is paired with its exact old/new value at the same chart location', async () => {
  const before = await fixture();
  const after = await mutate(before, async zip => {
    const part = zip.file(/^ppt\/charts\/chart\d+\.xml$/)[0]!.name;
    const original = await zip.file(part)!.async('string');
    const edited = original.replace('<c:v>10</c:v>', '<c:v>100</c:v>');
    assert.notEqual(edited, original);
    zip.file(part, edited);
  });
  const report = await comparePptx(before, after);
  assert.equal(report.changes.length, 1);
  assert.equal(report.changes[0]!.kind, 'changed');
  assert.equal(report.changes[0]!.before?.kind, 'chart-value');
  assert.equal(report.changes[0]!.before?.value, '10');
  assert.equal(report.changes[0]!.after?.value, '100');
  assert.match(report.changes[0]!.before!.locator, /^ppt\/charts\/chart\d+\.xml\/c:chartSpace\[1\]/);
  assert.match(report.changes[0]!.before!.reference!, /^ppt\/slides\/slide1\.xml\/p:sld\[1\]/);
});

test('moving an important qualifier into notes never satisfies slide retention', async () => {
  const before = await fixture();
  const after = await fixture({ caveat: 'A forecast.', notes: 'Only for sampled users; not a forecast.' });
  const report = await comparePptx(before, after);
  assert.ok(report.changes.some(change => change.before?.channel === 'slide' && change.before.value.includes('Only for sampled')));
  assert.ok(report.changes.some(change => change.after?.channel === 'notes' && change.after.value.includes('Only for sampled')));
});

test('explicit intentional changes preserve differences and reasons; stale, broad and duplicate acceptances fail', async () => {
  const before = await withoutChart(await fixture());
  const after = await withoutChart(await fixture({ title: '' }));
  const first = await comparePptx(before, after);
  const changes = first.changes.map(change => ({ id: change.id, reason: 'Approved title removal and text reflow.' }));
  const accepted = await comparePptx(before, after, { changes });
  assert.equal(accepted.status, 'compared');
  assert.equal(accepted.changes.length, first.changes.length);
  assert.ok(accepted.changes.every(change => change.accepted && change.reason.length));
  await assert.rejects(comparePptx(before, after, { changes: [{ id: '*', reason: 'All' }] }), code('PPTX_ACCEPTANCE'));
  await assert.rejects(comparePptx(before, before, { changes }), code('PPTX_ACCEPTANCE'));
  await assert.rejects(comparePptx(before, after, { changes: [changes[0], changes[0]] }), code('PPTX_ACCEPTANCE'));
  await assert.rejects(comparePptx(before, after, { changes: [{ id: changes[0]!.id, reason: ' ' }] }), code('PPTX_ACCEPTANCE'));
  await assert.rejects(comparePptx(before, after, { changes, ignoreNotes: true }), code('PPTX_ACCEPTANCE'));
});

test('slide order follows presentation relationships, not slide filenames', async () => {
  const pptx = new Pptx();
  pptx.addSlide().addText('First', { x: 1, y: 1, w: 2, h: 1 });
  pptx.addSlide().addText('Second', { x: 1, y: 1, w: 2, h: 1 });
  const before = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
  const after = await mutate(before, async zip => {
    const part = 'ppt/presentation.xml';
    const xml = await zip.file(part)!.async('string');
    const ids = [...xml.matchAll(/<p:sldId [^>]+\/>/g)].map(match => match[0]);
    zip.file(part, xml.replace(ids.join(''), ids.reverse().join('')));
  });
  const inventory = await inventoryPptx(after);
  assert.ok(inventory.items.some(item => item.slide === 1 && item.value === 'Second'));
  assert.ok((await comparePptx(before, after)).changes.length > 0);
});

test('namespace aliases, strict OOXML, split runs, entities and line breaks are extracted rather than regex-guessed', async () => {
  const bytes = await withoutChart(await fixture());
  const aliased = await mutate(bytes, async zip => {
    const part = 'ppt/slides/slide1.xml';
    let xml = await zip.file(part)!.async('string');
    xml = xml.replace('Revenue &amp; scope', 'Revenue &#38; scope')
      .replace(/(<\/?)p:/g, '$1s:').replace('xmlns:p=', 'xmlns:s=')
      .replace(/(<\/?)a:/g, '$1d:').replace('xmlns:a=', 'xmlns:d=')
      .replaceAll(P, 'http://purl.oclc.org/ooxml/presentationml/main').replaceAll(A, 'http://purl.oclc.org/ooxml/drawingml/main');
    zip.file(part, xml);
  });
  assert.equal((await comparePptx(bytes, aliased)).changes.length, 0);
  const runs = await mutate(bytes, async zip => {
    const part = 'ppt/slides/slide1.xml';
    zip.file(part, (await zip.file(part)!.async('string')).replace('<a:t>Revenue &amp; scope</a:t>', '<a:t>Revenue </a:t></a:r><a:r><a:t>&amp; scope</a:t>'));
  });
  assert.equal((await comparePptx(bytes, runs)).changes.length, 0);
  const breaks = await mutate(bytes, async zip => {
    const part = 'ppt/slides/slide1.xml';
    zip.file(part, (await zip.file(part)!.async('string')).replace('<a:t>Revenue &amp; scope</a:t>', '<a:t>Revenue</a:t></a:r><a:br/><a:r><a:t>&amp; scope</a:t>'));
  });
  assert.ok((await inventoryPptx(breaks)).items.some(item => item.value === 'Revenue\n& scope'));
});

test('invalid packages, DTDs, malformed XML, ambiguous branches, missing relationships and absent chart caches fail or disclose gaps', async () => {
  const bytes = await fixture();
  await assert.rejects(inventoryPptx(Buffer.from('not zip')), code('PPTX_OUTPUT'));
  for (const [edit, expected] of [
    [(xml: string) => `<!DOCTYPE p:sld [<!ENTITY x "x">]>${xml}`, 'PPTX_XML'],
    [(xml: string) => xml.replace('</p:sld>', ''), 'PPTX_XML'],
    [(xml: string) => xml.replace('</p:spTree>', '<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"/></p:spTree>'), 'PPTX_UNSUPPORTED'],
    [(xml: string) => xml.replaceAll(C, 'urn:extended-chart'), 'PPTX_UNSUPPORTED'],
    [(xml: string) => xml.replace(/(<c:chart )r:id="rId\d+"/, '$1r:id="missing"'), 'PPTX_RELATIONSHIP'],
  ] as const) {
    const invalid = await mutate(bytes, async zip => {
      const part = 'ppt/slides/slide1.xml';
      const original = await zip.file(part)!.async('string');
      const edited = edit(original);
      assert.notEqual(edited, original);
      zip.file(part, edited);
    });
    await assert.rejects(inventoryPptx(invalid), code(expected), expected);
  }
  const cacheless = await mutate(bytes, async zip => {
    const part = zip.file(/^ppt\/charts\/chart\d+\.xml$/)[0]!.name;
    zip.file(part, (await zip.file(part)!.async('string')).replace(/<c:numCache>[^]*?<\/c:numCache>/g, ''));
  });
  assert.ok((await inventoryPptx(cacheless)).diagnostics.some(item => /no cached values/.test(item.message)));
  const external = await mutate(bytes, zip => {
    zip.file('ppt/slides/_rels/slide1.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="bad" Type="${R}/image" TargetMode="External" Target="https://example.test/a.png"/></Relationships>`);
  });
  await assert.rejects(inventoryPptx(external), code('PPTX_EXTERNAL'));
});

test('unsupported graphics and inherited text remain explicit review gaps, not successful content retention', async () => {
  const pptx = new Pptx();
  const slide = pptx.addSlide();
  slide.addImage({ data: 'image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', x: 1, y: 1, w: 1, h: 1 });
  const bytes = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
  const report = await comparePptx(bytes, bytes);
  assert.equal(report.status, 'review-required');
  assert.ok(report.before.diagnostics.some(item => /Image/.test(item.message)));
  const inherited = await mutate(bytes, async zip => {
    const part = zip.file(/^ppt\/slideMasters\/slideMaster\d+\.xml$/)[0]!.name;
    zip.file(part, (await zip.file(part)!.async('string')).replace('</p:spTree>',
      `<p:sp><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Inherited important qualifier</a:t></a:r></a:p></p:txBody></p:sp></p:spTree>`));
  });
  assert.ok((await inventoryPptx(inherited)).diagnostics.some(item => /Layout\/master text/.test(item.message)));
});

test('CLI persists actionable reports on review-required exit, accepts exact changes and refuses overwrites/unsupported options', async () => {
  const root = path.join(process.cwd(), `.pptx-fidelity-test-${randomUUID()}`);
  await fs.mkdir(root);
  try {
    const before = path.join(root, 'before.pptx');
    const after = path.join(root, 'after.pptx');
    const report = path.join(root, 'report.json');
    const approval = path.join(root, 'changes.json');
    await fs.writeFile(before, await withoutChart(await fixture()));
    await fs.writeFile(after, await withoutChart(await fixture({ title: '' })));
    const cli = path.resolve('dist', 'cli', 'aha.mjs');
    await assert.rejects(execute(process.execPath, [cli, 'pptx-compare', before, after, report]), error => {
      assert.equal((error as { code?: number }).code, 1);
      return true;
    });
    const output = JSON.parse(await fs.readFile(report, 'utf8')) as Awaited<ReturnType<typeof comparePptx>>;
    assert.equal(output.status, 'review-required');
    assert.ok(output.changes.length);
    await fs.writeFile(approval, JSON.stringify({ changes: output.changes.map(change => ({ id: change.id, reason: 'Intentional revision.' })) }));
    const accepted = path.join(root, 'accepted.json');
    const result = await execute(process.execPath, [cli, 'pptx-compare', before, after, accepted, '--accept', approval]);
    assert.equal(JSON.parse(result.stdout).status, 'compared');
    await assert.rejects(execute(process.execPath, [cli, 'pptx-compare', before, after, accepted, '--accept', approval]), error => {
      assert.match((error as { stdout: string }).stdout, /Output already exists/);
      return true;
    });
    await assert.rejects(execute(process.execPath, [cli, 'pptx-compare', before, after, path.join(root, 'no.json'), '--allow-code']), error => {
      assert.match((error as { stdout: string }).stdout, /Unknown option/);
      return true;
    });
    await assert.rejects(readPptx(approval), code('PPTX_INPUT'));
    const huge = path.join(root, 'huge.pptx');
    const file = await fs.open(huge, 'w');
    await file.truncate(16 * 1024 * 1024 + 1);
    await file.close();
    await assert.rejects(readPptx(huge), code('ARTIFACT_SIZE'));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
