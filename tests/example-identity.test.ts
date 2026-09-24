import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import JSZip from 'jszip';
import { sourceHash } from '../src/artifacts/project.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = path.join(root, 'examples');
const evaluation = path.join(root, 'evals', 'examples');
const {
  verifyExamples, verifyOutput, verifyPptxEvidence, verifyCurrentIntroductionEvidence,
  verifyRegeneratedEvidence, verifyIntroductionEvidence, verifyCurrentQa, formatsFor, outputVariantsFor, layoutFor, topics, sha,
} = await import(pathToFileURL(path.join(evaluation, 'verify.mjs')).href);
const manifest = JSON.parse(await fs.readFile(path.join(base, 'delivery-manifest.json'), 'utf8'));
const pptxRecords = (value: typeof manifest) => value.requestedOutputs.filter((entry: { format: string }) => entry.format === 'pptx');
const introductionRecords = (value: typeof manifest) => value.requestedOutputs.filter((entry: { topic: string; format: string }) =>
  entry.topic === 'aha-introduction' && ['html', 'image'].includes(entry.format));

test('format inventory retains both current introduction languages with canonical paths', async () => {
  const outputs = Object.keys(topics).flatMap((topic): { topic: string; format: string; language?: string }[] => outputVariantsFor(topic));
  assert.equal(outputs.length, 21);
  assert.equal(Object.keys(topics).length, 5);
  assert.equal(outputs.filter((entry: { format: string }) => entry.format === 'pptx').length, 5);
  assert.equal(Object.hasOwn(topics, 'git-merge'), false);
  await assert.rejects(fs.access(path.join(base, 'git-merge')), { code: 'ENOENT' });
  assert.deepEqual(formatsFor('aha-introduction'), ['html', 'image', 'pptx', 'video']);
  assert.equal(Object.hasOwn(topics, 'project-overview'), false);
  await assert.rejects(verifyOutput(base, { topic: 'project-overview', format: 'html' }), /Unknown topic/);
  await assert.rejects(fs.access(path.join(base, 'project-overview')), { code: 'ENOENT' });
  assert.equal(topics['aha-introduction'].slides, 8);
  assert.equal(topics['aha-introduction'].width, 1080);
  assert.equal(topics['aha-introduction'].height, 1920);
  for (const [format, file] of [
    ['video', 'overview.mp4'], ['pptx', 'overview-v5.pptx'], ['image', 'overview-v5.png'], ['html', 'overview.html'],
  ]) {
    await assert.rejects(verifyOutput(base, { topic: 'aha-introduction', format, language: 'en', file: `aha-introduction/${file}` }), /Canonical output path/);
  }
  for (const introductionPublication of [undefined, '../evals/examples/aha-introduction-20260917/publication.json']) {
    await assert.rejects(verifyExamples({ manifest: {
      ...manifest, introductionPublication,
    } }), /No parallel current publication indexes/);
  }
});

test('all twenty-one outputs bind scoped research, source, receipts, approved audio and bounded QA', async () => {
  const result = await verifyExamples();
  assert.equal(result.status, 'passed');
  assert.equal(result.outputs.length, 21);
  for (const topic of Object.keys(topics)) {
    assert.deepEqual(result.outputs.filter((entry: { topic: string }) => entry.topic === topic)
      .map((entry: { format: string }) => entry.format).sort(),
    topic === 'aha-introduction' ? ['html', 'image', 'pptx', 'video', 'video'] : ['html', 'image', 'pptx', 'video']);
  }
  assert.equal(new Set(result.outputs.filter((entry: { topic: string }) => entry.topic === 'aha-introduction')
    .map((entry: { researchHash: string }) => entry.researchHash)).size, 2, 'Unchanged formats retain their dossier; restructured videos use fresh research');
  assert.equal(new Set(result.outputs.filter((entry: { topic: string; format: string }) => entry.topic === 'aha-introduction' && entry.format === 'video')
    .map((entry: { researchHash: string }) => entry.researchHash)).size, 1, 'English translation preserves Chinese research identity');
});

test('each current output rejects stale publication source, research and output hashes', async t => {
  for (const entry of manifest.requestedOutputs) {
    for (const field of ['sourceHash', 'researchHash', 'sha256']) {
      await t.test(`${entry.topic}/${entry.format}/${field}`, async () => {
        await assert.rejects(verifyOutput(base, { ...entry, [field]: '0'.repeat(64) }), /hash/i);
      });
    }
  }
});

test('publication manifest requires exactly one of every topic and format', async () => {
  await assert.rejects(verifyExamples({ manifest: { ...manifest, requestedOutputs: manifest.requestedOutputs.slice(1) } }), /twenty/);
  const entries = [...manifest.requestedOutputs];
  entries[1] = entries[0];
  await assert.rejects(verifyExamples({ manifest: { ...manifest, requestedOutputs: entries } }));
  for (const pptxPublication of [undefined, '../evals/examples/ppt-second-round-20260920/summary.json']) {
    await assert.rejects(verifyExamples({ manifest: { ...manifest, pptxPublication } }), /No parallel current publication indexes/);
  }
});

test('unified layout has current receipt names and one self-contained QA index', async t => {
  for (const entry of manifest.requestedOutputs) {
    const receipt = JSON.parse(await fs.readFile(path.join(base, entry.receipt), 'utf8'));
    assert.equal(receipt.output, path.basename(entry.file));
    assert.equal(entry.receiptHash, sha(await fs.readFile(path.join(base, entry.receipt))));
    assert.equal(entry.file, layoutFor(entry).file);
    assert.equal(entry.receipt, `${entry.file}.receipt.json`);
    assert.equal(entry.qa.directory, layoutFor(entry).qa);
    assert(entry.qa.evidence.length > 0);
  }
  for (const file of ['pptx-publication.json', 'aha-introduction/publication.json']) {
    await assert.rejects(fs.access(path.join(base, file)), { code: 'ENOENT' });
  }
  for (const topic of Object.keys(topics)) {
    const directory = path.join(base, topic);
    const readme = await fs.readFile(path.join(directory, 'README.md'), 'utf8');
    for (const match of readme.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const link = match[1]!.split('#')[0]!;
      if (link && !/^[a-z]+:/i.test(link)) await fs.access(path.resolve(directory, link));
    }
  }
  const original = manifest.requestedOutputs.find((entry: { topic: string; format: string }) => entry.topic === 'anc' && entry.format === 'html');
  const workspace = await fs.mkdtemp(path.join(evaluation, '.layout-qa-'));
  const fixture = path.join(workspace, 'examples');
  try {
    await fs.cp(path.join(base, original.qa.directory), path.join(fixture, original.qa.directory), { recursive: true });
    await verifyCurrentQa(fixture, original);
    for (const [name, change] of [
      ['missing evidence', (entry: typeof original) => { entry.qa.evidence.pop(); }],
      ['stale evidence', (entry: typeof original) => { entry.qa.evidence[0].sha256 = '0'.repeat(64); }],
      ['noncanonical directory', (entry: typeof original) => { entry.qa.directory = 'old/qa'; }],
      ['retired relocation table', (entry: typeof original) => { entry.qa.relocations = {}; }],
      ['archive dependency', (entry: typeof original) => { entry.qa.evidence[0].archiveFile = 'old/report.json'; }],
      ['previous receipt path', (entry: typeof original) => { entry.provenance = { previousReceipt: 'old.json' }; }],
      ['invented acceptance', (entry: typeof original) => { entry.qa.status = 'accepted'; }],
    ] as const) {
      await t.test(name, async () => {
        const entry = structuredClone(original);
        change(entry);
        await assert.rejects(verifyCurrentQa(fixture, entry));
      });
    }
    await t.test('metadata formatting can be resealed without requiring an archived copy', async () => {
      const entry = structuredClone(original);
      const evidence = entry.qa.evidence.find((item: { file: string }) => item.file.endsWith('browser-observations.json'));
      const file = path.join(fixture, evidence.file);
      await fs.appendFile(file, '\n');
      evidence.sha256 = sha(await fs.readFile(file));
      await verifyCurrentQa(fixture, entry);
    });
  } finally { await fs.rm(workspace, { recursive: true, force: true }); }
});

test('current PPTX publication rejects stale, missing, resealed and misidentified application/page evidence', async t => {
  const entries = manifest.requestedOutputs.filter((entry: { format: string }) => entry.format === 'pptx');
  assert.deepEqual(entries.map((entry: { topic: string }) => entry.topic).sort(), ['aha-introduction', 'anc', 'cpython-string', 'docker-layers', 'greenland']);
  const verified = await Promise.all(entries.map((entry: object) => verifyOutput(base, entry)));
  const publicationFile = 'delivery-manifest.json';
  const originalPublication = JSON.parse(await fs.readFile(path.join(base, publicationFile), 'utf8'));
  const workspace = await fs.mkdtemp(path.join(evaluation, '.pptx-evidence-'));
  try {
    for (const entry of entries) {
      await fs.mkdir(path.join(workspace, entry.topic), { recursive: true });
      await fs.copyFile(path.join(base, entry.file), path.join(workspace, entry.file));
      const qa = path.join(entry.topic, 'qa', 'pptx');
      await fs.cp(path.join(base, qa), path.join(workspace, qa), { recursive: true });
    }
    const writePublication = async (value: typeof originalPublication) =>
      fs.writeFile(path.join(workspace, publicationFile), JSON.stringify(value));
    await writePublication(originalPublication);
    await verifyPptxEvidence(workspace, verified);
    await t.test('PowerShell UTF-8 BOM is accepted while raw application bytes remain hash-bound', async () => {
      const changed = structuredClone(originalPublication);
      const record = pptxRecords(changed)[0];
      const filename = path.join(workspace, record.qa.application.file);
      const original = await fs.readFile(filename);
      const bom = Buffer.from([0xef, 0xbb, 0xbf]);
      const withoutBom = original.subarray(0, 3).equals(bom) ? original.subarray(3) : original;
      const withBom = Buffer.concat([bom, withoutBom]);
      record.qa.application.sha256 = sha(withBom);
      await fs.writeFile(filename, withBom);
      await writePublication(changed);
      try {
        await verifyPptxEvidence(workspace, verified);
        assert.deepEqual(await fs.readFile(filename), withBom, 'Verification must not rewrite BOM-bearing evidence');
        assert.notEqual(sha(withBom), sha(withoutBom), 'BOM contributes to the sealed byte hash');
        record.qa.application.sha256 = sha(withoutBom);
        await writePublication(changed);
        await assert.rejects(verifyPptxEvidence(workspace, verified), /evidence hash/);
      } finally {
        await fs.writeFile(filename, original);
        await writePublication(originalPublication);
      }
    });
    const publicationMutation = async (name: string, change: (value: typeof originalPublication) => void, expected: RegExp) => {
      await t.test(name, async () => {
        const changed = structuredClone(originalPublication);
        change(changed);
        await writePublication(changed);
        try { await assert.rejects(verifyPptxEvidence(workspace, verified), expected); }
        finally { await writePublication(originalPublication); }
      });
    };
    await t.test('missing publication cannot silently skip native evidence', async () => {
      await fs.rm(path.join(workspace, publicationFile));
      try { await assert.rejects(verifyPptxEvidence(workspace, verified), { code: 'ENOENT' }); }
      finally { await writePublication(originalPublication); }
    });
    await publicationMutation('stale publication generation', value => { value.status = 'historical'; }, /publication status/);
    await publicationMutation('wrong publication schema', value => { value.schemaVersion = 3; }, /publication schema/);
    await publicationMutation('missing current topic', value => { value.requestedOutputs = value.requestedOutputs.filter((item: { topic: string; format: string }) => !(item.topic === 'anc' && item.format === 'pptx')); }, /five unique/);
    await publicationMutation('duplicated current topic', value => { value.requestedOutputs[value.requestedOutputs.indexOf(pptxRecords(value)[1])] = pptxRecords(value)[0]; }, /five unique/);
    await publicationMutation('retired topic cannot replace a current deck', value => { pptxRecords(value)[0].topic = 'project-overview'; }, /five unique/);
    for (const field of ['sourceHash', 'researchHash', 'outputHash', 'receiptHash']) {
      await publicationMutation(`stale publication ${field}`, value => { pptxRecords(value)[0][field === 'outputHash' ? 'sha256' : field] = '0'.repeat(64); }, new RegExp(field));
    }
    await publicationMutation('old slide count', value => { pptxRecords(value)[0].slides++; }, /slide count/);
    await publicationMutation('non-Chinese publication', value => { pptxRecords(value)[0].language = 'en'; }, /language/);
    await publicationMutation('retired candidate generation', value => {
      pptxRecords(value).find((item: { topic: string }) => item.topic === 'anc').provenance.origin = { generation: 'first-round' };
    }, /superseded candidate/);
    await publicationMutation('visual acceptance cannot be inferred from application success', value => {
      pptxRecords(value).find((item: { topic: string }) => item.topic === 'anc').qa.visualReview.status = 'passed';
    }, /independent visual acceptance/);
    await publicationMutation('new introduction cannot claim recovered candidate provenance', value => {
      pptxRecords(value).find((item: { topic: string }) => item.topic === 'aha-introduction').provenance.origin = { generation: 'latest-iterated-skill-candidate' };
    }, /superseded candidate/);
    await publicationMutation('new introduction cannot add fabricated candidate hashes', value => {
      pptxRecords(value).find((item: { topic: string }) => item.topic === 'aha-introduction').provenance.origin = { candidateSourceHash: '0'.repeat(64) };
    }, /superseded candidate/);
    await publicationMutation('new introduction requires current visual review', value => {
      pptxRecords(value).find((item: { topic: string }) => item.topic === 'aha-introduction').qa.visualReview.status = 'bounded-historical';
    }, /requires current agent visual review/);
    await publicationMutation('new introduction cannot claim review without an evidence file', value => {
      delete pptxRecords(value).find((item: { topic: string }) => item.topic === 'aha-introduction').qa.visualReview.evidence;
    }, /Canonical current agent review/);
    await publicationMutation('visual limitations cannot be dropped', value => { pptxRecords(value)[0].qa.visualReview.limitations = []; }, /limitations/);
    await publicationMutation('noncanonical application path', value => {
      pptxRecords(value)[0].qa.application.file = '../old/native-observations.json';
    }, /Canonical PowerPoint/);
    await publicationMutation('stale application seal', value => { pptxRecords(value)[0].qa.application.sha256 = '0'.repeat(64); }, /evidence hash/);
    await publicationMutation('missing page record', value => { pptxRecords(value)[0].qa.pages.pop(); }, /sequential/);
    await publicationMutation('duplicated page record', value => { pptxRecords(value)[0].qa.pages[1] = pptxRecords(value)[0].qa.pages[0]; }, /sequential/);
    await publicationMutation('reordered page records', value => { pptxRecords(value)[0].qa.pages.reverse(); }, /sequential/);
    await publicationMutation('noncanonical page path', value => { pptxRecords(value)[0].qa.pages[0].file = '../old/slide-01.png'; }, /sequential/);
    await publicationMutation('stale page seal', value => { pptxRecords(value)[0].qa.pages[0].sha256 = '0'.repeat(64); }, /evidence hash/);
    const first = pptxRecords(originalPublication)[0];
    const pageFile = path.join(workspace, first.qa.pages[0].file);
    const pageBytes = await fs.readFile(pageFile);
    await t.test('missing page bytes', async () => {
      await fs.rm(pageFile);
      try { await assert.rejects(verifyPptxEvidence(workspace, verified), { code: 'ENOENT' }); }
      finally { await fs.writeFile(pageFile, pageBytes); }
    });
    await t.test('resealed non-PNG page', async () => {
      const changed = structuredClone(originalPublication);
      const bytes = Buffer.from('not a PowerPoint PNG export');
      pptxRecords(changed)[0].qa.pages[0].sha256 = sha(bytes);
      await fs.writeFile(pageFile, bytes);
      await writePublication(changed);
      try { await assert.rejects(verifyPptxEvidence(workspace, verified), /page is PNG/); }
      finally { await fs.writeFile(pageFile, pageBytes); await writePublication(originalPublication); }
    });
    const applicationMutation = async (
      name: string, topic: string, change: (value: typeof originalPublication) => void, expected: RegExp,
    ) => {
      await t.test(name, async () => {
        const changed = structuredClone(originalPublication);
        const record = pptxRecords(changed).find((item: { topic: string }) => item.topic === topic);
        const filename = path.join(workspace, record.qa.application.file);
        const original = await fs.readFile(filename);
        const application = JSON.parse(original.toString('utf8').replace(/^\uFEFF/, ''));
        change(application);
        const bytes = Buffer.from(JSON.stringify(application));
        record.qa.application.sha256 = sha(bytes);
        await fs.writeFile(filename, bytes);
        await writePublication(changed);
        try { await assert.rejects(verifyPptxEvidence(workspace, verified), expected); }
        finally { await fs.writeFile(filename, original); await writePublication(originalPublication); }
      });
    };
    await applicationMutation('resealed stale observations outputHash', 'anc', value => { value.outputHash = '0'.repeat(64); }, /observations outputHash/);
    await applicationMutation('resealed shortened observation slides', 'anc', value => { value.slides.pop(); }, /slide count and order/);
    await applicationMutation('resealed repeated observation slide', 'anc', value => { value.slides[1].slide = 1; }, /slide count and order/);
    await applicationMutation('resealed wrong observation image', 'anc', value => { value.slides[0].image = 'old-slide.png'; }, /slide image/);
    await applicationMutation('resealed nonexistent shape ID', 'anc', value => { value.slides[0].shapes[0].id = 999999; }, /object IDs/);
    await applicationMutation('resealed stale native text', 'anc', value => {
      value.slides[0].shapes.find((shape: { text?: string }) => shape.text?.trim()).text += ' stale text';
    }, /text belongs/);
    await applicationMutation('resealed native table claim', 'anc', value => {
      const shape = value.slides.flatMap((slide: { shapes: object[] }) => slide.shapes).find((shape: { hasTable: boolean }) => shape.hasTable);
      shape.hasTable = false;
    }, /native table/);
    await applicationMutation('resealed lost original preservation', 'anc', value => { value.originalUnchanged = false; }, /preserve original/);
    await applicationMutation('resealed missing human acceptance boundary', 'anc', value => { value.unperformed = []; }, /human or visual acceptance/);
    await applicationMutation('resealed missing table edit probe', 'anc', value => {
      value.edits = value.edits.filter((edit: { type: string }) => edit.type !== 'table-cell');
    }, /edit probes/);
    await applicationMutation('resealed nonpersistent edit probe', 'anc', value => { value.edits[0].persisted = false; }, /saved and reopened/);
    await applicationMutation('resealed nonexistent probe target', 'anc', value => { value.edits[0].id = 999999; }, /probe identifies/);
    await applicationMutation('resealed incorrect text probe before', 'anc', value => {
      value.edits.find((edit: { type: string }) => edit.type === 'text').before = 'old deck text';
    }, /before matches/);
    await applicationMutation('resealed unchanged text probe', 'anc', value => {
      const edit = value.edits.find((item: { type: string }) => item.type === 'text'); edit.after = edit.before;
    }, /actual change/);
    await applicationMutation('resealed incorrect table probe before', 'anc', value => {
      value.edits.find((edit: { type: string }) => edit.type === 'table-cell').before = 'old table cell';
    }, /before matches/);
    await applicationMutation('resealed missing Greenland chart probe', 'greenland', value => {
      value.edits = value.edits.filter((edit: { type: string }) => edit.type !== 'chart-data');
    }, /edit probes/);
    await applicationMutation('resealed incorrect chart data probe', 'greenland', value => {
      const edit = value.edits.find((item: { type: string }) => item.type === 'chart-data');
      edit.before += 1; edit.after += 1;
    }, /before matches current native data/);
    const introduction = pptxRecords(originalPublication).find((item: { topic: string }) => item.topic === 'aha-introduction');
    const introductionApplication = JSON.parse((await fs.readFile(path.join(workspace, introduction.qa.application.file), 'utf8')).replace(/^\uFEFF/, ''));
    if (introductionApplication.slides.some((slide: { shapes: { hasChart: boolean }[] }) => slide.shapes.some(shape => shape.hasChart))) {
      await applicationMutation('new introduction charts require a persisted chart edit', 'aha-introduction', value => {
        value.edits = value.edits.filter((edit: { type: string }) => edit.type !== 'chart-data');
      }, /edit probes/);
    }
    await t.test('resealed introduction PPTX review cannot name a stale deck', async () => {
      const changed = structuredClone(originalPublication);
      const record = pptxRecords(changed).find((item: { topic: string }) => item.topic === 'aha-introduction');
      const filename = path.join(workspace, record.qa.visualReview.evidence.file);
      const original = await fs.readFile(filename);
      const review = JSON.parse(original.toString('utf8').replace(/^\uFEFF/, ''));
      review.outputHash = '0'.repeat(64);
      const bytes = Buffer.from(JSON.stringify(review));
      record.qa.visualReview.evidence.sha256 = sha(bytes);
      await fs.writeFile(filename, bytes);
      await writePublication(changed);
      try { await assert.rejects(verifyPptxEvidence(workspace, verified), /Current agent review outputHash/); }
      finally { await fs.writeFile(filename, original); await writePublication(originalPublication); }
    });
    await t.test('runtime and guide hashes record provenance rather than current build equality', async () => {
      const changed = structuredClone(originalPublication);
      for (const entry of pptxRecords(changed)) {
        entry.provenance.runtimeHash = '0'.repeat(64);
        entry.provenance.skill.sourceRevision = '0'.repeat(40);
        for (const key of Object.keys(entry.provenance.skill.guideHashes)) entry.provenance.skill.guideHashes[key] = '0'.repeat(64);
      }
      await writePublication(changed);
      try { await verifyPptxEvidence(workspace, verified); }
      finally { await writePublication(originalPublication); }
    });
  } finally { await fs.rm(workspace, { recursive: true, force: true }); }
});

test('PPTX outputs require Chinese native metadata, canonical counts and runtime-valid native XML', async t => {
  const entries = manifest.requestedOutputs.filter((entry: { format: string }) => entry.format === 'pptx');
  for (const entry of entries) {
    for (const [field, value, expected] of [
      ['language', 'en', /language/], ['native', false, /Native presentation/], ['slides', entry.slides + 1, /slide count/],
    ] as const) {
      await t.test(`${entry.topic}/${field}`, async () => {
        await assert.rejects(verifyOutput(base, { ...entry, [field]: value }), expected);
      });
    }
  }
  const entry = entries.find((item: { topic: string }) => item.topic === 'anc');
  const workspace = await fs.mkdtemp(path.join(evaluation, '.pptx-runtime-'));
  try {
    for (const directory of ['research', path.join('projects', 'pptx')]) {
      await fs.cp(path.join(base, 'anc', directory), path.join(workspace, 'anc', directory), { recursive: true });
    }
    const bytes = await fs.readFile(path.join(base, entry.file));
    await fs.writeFile(path.join(workspace, entry.file), bytes);
    const receiptBytes = await fs.readFile(path.join(base, entry.receipt));
    await fs.writeFile(path.join(workspace, entry.receipt), receiptBytes);
    await t.test('resealed non-Chinese source metadata', async () => {
      const filename = path.join(workspace, 'anc', 'projects', 'pptx', 'artifact.json');
      const original = await fs.readFile(filename);
      const metadata = JSON.parse(original.toString('utf8'));
      metadata.language = 'en';
      await fs.writeFile(filename, JSON.stringify(metadata));
      try {
        const changedSource = await sourceHash(path.join(workspace, 'anc', 'projects', 'pptx'));
        const receipt = JSON.parse(receiptBytes.toString('utf8'));
        receipt.sourceHash = changedSource;
        await fs.writeFile(path.join(workspace, entry.receipt), JSON.stringify(receipt));
        await assert.rejects(verifyOutput(workspace, { ...entry, sourceHash: changedSource }), /source language/);
      } finally {
        await fs.writeFile(filename, original);
        await fs.writeFile(path.join(workspace, entry.receipt), receiptBytes);
      }
    });
    for (const [field, value, expected] of [
      ['native', false, /Native presentation receipt/], ['slides', entry.slides + 1, /Receipt slide count/],
    ] as const) {
      await t.test(`receipt/${field}`, async () => {
        const receipt = JSON.parse(receiptBytes.toString('utf8'));
        receipt[field] = value;
        await fs.writeFile(path.join(workspace, entry.receipt), JSON.stringify(receipt));
        try { await assert.rejects(verifyOutput(workspace, entry), expected); }
        finally { await fs.writeFile(path.join(workspace, entry.receipt), receiptBytes); }
      });
    }
    const zip = await JSZip.loadAsync(bytes);
    const slide = await zip.file('ppt/slides/slide1.xml')!.async('string');
    const ids = [...slide.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)];
    assert(ids.length > 1, 'Mutation needs distinct native objects');
    zip.file('ppt/slides/slide1.xml', slide.replace(ids[1]![0], ids[1]![0].replace(`id="${ids[1]![1]}"`, `id="${ids[0]![1]}"`)));
    const malformed = await zip.generateAsync({ type: 'nodebuffer' });
    await fs.writeFile(path.join(workspace, entry.file), malformed);
    const receipt = JSON.parse(await fs.readFile(path.join(base, entry.receipt), 'utf8'));
    receipt.outputHash = sha(malformed);
    await fs.writeFile(path.join(workspace, entry.receipt), JSON.stringify(receipt));
    await assert.rejects(verifyOutput(workspace, { ...entry, bytes: malformed.length, sha256: sha(malformed) }), /Duplicate nonvisual object ID/);
  } finally { await fs.rm(workspace, { recursive: true, force: true }); }
});

test('current introduction HTML and image require fresh sealed browser and separate agent review evidence', async t => {
  const entries = manifest.requestedOutputs.filter((entry: { topic: string; format: string }) =>
    entry.topic === 'aha-introduction' && ['html', 'image'].includes(entry.format));
  assert.deepEqual(entries.map((entry: { format: string }) => entry.format).sort(), ['html', 'image']);
  const verified = await Promise.all(entries.map((entry: object) => verifyOutput(base, entry)));
  const originalPublication = JSON.parse(await fs.readFile(path.join(base, 'delivery-manifest.json'), 'utf8'));
  const workspace = await fs.mkdtemp(path.join(evaluation, '.introduction-current-'));
  const publicationFile = path.join(workspace, 'delivery-manifest.json');
  const writePublication = async (value: typeof originalPublication) => fs.writeFile(publicationFile, JSON.stringify(value));
  try {
    for (const entry of entries) {
      const qa = path.join('aha-introduction', 'qa', entry.format);
      await fs.cp(path.join(base, qa), path.join(workspace, qa), { recursive: true });
      await fs.copyFile(path.join(base, entry.file), path.join(workspace, entry.file));
    }
    await writePublication(originalPublication);
    await verifyCurrentIntroductionEvidence(workspace, verified);
    const publicationMutation = async (name: string, change: (value: typeof originalPublication) => void, expected: RegExp) => {
      await t.test(name, async () => {
        const changed = structuredClone(originalPublication);
        change(changed);
        await writePublication(changed);
        try { await assert.rejects(verifyCurrentIntroductionEvidence(workspace, verified), expected); }
        finally { await writePublication(originalPublication); }
      });
    };
    await t.test('missing current introduction publication', async () => {
      await fs.rm(publicationFile);
      try { await assert.rejects(verifyCurrentIntroductionEvidence(workspace, verified), { code: 'ENOENT' }); }
      finally { await writePublication(originalPublication); }
    });
    await publicationMutation('stale introduction publication status', value => { value.status = 'historical'; }, /publication status/);
    await publicationMutation('missing introduction image evidence', value => { value.requestedOutputs = value.requestedOutputs.filter((item: { topic: string; format: string }) => !(item.topic === 'aha-introduction' && item.format === 'image')); }, /Exactly current introduction/);
    await publicationMutation('duplicated introduction format evidence', value => { value.requestedOutputs[value.requestedOutputs.indexOf(introductionRecords(value)[1])] = introductionRecords(value)[0]; }, /Exactly current introduction/);
    for (const format of ['html', 'image']) {
      for (const key of ['sourceHash', 'researchHash', 'outputHash', 'receiptHash']) {
        await publicationMutation(`${format} stale publication ${key}`, value => {
          introductionRecords(value).find((item: { format: string }) => item.format === format)[key === 'outputHash' ? 'sha256' : key] = '0'.repeat(64);
        }, new RegExp(key));
      }
    }
    await publicationMutation('old browser evidence cannot stand in for current introduction', value => {
      introductionRecords(value)[0].qa.observations.file = '../evals/examples/refresh-20260916/project-overview/browser-observations.json';
    }, /Canonical current introduction observations/);
    await publicationMutation('unsealed current review cannot stand in for agent findings', value => {
      introductionRecords(value)[0].qa.review.sha256 = '0'.repeat(64);
    }, /evidence hash/);
    const reportMutation = async (
      name: string, format: string, kind: 'observations' | 'review',
      change: (value: typeof originalPublication) => void, expected: RegExp,
    ) => {
      await t.test(name, async () => {
        const changed = structuredClone(originalPublication);
        const record = introductionRecords(changed).find((item: { format: string }) => item.format === format);
        const filename = path.join(workspace, record.qa[kind].file);
        const original = await fs.readFile(filename);
        const report = JSON.parse(original.toString('utf8').replace(/^\uFEFF/, ''));
        change(report);
        const bytes = Buffer.from(JSON.stringify(report));
        record.qa[kind].sha256 = sha(bytes);
        await fs.writeFile(filename, bytes);
        await writePublication(changed);
        try { await assert.rejects(verifyCurrentIntroductionEvidence(workspace, verified), expected); }
        finally { await fs.writeFile(filename, original); await writePublication(originalPublication); }
      });
    };
    for (const format of ['html', 'image']) {
      for (const kind of ['observations', 'review'] as const) {
        for (const key of ['sourceHash', 'researchHash', 'outputHash', ...(kind === 'review' ? ['receiptHash'] : [])]) {
          await reportMutation(`${format} resealed ${kind} ${key}`, format, kind, value => { value[key] = '0'.repeat(64); }, new RegExp(key));
        }
      }
      await reportMutation(`${format} missing observation method`, format, 'observations', value => { value.method = ''; }, /observation method/);
      await reportMutation(`${format} invalid observation time`, format, 'observations', value => { value.observedAt = 'not a date'; }, /observation time/);
      await reportMutation(`${format} missing observation limits`, format, 'observations', value => { value.unperformed = []; }, /observation limits/);
      for (const key of ['semanticFindings', 'visualFindings', 'limitations']) {
        await reportMutation(`${format} missing current review ${key}`, format, 'review', value => { value[key] = []; }, /Explicit current/);
      }
      await reportMutation(`${format} fabricated human reviewer`, format, 'review', value => { value.reviewer.kind = 'human'; }, /not human acceptance/);
      await reportMutation(`${format} lost human acceptance boundary`, format, 'review', value => { value.unperformed = []; }, /human review boundaries/);
      await reportMutation(`${format} stale reviewed image identity`, format, 'review', value => { value.reviewedFiles[0].sha256 = '0'.repeat(64); }, /exact current visual evidence/);
    }
    await reportMutation('recorded current browser failure', 'html', 'observations', value => { value.failures = ['console error']; }, /browser failures/);
    await reportMutation('missing current browser case', 'html', 'observations', value => { value.cases.pop(); }, /Exact current introduction browser cases/);
    await reportMutation('duplicate current browser case', 'html', 'observations', value => { value.cases[1] = value.cases[0]; }, /Exact current introduction browser cases/);
    await reportMutation('missing observed control state', 'html', 'observations', value => { value.cases[0].controls = {}; }, /control observations/);
    await reportMutation('resealed controls cannot reuse an agent review of different observations', 'html', 'observations', value => {
      value.cases[0].controls = { syntheticRegression: 'different panel text and retention state' };
    }, /exact current visual evidence/);
    await reportMutation('missing browser case screenshots', 'html', 'observations', value => { value.cases[0].screenshots = []; }, /Screenshots for every/);
    for (const name of ['initialEnglish', 'keyboard', 'pointer', 'languageSwitch', 'themeSwitch', 'reducedMotion', 'offline', 'console', 'overflow']) {
      await reportMutation(`failed ${name} check`, 'html', 'observations', value => {
        const checks = [...(value.checks ?? []), ...value.cases.flatMap((item: { checks: object[] }) => item.checks)];
        checks.find((check: { name: string }) => check.name === name).passed = false;
      }, new RegExp(name));
    }
    await reportMutation('missing offline check cannot silently pass', 'html', 'observations', value => {
      const checks = [...(value.checks ?? []), ...value.cases.flatMap((item: { checks: object[] }) => item.checks)];
      for (const check of checks) if (check.name === 'offline') check.name = 'other';
    }, /offline check/);
    await reportMutation('nonlocal current HTML screenshot', 'html', 'observations', value => {
      value.cases[0].screenshots[0].file = '../old.png';
    }, /Safe current QA PNG filename/);
    await reportMutation('stale current HTML screenshot hash', 'html', 'observations', value => {
      value.cases[0].screenshots[0].sha256 = '0'.repeat(64);
    }, /evidence hash/);
    for (const [key, value] of [['width', 1920], ['height', 1080]] as const) {
      await reportMutation(`incorrect PNG ${key}`, 'image', 'observations', report => { report[key] = value; }, /PNG/);
    }
    await reportMutation('missing current reading preview', 'image', 'observations', value => { value.previews = []; }, /reading preview/);
    await reportMutation('stale current image preview hash', 'image', 'observations', value => {
      value.previews[0].sha256 = '0'.repeat(64);
    }, /evidence hash/);
    await t.test('missing current screenshot bytes cannot be accepted from an observation record', async () => {
      const record = introductionRecords(originalPublication).find((item: { format: string }) => item.format === 'html');
      const browser = JSON.parse((await fs.readFile(path.join(workspace, record.qa.observations.file), 'utf8')).replace(/^\uFEFF/, ''));
      const filename = path.join(path.dirname(path.join(workspace, record.qa.observations.file)), browser.cases[0].screenshots[0].file);
      const bytes = await fs.readFile(filename);
      await fs.rm(filename);
      try { await assert.rejects(verifyCurrentIntroductionEvidence(workspace, verified), { code: 'ENOENT' }); }
      finally { await fs.writeFile(filename, bytes); }
    });
    for (const entry of entries) {
      await t.test(`${entry.format} rejects wrong manifest language`, async () => {
        await assert.rejects(verifyOutput(base, { ...entry, language: 'en' }), /manifest language/);
      });
    }
    await t.test('bounded agent findings do not require a false aesthetic perfection claim', async () => {
      const changed = structuredClone(originalPublication);
      const record = introductionRecords(changed).find((item: { format: string }) => item.format === 'image');
      const filename = path.join(workspace, record.qa.review.file);
      const original = await fs.readFile(filename);
      const review = JSON.parse(original.toString('utf8').replace(/^\uFEFF/, ''));
      review.visualFindings = ['Synthetic regression: a minor spacing concern remains, without claiming human acceptance.'];
      const bytes = Buffer.from(JSON.stringify(review));
      record.qa.review.sha256 = sha(bytes);
      await fs.writeFile(filename, bytes);
      await writePublication(changed);
      try { await verifyCurrentIntroductionEvidence(workspace, verified); }
      finally { await fs.writeFile(filename, original); await writePublication(originalPublication); }
    });
  } finally { await fs.rm(workspace, { recursive: true, force: true }); }
});

test('gallery links resolve and list four formats plus both introduction video languages', async () => {
  const gallery = await fs.readFile(path.join(base, 'index.html'), 'utf8');
  const links = [...gallery.matchAll(/href="([^"]+)"/g)].map(match => match[1]!);
  for (const link of links) await fs.access(path.join(base, link));
  for (const entry of manifest.requestedOutputs) assert(links.includes(entry.file));
  assert(links.includes('greenland/README.md'));
  assert(!links.includes('greenland/index.html'));
  assert(links.includes('greenland/greenland.pptx'));
  assert(links.includes('greenland/greenland.png'));
  assert(!links.some(link => link.startsWith('git-merge/')));
  assert(!links.some(link => /git-merge-animated|motion-review|ppt-first-round-20260920|ppt-second-round-20260920/.test(link)));
  assert.equal(manifest.optionalNativeMotion, undefined, 'Retired optional Git animation is not a current gallery output');
  for (const filename of ['git-merge-animated.pptx', 'git-merge-animated.pptx.motion-review.json']) {
    await assert.rejects(fs.access(path.join(base, 'git-merge', filename)), { code: 'ENOENT' });
  }
  for (const filename of ['aha-introduction.html', 'aha-introduction.png', 'aha-introduction.pptx',
    'aha-introduction.en.mp4', 'aha-introduction.zh.mp4', 'aha-introduction.en.mp4.srt', 'aha-introduction.zh.mp4.srt', 'README.md']) {
    assert(links.includes(`aha-introduction/${filename}`));
  }
  assert(!links.includes('aha-introduction/aha-introduction.mp4'));
  await assert.rejects(fs.access(path.join(base, 'aha-introduction', 'aha-introduction.mp4')), { code: 'ENOENT' });
  assert(!links.some(link => link.startsWith('project-overview/')), 'Retired project overview is absent from the gallery');
  for (const topic of ['cpython-string', 'docker-layers']) {
    assert(links.includes(`${topic}/README.md`));
    for (const extension of ['html', 'png', 'pptx', 'mp4']) assert(links.includes(`${topic}/${topic}.${extension}`));
  }
});

test('current guides link to the introduction rather than the retired project overview', async () => {
  for (const file of ['README.md', 'README.zh-CN.md', 'aha-introduction/README.md']) {
    const text = await fs.readFile(path.join(base, file), 'utf8');
    assert.doesNotMatch(text, /\]\([^)]*project-overview\//);
  }
  assert(!manifest.requestedOutputs.some((entry: { topic: string }) => entry.topic === 'project-overview'));
});

test('example checks have no retained publication archives or migration maps', async () => {
  for (const name of ['historical-evidence.json', 'layout-20260922', 'refresh-20260916',
    'greenland-20260917', 'code-pilots-20260917', 'aha-introduction-20260917', 'task-video-20260922', 'anc-git']) {
    await assert.rejects(fs.access(path.join(evaluation, name)), { code: 'ENOENT' });
  }
  assert.doesNotMatch(JSON.stringify(manifest), /archiveFile|previousFile|previousReceipt|relocations/);
  await fs.access(path.join(evaluation, 'check-playback.mjs'));
});

test('regenerated videos preserve new Jenny speech through explicit offline imports', async () => {
  for (const topic of ['anc', 'greenland', 'cpython-string', 'docker-layers']) {
    const video = manifest.requestedOutputs.find((item: { topic: string; format: string }) => item.topic === topic && item.format === 'video');
    const result = await verifyOutput(base, video);
    assert.equal(result.plan.provider, 'provided-audio');
    assert.equal(typeof result.recordingPlanHash, 'string');
    const provenance = JSON.parse(await fs.readFile(path.join(base, topic, 'audio', 'provenance.json'), 'utf8'));
    assert.equal(provenance.voice, 'en-US-JennyNeural');
    await assert.rejects(verifyOutput(base, { ...video, provider: 'edge-tts' }), /provider/i);
  }
  const entry = manifest.requestedOutputs.find((item: { topic: string; format: string }) => item.topic === 'greenland' && item.format === 'video');
  await assert.rejects(verifyOutput(base, { ...entry, format: 'html' }), /Canonical output path/);
  await assert.rejects(verifyOutput(base, { ...entry, format: 'image' }), /Canonical output path/);
  const pptx = manifest.requestedOutputs.find((item: { topic: string; format: string }) => item.topic === 'greenland' && item.format === 'pptx');
  assert.equal(pptx.slides, 7);
  assert.equal(pptx.language, 'zh');
  assert.equal((await verifyOutput(base, pptx)).receipt.native, true);
});

test('regenerated evidence rejects resealed stale observations, missing coverage and invented acceptance', async t => {
  const entries = manifest.requestedOutputs.filter((item: { topic: string; format: string }) =>
    (item.topic === 'anc' && item.format === 'html') || (item.topic === 'docker-layers' && item.format === 'video'));
  const verified = await Promise.all(entries.map((entry: object) => verifyOutput(base, entry)));
  const workspace = await fs.mkdtemp(path.join(evaluation, '.regenerated-evidence-'));
  try {
    for (const entry of entries) {
      await fs.cp(path.join(base, entry.qa.directory), path.join(workspace, entry.qa.directory), { recursive: true });
      if (entry.format === 'video') {
        await fs.mkdir(path.join(workspace, entry.topic, 'audio'), { recursive: true });
        await fs.copyFile(path.join(base, entry.topic, 'audio', 'manifest.json'), path.join(workspace, entry.topic, 'audio', 'manifest.json'));
      }
    }
    await verifyRegeneratedEvidence(workspace, verified, manifest);
    const mutate = async <T>(name: string, relative: string, change: (value: T) => void) => {
      await t.test(name, async () => {
        const file = path.join(workspace, relative), original = await fs.readFile(file);
        try {
          const value = JSON.parse(original.toString());
          change(value);
          await fs.writeFile(file, JSON.stringify(value));
          const publication = structuredClone(manifest);
          publication.requestedOutputs.flatMap((entry: { qa: { evidence: { file: string; sha256: string }[] } }) =>
            entry.qa.evidence).find((item: { file: string }) => item.file === relative).sha256 = sha(await fs.readFile(file));
          await assert.rejects(verifyRegeneratedEvidence(workspace, verified, publication));
        } finally { await fs.writeFile(file, original); }
      });
    };
    await mutate('stale browser output', 'anc/qa/html/browser-observations.json', (value: { htmlOutputHash: string }) => { value.htmlOutputHash = '0'.repeat(64); });
    await mutate('missing language/theme/viewport', 'anc/qa/html/browser-observations.json', (value: { cases: unknown[] }) => { value.cases.pop(); });
    await mutate('mobile overflow', 'anc/qa/html/browser-observations.json', (value: { cases: { pageWidth: number }[] }) => { value.cases[0]!.pageWidth = 2000; });
    await mutate('wrong approved source', 'docker-layers/qa/video/approval.json', (value: { sourceHash: string }) => { value.sourceHash = '0'.repeat(64); });
    await mutate('different approved words', 'docker-layers/qa/video/approval.json', (value: { narration: { text: string }[] }) => { value.narration[0]!.text += ' Changed.'; });
    await mutate('source replay failed', 'docker-layers/qa/video/source-diagnostics.json', (value: { replay: { matches: boolean }[] }) => { value.replay[0]!.matches = false; });
    await mutate('caption hides source', 'docker-layers/qa/video/source-diagnostics.json', (value: { video: { captionTop: number }[] }) => { value.video[0]!.captionTop = 400; });
    await mutate('incomplete decode', 'docker-layers/qa/video/encoded/technical-review.json', (value: { fullDecode: boolean }) => { value.fullDecode = false; });
    await mutate('wrong measured frame', 'docker-layers/qa/video/encoded/technical-review.json', (value: { samples: { frame: number }[] }) => { value.samples[0]!.frame++; });
    await mutate('invented listening', 'docker-layers/qa/video/encoded/technical-review.json', (value: { listening: string }) => { value.listening = 'passed'; });
    await mutate('playback did not end', 'docker-layers/qa/video/encoded/playback.json', (value: { ended: boolean }) => { value.ended = false; });
    await mutate('invented human acceptance', 'docker-layers/qa/video/review.json', (value: { status: string }) => { value.status = 'accepted'; });
  } finally { await fs.rm(workspace, { recursive: true, force: true }); }
});

test('introduction variants reject missing language, swapped identity and resealed incorrect evidence', async t => {
  const entries = manifest.requestedOutputs.filter((item: { topic: string; format: string }) => item.topic === 'aha-introduction' && item.format === 'video');
  const results = await Promise.all(entries.map((entry: object) => verifyOutput(base, entry)));
  for (const entry of entries) {
    assert.equal(entry.file, `aha-introduction/aha-introduction.${entry.language}.mp4`);
    await assert.rejects(verifyOutput(base, { ...entry, language: undefined }), /language/);
    await assert.rejects(verifyOutput(base, { ...entry, language: entry.language === 'en' ? 'zh' : 'en' }), /Canonical output/);
    await assert.rejects(verifyOutput(base, { ...entry, provider: 'edge-tts' }), /provider/i);
    await assert.rejects(verifyOutput(base, { ...entry, report: 'aha-introduction/research/report.md' }), /Canonical report/);
  }
  const workspace = await fs.mkdtemp(path.join(evaluation, '.introduction-identity-'));
  try {
    for (const entry of entries) {
      await fs.cp(path.join(base, entry.qa.directory), path.join(workspace, entry.qa.directory), { recursive: true });
      await fs.cp(path.join(base, entry.sourceProject, 'assets'), path.join(workspace, entry.sourceProject, 'assets'), { recursive: true });
    }
    await verifyIntroductionEvidence(workspace, results, manifest);
    for (const entry of entries) {
      type EvidenceFixture = {
        artifactHash: string; listening: string; ended: boolean; recordingPlanHashes: string[];
        samples: { id: string; frame: number; captionTop: number; state: { language: string } }[];
        origins: { plan: { segments: { text: string }[] } }[];
      };
      const mutate = async (name: string, relative: string, change: (value: EvidenceFixture) => void) => {
        await t.test(`${entry.language}: ${name}`, async () => {
          const file = `${entry.qa.directory}/${relative}`;
          const filename = path.join(workspace, file);
          const original = await fs.readFile(filename);
          const value = JSON.parse(original.toString());
          change(value);
          try {
            await fs.writeFile(filename, JSON.stringify(value));
            const publication = structuredClone(manifest);
            publication.requestedOutputs.find((item: { file: string }) => item.file === entry.file)
              .qa.evidence.find((item: { file: string }) => item.file === file).sha256 = sha(await fs.readFile(filename));
            await assert.rejects(verifyIntroductionEvidence(workspace, results, publication));
          } finally { await fs.writeFile(filename, original); }
        });
      };
      await mutate('encoded identity', 'encoded/technical-review.json', value => { value.artifactHash = '0'.repeat(64); });
      await mutate('missing scene samples', 'encoded/technical-review.json', value => { value.samples = value.samples.filter((item: { id: string }) => item.id !== 'install'); });
      await mutate('wrong frame', 'encoded/technical-review.json', value => { value.samples[0]!.frame++; });
      await mutate('invented listening', 'encoded/technical-review.json', value => { value.listening = 'passed'; });
      await mutate('unfinished playback', 'encoded/playback.json', value => { value.ended = false; });
      await mutate('wrong preview language', 'preview/observations.json', value => { value.samples[0]!.state.language = 'fr'; });
      await mutate('caption collision', 'preview/observations.json', value => { value.samples[0]!.captionTop = 500; });
      await mutate('wrong synthesis words', 'speech-approval.json', value => { value.origins[0]!.plan.segments[0]!.text += ' changed'; });
      await mutate('wrong recording approval', 'approval.json', value => { value.recordingPlanHashes[0] = '0'.repeat(64); });
    }
  } finally { await fs.rm(workspace, { recursive: true, force: true }); }
});

test('actual stale receipt, source, dossier, audio, plan and subtitle bytes fail validation', async t => {
  const workspace = await fs.mkdtemp(path.join(evaluation, '.identity-fixture-'));
  const entries = manifest.requestedOutputs.filter((entry: { topic: string }) => entry.topic === 'anc');
  try {
    await fs.cp(path.join(base, 'anc'), path.join(workspace, 'anc'), { recursive: true });
    const html = entries.find((entry: { format: string }) => entry.format === 'html');
    const video = entries.find((entry: { format: string }) => entry.format === 'video');
    const mutate = async (name: string, relative: string, entry: object, change: (bytes: Buffer) => Buffer | string) => {
      await t.test(name, async () => {
        const filename = path.join(workspace, 'anc', relative);
        const original = await fs.readFile(filename);
        try {
          await fs.writeFile(filename, change(original));
          await assert.rejects(verifyOutput(workspace, entry));
        } finally { await fs.writeFile(filename, original); }
      });
    };
    await mutate('receipt hash', 'anc.html.receipt.json', html, bytes => {
      const receipt = JSON.parse(bytes.toString()); receipt.outputHash = '0'.repeat(64);
      return JSON.stringify(receipt);
    });
    await mutate('source bytes', path.join('projects', 'html', 'html', 'index.html'), html, bytes => Buffer.concat([bytes, Buffer.from('\n')]));
    await mutate('canonical dossier', path.join('research', 'report.md'), html, bytes => Buffer.concat([bytes, Buffer.from('\nChanged research.\n')]));
    await mutate('output bytes', 'anc.html', html, bytes => Buffer.concat([bytes, Buffer.from('\n')]));
    await mutate('audio hash', path.join('audio', 'manifest.json'), video, bytes => {
      const audio = JSON.parse(bytes.toString()); audio.segments[0].sha256 = '0'.repeat(64);
      return JSON.stringify(audio);
    });
    await mutate('audio waveform', path.join('audio', 'segment-001.wav'), video, bytes => {
      const changed = Buffer.from(bytes); changed[changed.length - 1] = changed[changed.length - 1]! ^ 1; return changed;
    });
    await mutate('plan binding', 'video-plan.json', video, bytes => {
      const plan = JSON.parse(bytes.toString()); plan.segments[0].text += ' Changed narration.';
      return JSON.stringify(plan);
    });
    await mutate('subtitle bytes', 'anc.mp4.srt', video, bytes => Buffer.concat([bytes, Buffer.from('\n')]));
    await mutate('recording hash', path.join('audio', 'provenance.json'), video, bytes => {
      const recordings = JSON.parse(bytes.toString()); recordings.recordings[0].sha256 = '0'.repeat(64);
      return JSON.stringify(recordings);
    });
    await mutate('recording narration', path.join('audio', 'provenance.json'), video, bytes => {
      const plan = JSON.parse(bytes.toString()); plan.narration[0].text += ' Changed narration.';
      return JSON.stringify(plan);
    });
    await mutate('receipt filename', 'anc.mp4.receipt.json', video, bytes => {
      const receipt = JSON.parse(bytes.toString()); receipt.output = 'old-name.mp4';
      return JSON.stringify(receipt);
    });
  } finally { await fs.rm(workspace, { recursive: true, force: true }); }
});

test('introduction recording provenance rejects wrong voice, import identity and segment bytes', async t => {
  const entry = manifest.requestedOutputs.find((item: { topic: string; format: string; language: string }) =>
    item.topic === 'aha-introduction' && item.format === 'video' && item.language === 'zh');
  const workspace = await fs.mkdtemp(path.join(evaluation, '.introduction-audio-'));
  try {
    for (const relative of [entry.sourceProject, layoutFor(entry).research, entry.audioDirectory,
      entry.videoPlan, entry.file, entry.receipt, `${entry.file}.srt`]) {
      await fs.mkdir(path.dirname(path.join(workspace, relative)), { recursive: true });
      await fs.cp(path.join(base, relative), path.join(workspace, relative), { recursive: true });
    }
    await verifyOutput(workspace, entry);
    const filename = path.join(workspace, entry.audioDirectory, 'provenance.json');
    const original = await fs.readFile(filename);
    type RecordingFixture = {
      voice: string; importedPlanHash: string; recordingPlanHashes: string[];
      narration: { text: string }[]; recordings: { sha256: string; frames: number }[];
    };
    for (const [name, change] of [
      ['wrong voice', (value: RecordingFixture) => { value.voice = 'en-US-AriaNeural'; }],
      ['stale import', (value: RecordingFixture) => { value.importedPlanHash = '0'.repeat(64); }],
      ['missing origin', (value: RecordingFixture) => { value.recordingPlanHashes.pop(); }],
      ['changed words', (value: RecordingFixture) => { value.narration[0]!.text += ' Changed.'; }],
      ['changed waveform identity', (value: RecordingFixture) => { value.recordings[0]!.sha256 = '0'.repeat(64); }],
      ['wrong duration', (value: RecordingFixture) => { value.recordings[0]!.frames++; }],
    ] as const) {
      await t.test(name, async () => {
        const value = JSON.parse(original.toString());
        change(value);
        try {
          await fs.writeFile(filename, JSON.stringify(value));
          await assert.rejects(verifyOutput(workspace, entry));
        } finally { await fs.writeFile(filename, original); }
      });
    }
  } finally { await fs.rm(workspace, { recursive: true, force: true }); }
});

test('browser and generic media playback tools require approval independently of cwd', () => {
  for (const script of ['check-html.mjs', 'check-playback.mjs']) {
    const result = spawnSync(process.execPath, [path.join(evaluation, script)], {
      cwd: path.join(root, 'tests'), encoding: 'utf8', timeout: 30000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Error: (Review|Obtain).*approval/);
    assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND/);
  }
});

test('Git autocrlf preserves all twenty-one outputs, source trees, audio and current QA', async () => {
  const workspace = await fs.mkdtemp(path.join(evaluation, '.identity-git-'));
  const git = (...args: string[]) => execFileSync('git', args, {
    cwd: workspace, timeout: 60000, maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(workspace, 'empty.gitconfig') },
  });
  const files: string[] = [];
  const collect = async (directory: string) => {
    for (const entry of await fs.readdir(path.join(root, directory), { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await collect(filename);
      else if (entry.isFile()) files.push(filename);
    }
  };
  try {
    await fs.writeFile(path.join(workspace, 'empty.gitconfig'), '');
    git('init', '--quiet');
    git('config', 'core.autocrlf', 'true');
    files.push(path.join('examples', '.gitattributes'), path.join('examples', 'delivery-manifest.json'));
    for (const topic of Object.keys(topics)) await collect(path.join('examples', topic));
    for (const file of [

      'qa/html/browser-observations.json', 'qa/image/image-observations.json',
      ...['html', 'image', 'pptx'].map(format => `qa/${format}/agent-review.json`),
    ]) {
      assert(files.includes(path.join('examples', 'aha-introduction', ...file.split('/'))), `Current introduction byte coverage: ${file}`);
    }
    for (const file of files) {
      const target = path.join(workspace, file);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(path.join(root, file), target);
    }
    git('add', '--', 'examples');
    // Re-materialize from Git rather than testing a hand-selected text-only subset.
    for (const file of files) await fs.rm(path.join(workspace, file));
    git('checkout-index', '--all', '--force');
    for (const file of files) {
      assert.deepEqual(await fs.readFile(path.join(workspace, file)), await fs.readFile(path.join(root, file)), `${file}: checkout must retain sealed bytes`);
    }
    for (const entry of manifest.requestedOutputs) {
      const project = path.join('examples', entry.sourceProject);
      assert.equal(await sourceHash(path.join(workspace, project)), entry.sourceHash);
    }
  } finally { await fs.rm(workspace, { recursive: true, force: true }); }
});
