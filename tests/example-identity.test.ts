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
  verifyCodePilotEvidence, verifyIntroductionEvidence, formatsFor, topics, sha,
} = await import(pathToFileURL(path.join(evaluation, 'verify.mjs')).href);
const manifest = JSON.parse(await fs.readFile(path.join(base, 'delivery-manifest.json'), 'utf8'));

test('format inventory retains only the current introduction and its canonical video path', async () => {
  const outputs = Object.keys(topics).flatMap(topic => formatsFor(topic).map((format: string) => ({ topic, format })));
  assert.equal(outputs.length, 16);
  assert.equal(Object.keys(topics).length, 6);
  assert.equal(outputs.filter(entry => entry.format === 'pptx').length, 4);
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
    await assert.rejects(verifyOutput(base, { topic: 'aha-introduction', format, file: `aha-introduction/${file}` }), /Canonical output path/);
  }
  for (const introductionPublication of [undefined, '../evals/examples/aha-introduction-20260917/publication.json']) {
    await assert.rejects(verifyExamples({ manifest: {
      requestedOutputs: outputs, pptxPublication: 'pptx-publication.json', introductionPublication,
    } }), /canonical current introduction publication/);
  }
});

test('all sixteen requested outputs bind canonical research, source, receipts, approved audio and bounded QA', async () => {
  const result = await verifyExamples();
  assert.equal(result.status, 'passed');
  assert.equal(result.outputs.length, 16);
  assert.deepEqual(result.outputs.filter((entry: { topic: string }) => entry.topic === 'greenland')
    .map((entry: { format: string }) => entry.format).sort(), ['pptx', 'video']);
  for (const topic of ['cpython-string', 'docker-layers']) {
    assert.deepEqual(result.outputs.filter((entry: { topic: string }) => entry.topic === topic)
      .map((entry: { format: string }) => entry.format), ['video']);
  }
  for (const topic of ['anc', 'git-merge', 'aha-introduction']) {
    assert.deepEqual(result.outputs.filter((entry: { topic: string }) => entry.topic === topic)
      .map((entry: { format: string }) => entry.format).sort(), ['html', 'image', 'pptx', 'video']);
  }
  assert.equal(new Set(result.outputs.filter((entry: { topic: string }) => entry.topic === 'aha-introduction')
    .map((entry: { researchHash: string }) => entry.researchHash)).size, 1, 'All introduction formats retain the video dossier');
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
  await assert.rejects(verifyExamples({ manifest: { ...manifest, requestedOutputs: manifest.requestedOutputs.slice(1) } }), /sixteen/);
  const entries = [...manifest.requestedOutputs];
  entries[1] = entries[0];
  await assert.rejects(verifyExamples({ manifest: { ...manifest, requestedOutputs: entries } }));
  for (const pptxPublication of [undefined, '../evals/examples/ppt-second-round-20260920/summary.json']) {
    await assert.rejects(verifyExamples({ manifest: { ...manifest, pptxPublication } }), /canonical current PPTX publication/);
  }
});

test('current PPTX publication rejects stale, missing, resealed and misidentified application/page evidence', async t => {
  const entries = manifest.requestedOutputs.filter((entry: { format: string }) => entry.format === 'pptx');
  assert.deepEqual(entries.map((entry: { topic: string }) => entry.topic).sort(), ['aha-introduction', 'anc', 'git-merge', 'greenland']);
  const verified = await Promise.all(entries.map((entry: object) => verifyOutput(base, entry)));
  const publicationFile = 'pptx-publication.json';
  const originalPublication = JSON.parse(await fs.readFile(path.join(base, publicationFile), 'utf8'));
  const workspace = await fs.mkdtemp(path.join(evaluation, '.pptx-evidence-'));
  try {
    for (const entry of entries) {
      await fs.mkdir(path.join(workspace, entry.topic), { recursive: true });
      await fs.copyFile(path.join(base, entry.file), path.join(workspace, entry.file));
      const qa = path.join(entry.topic, 'projects', 'pptx', 'qa');
      await fs.cp(path.join(base, qa), path.join(workspace, qa), { recursive: true });
    }
    const writePublication = async (value: typeof originalPublication) =>
      fs.writeFile(path.join(workspace, publicationFile), JSON.stringify(value));
    await writePublication(originalPublication);
    await verifyPptxEvidence(workspace, verified);
    await t.test('PowerShell UTF-8 BOM is accepted while raw application bytes remain hash-bound', async () => {
      const changed = structuredClone(originalPublication);
      const record = changed.outputs[0];
      const filename = path.join(workspace, record.application.file);
      const original = await fs.readFile(filename);
      const bom = Buffer.from([0xef, 0xbb, 0xbf]);
      const withoutBom = original.subarray(0, 3).equals(bom) ? original.subarray(3) : original;
      const withBom = Buffer.concat([bom, withoutBom]);
      record.application.sha256 = sha(withBom);
      await fs.writeFile(filename, withBom);
      await writePublication(changed);
      try {
        await verifyPptxEvidence(workspace, verified);
        assert.deepEqual(await fs.readFile(filename), withBom, 'Verification must not rewrite BOM-bearing evidence');
        assert.notEqual(sha(withBom), sha(withoutBom), 'BOM contributes to the sealed byte hash');
        record.application.sha256 = sha(withoutBom);
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
    await publicationMutation('wrong publication schema', value => { value.schemaVersion = 2; }, /publication schema/);
    await publicationMutation('missing current topic', value => { value.outputs.pop(); }, /four unique/);
    await publicationMutation('duplicated current topic', value => { value.outputs[1] = value.outputs[0]; }, /four unique/);
    await publicationMutation('retired topic cannot replace a current deck', value => { value.outputs[0].topic = 'project-overview'; }, /four unique/);
    for (const field of ['sourceHash', 'researchHash', 'outputHash', 'receiptHash']) {
      await publicationMutation(`stale publication ${field}`, value => { value.outputs[0][field] = '0'.repeat(64); }, new RegExp(field));
    }
    await publicationMutation('old slide count', value => { value.outputs[0].slides++; }, /slide count/);
    await publicationMutation('non-Chinese publication', value => { value.outputs[0].language = 'en'; }, /language/);
    await publicationMutation('wrong candidate generation', value => {
      value.outputs.find((item: { topic: string }) => item.topic === 'anc').origin.generation = 'first-round';
    }, /candidate generation/);
    await publicationMutation('visual acceptance cannot be inferred from application success', value => {
      value.outputs.find((item: { topic: string }) => item.topic === 'anc').visualReview.status = 'passed';
    }, /independent visual acceptance/);
    await publicationMutation('new introduction cannot claim recovered candidate provenance', value => {
      value.outputs.find((item: { topic: string }) => item.topic === 'aha-introduction').origin.generation = 'latest-iterated-skill-candidate';
    }, /current authoring/);
    await publicationMutation('new introduction cannot add fabricated candidate hashes', value => {
      value.outputs.find((item: { topic: string }) => item.topic === 'aha-introduction').origin.candidateSourceHash = '0'.repeat(64);
    }, /current authoring/);
    await publicationMutation('new introduction requires current visual review', value => {
      value.outputs.find((item: { topic: string }) => item.topic === 'aha-introduction').visualReview.status = 'bounded-historical';
    }, /requires current agent visual review/);
    await publicationMutation('new introduction cannot claim review without an evidence file', value => {
      delete value.outputs.find((item: { topic: string }) => item.topic === 'aha-introduction').visualReview.evidence;
    }, /Canonical current agent review/);
    await publicationMutation('visual limitations cannot be dropped', value => { value.outputs[0].visualReview.limitations = []; }, /limitations/);
    await publicationMutation('noncanonical application path', value => {
      value.outputs[0].application.file = '../old/native-observations.json';
    }, /Canonical PowerPoint/);
    await publicationMutation('stale application seal', value => { value.outputs[0].application.sha256 = '0'.repeat(64); }, /evidence hash/);
    await publicationMutation('missing page record', value => { value.outputs[0].pages.pop(); }, /sequential/);
    await publicationMutation('duplicated page record', value => { value.outputs[0].pages[1] = value.outputs[0].pages[0]; }, /sequential/);
    await publicationMutation('reordered page records', value => { value.outputs[0].pages.reverse(); }, /sequential/);
    await publicationMutation('noncanonical page path', value => { value.outputs[0].pages[0].file = '../old/slide-01.png'; }, /sequential/);
    await publicationMutation('stale page seal', value => { value.outputs[0].pages[0].sha256 = '0'.repeat(64); }, /evidence hash/);
    const first = originalPublication.outputs[0];
    const pageFile = path.join(workspace, first.pages[0].file);
    const pageBytes = await fs.readFile(pageFile);
    await t.test('missing page bytes', async () => {
      await fs.rm(pageFile);
      try { await assert.rejects(verifyPptxEvidence(workspace, verified), { code: 'ENOENT' }); }
      finally { await fs.writeFile(pageFile, pageBytes); }
    });
    await t.test('resealed non-PNG page', async () => {
      const changed = structuredClone(originalPublication);
      const bytes = Buffer.from('not a PowerPoint PNG export');
      changed.outputs[0].pages[0].sha256 = sha(bytes);
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
        const record = changed.outputs.find((item: { topic: string }) => item.topic === topic);
        const filename = path.join(workspace, record.application.file);
        const original = await fs.readFile(filename);
        const application = JSON.parse(original.toString('utf8').replace(/^\uFEFF/, ''));
        change(application);
        const bytes = Buffer.from(JSON.stringify(application));
        record.application.sha256 = sha(bytes);
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
    const introduction = originalPublication.outputs.find((item: { topic: string }) => item.topic === 'aha-introduction');
    const introductionApplication = JSON.parse((await fs.readFile(path.join(workspace, introduction.application.file), 'utf8')).replace(/^\uFEFF/, ''));
    if (introductionApplication.slides.some((slide: { shapes: { hasChart: boolean }[] }) => slide.shapes.some(shape => shape.hasChart))) {
      await applicationMutation('new introduction charts require a persisted chart edit', 'aha-introduction', value => {
        value.edits = value.edits.filter((edit: { type: string }) => edit.type !== 'chart-data');
      }, /edit probes/);
    }
    await t.test('resealed introduction PPTX review cannot name a stale deck', async () => {
      const changed = structuredClone(originalPublication);
      const record = changed.outputs.find((item: { topic: string }) => item.topic === 'aha-introduction');
      const filename = path.join(workspace, record.visualReview.evidence.file);
      const original = await fs.readFile(filename);
      const review = JSON.parse(original.toString('utf8').replace(/^\uFEFF/, ''));
      review.outputHash = '0'.repeat(64);
      const bytes = Buffer.from(JSON.stringify(review));
      record.visualReview.evidence.sha256 = sha(bytes);
      await fs.writeFile(filename, bytes);
      await writePublication(changed);
      try { await assert.rejects(verifyPptxEvidence(workspace, verified), /Current agent review outputHash/); }
      finally { await fs.writeFile(filename, original); await writePublication(originalPublication); }
    });
    await t.test('runtime and guide hashes record provenance rather than current build equality', async () => {
      const changed = structuredClone(originalPublication);
      changed.runtimeHash = '0'.repeat(64);
      changed.skill.sourceRevision = '0'.repeat(40);
      for (const key of Object.keys(changed.skill.guideHashes)) changed.skill.guideHashes[key] = '0'.repeat(64);
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
  const originalPublication = JSON.parse(await fs.readFile(path.join(base, 'aha-introduction', 'publication.json'), 'utf8'));
  const workspace = await fs.mkdtemp(path.join(evaluation, '.introduction-current-'));
  const publicationFile = path.join(workspace, 'aha-introduction', 'publication.json');
  const writePublication = async (value: typeof originalPublication) => fs.writeFile(publicationFile, JSON.stringify(value));
  try {
    for (const entry of entries) {
      const qa = path.join('aha-introduction', 'projects', entry.format, 'qa');
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
    await publicationMutation('missing introduction image evidence', value => { value.outputs.pop(); }, /Exactly current introduction/);
    await publicationMutation('duplicated introduction format evidence', value => { value.outputs[1] = value.outputs[0]; }, /Exactly current introduction/);
    for (const format of ['html', 'image']) {
      for (const key of ['sourceHash', 'researchHash', 'outputHash', 'receiptHash']) {
        await publicationMutation(`${format} stale publication ${key}`, value => {
          value.outputs.find((item: { format: string }) => item.format === format)[key] = '0'.repeat(64);
        }, new RegExp(key));
      }
    }
    await publicationMutation('old browser evidence cannot stand in for current introduction', value => {
      value.outputs[0].observations.file = '../evals/examples/refresh-20260916/project-overview/browser-observations.json';
    }, /Canonical current introduction observations/);
    await publicationMutation('unsealed current review cannot stand in for agent findings', value => {
      value.outputs[0].review.sha256 = '0'.repeat(64);
    }, /evidence hash/);
    const reportMutation = async (
      name: string, format: string, kind: 'observations' | 'review',
      change: (value: typeof originalPublication) => void, expected: RegExp,
    ) => {
      await t.test(name, async () => {
        const changed = structuredClone(originalPublication);
        const record = changed.outputs.find((item: { format: string }) => item.format === format);
        const filename = path.join(workspace, record[kind].file);
        const original = await fs.readFile(filename);
        const report = JSON.parse(original.toString('utf8').replace(/^\uFEFF/, ''));
        change(report);
        const bytes = Buffer.from(JSON.stringify(report));
        record[kind].sha256 = sha(bytes);
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
      const record = originalPublication.outputs.find((item: { format: string }) => item.format === 'html');
      const browser = JSON.parse((await fs.readFile(path.join(workspace, record.observations.file), 'utf8')).replace(/^\uFEFF/, ''));
      const filename = path.join(path.dirname(path.join(workspace, record.observations.file)), browser.cases[0].screenshots[0].file);
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
      const record = changed.outputs.find((item: { format: string }) => item.format === 'image');
      const filename = path.join(workspace, record.review.file);
      const original = await fs.readFile(filename);
      const review = JSON.parse(original.toString('utf8').replace(/^\uFEFF/, ''));
      review.visualFindings = ['Synthetic regression: a minor spacing concern remains, without claiming human acceptance.'];
      const bytes = Buffer.from(JSON.stringify(review));
      record.review.sha256 = sha(bytes);
      await fs.writeFile(filename, bytes);
      await writePublication(changed);
      try { await verifyCurrentIntroductionEvidence(workspace, verified); }
      finally { await fs.writeFile(filename, original); await writePublication(originalPublication); }
    });
  } finally { await fs.rm(workspace, { recursive: true, force: true }); }
});

test('gallery links resolve and list only requested formats, including video-only pilots', async () => {
  const gallery = await fs.readFile(path.join(base, 'index.html'), 'utf8');
  const links = [...gallery.matchAll(/href="([^"]+)"/g)].map(match => match[1]!);
  for (const link of links) await fs.access(path.join(base, link));
  for (const entry of manifest.requestedOutputs) assert(links.includes(entry.file));
  assert(links.includes('greenland/README.md'));
  assert(!links.includes('greenland/index.html'));
  assert(links.includes('greenland/greenland.pptx'));
  assert(!links.includes('greenland/greenland.png'));
  assert(!links.some(link => /git-merge-animated|motion-review|ppt-first-round-20260920|ppt-second-round-20260920/.test(link)));
  assert.equal(manifest.optionalNativeMotion, undefined, 'Retired optional Git animation is not a current gallery output');
  for (const filename of ['git-merge-animated.pptx', 'git-merge-animated.pptx.motion-review.json']) {
    await assert.rejects(fs.access(path.join(base, 'git-merge', filename)), { code: 'ENOENT' });
  }
  for (const filename of ['index.html', 'overview.png', 'overview.pptx', 'overview-v5.mp4', 'README.md']) {
    assert(links.includes(`aha-introduction/${filename}`));
  }
  assert(!links.some(link => link.startsWith('project-overview/')), 'Retired project overview is absent from the gallery');
  for (const topic of ['cpython-string', 'docker-layers']) {
    assert(links.includes(`${topic}/README.md`));
    assert(!links.some(link => link.startsWith(`${topic}/`) && /\.(html|png|pptx)$/.test(link)));
  }
});

test('current guides link to the introduction rather than the retired project overview', async () => {
  for (const file of ['README.md', 'README.zh-CN.md', 'aha-introduction/README.md']) {
    const text = await fs.readFile(path.join(base, file), 'utf8');
    assert.doesNotMatch(text, /\]\([^)]*project-overview\//);
  }
  assert(!manifest.requestedOutputs.some((entry: { topic: string }) => entry.topic === 'project-overview'));
});

test('evidence index uses actual introduction records and removes obsolete overview-only directories', async () => {
  const index = JSON.parse(await fs.readFile(path.join(evaluation, 'historical-evidence.json'), 'utf8'));
  for (const file of index.currentPublicationEvidence) await fs.access(path.resolve(evaluation, file));
  assert(index.currentPublicationEvidence.includes('../../examples/aha-introduction/publication.json'));
  assert(index.currentPublicationEvidence.includes('aha-introduction-20260917/publication.json'));
  assert(!JSON.stringify(index).includes('project-overview'));
  for (const directory of [
    path.join(evaluation, 'project-overview'),
    path.join(evaluation, 'overview-image-20260917'),
    path.join(evaluation, 'refresh-20260916', 'project-overview'),
    path.join(root, 'evals', 'pptx-first-round', 'fixtures', 'project-overview'),
  ]) await assert.rejects(fs.access(directory), { code: 'ENOENT' });
  await fs.access(path.join(evaluation, 'check-playback.mjs'));
});

test('Greenland adds native PPTX while keeping its direct speech provider and no imported-audio origin', async () => {
  const entry = manifest.requestedOutputs.find((item: { topic: string; format: string }) => item.topic === 'greenland' && item.format === 'video');
  const result = await verifyOutput(base, entry);
  assert.equal(result.plan.provider, 'edge-tts');
  assert.equal(result.originalPlanHash, undefined);
  await assert.rejects(verifyOutput(base, { ...entry, provider: 'provided-audio' }), /provider/i);
  await assert.rejects(verifyOutput(base, { ...entry, format: 'html' }), /Unrequested format/);
  await assert.rejects(verifyOutput(base, { ...entry, format: 'image' }), /Unrequested format/);
  const pptx = manifest.requestedOutputs.find((item: { topic: string; format: string }) => item.topic === 'greenland' && item.format === 'pptx');
  assert.equal(pptx.slides, 7);
  assert.equal(pptx.language, 'zh');
  assert.equal((await verifyOutput(base, pptx)).receipt.native, true);
});

test('both code pilots retain direct speech, video-only scope and current evidence', async () => {
  const verified = [];
  for (const topic of ['cpython-string', 'docker-layers']) {
    const entry = manifest.requestedOutputs.find((item: { topic: string }) => item.topic === topic);
    const result = await verifyOutput(base, entry);
    verified.push(result);
    assert.equal(result.plan.provider, 'edge-tts');
    assert.equal(result.originalPlanHash, undefined);
    await assert.rejects(verifyOutput(base, { ...entry, provider: 'provided-audio' }), /provider/i);
    await assert.rejects(verifyOutput(base, { ...entry, format: 'html' }), /Unrequested format/);
  }
  const workspace = await fs.mkdtemp(path.join(evaluation, '.pilot-evidence-'));
  try {
    await fs.cp(path.join(evaluation, 'code-pilots-20260917'), workspace, { recursive: true });
    await verifyCodePilotEvidence(workspace, verified);
    const filename = path.join(workspace, 'docker-layers', 'encoded', 'technical-review.json');
    const report = JSON.parse(await fs.readFile(filename, 'utf8'));
    report.artifactHash = '0'.repeat(64);
    await fs.writeFile(filename, JSON.stringify(report));
    await assert.rejects(verifyCodePilotEvidence(workspace, verified), /evidence hash/i);
  } finally { await fs.rm(workspace, { recursive: true, force: true }); }
});

test('introduction video preserves original speech source and rejects resealed wrong encoded evidence', async () => {
  const entry = manifest.requestedOutputs.find((item: { topic: string; format: string }) => item.topic === 'aha-introduction' && item.format === 'video');
  assert.equal(entry.file, 'aha-introduction/overview-v5.mp4');
  const result = await verifyOutput(base, entry);
  assert.equal(result.plan.provider, 'provided-audio');
  await assert.rejects(verifyOutput(base, { ...entry, provider: 'edge-tts' }), /provider/i);
  const workspace = await fs.mkdtemp(path.join(evaluation, '.introduction-identity-'));
  try {
    const original = JSON.parse(await fs.readFile(path.join(base, 'aha-introduction', 'audio-origin', 'original-plan.json'), 'utf8'));
    const reconstructed = path.join(workspace, 'original-source');
    await fs.cp(path.join(base, 'aha-introduction', 'projects', 'video'), reconstructed, { recursive: true });
    await fs.copyFile(path.join(base, 'aha-introduction', 'audio-origin', 'original-scenes.js'), path.join(reconstructed, 'html', 'scenes.js'));
    assert.equal(await sourceHash(reconstructed), original.sourceHash);
    assert.notEqual(original.sourceHash, result.sourceHash);
    const evidence = path.join(workspace, 'evidence');
    await fs.cp(path.join(evaluation, 'aha-introduction-20260917'), evidence, { recursive: true });
    await verifyIntroductionEvidence(evidence, [result]);
    const reportFile = path.join(evidence, 'encoded', 'technical-review.json');
    const report = JSON.parse(await fs.readFile(reportFile, 'utf8'));
    report.artifactHash = '0'.repeat(64);
    await fs.writeFile(reportFile, JSON.stringify(report));
    const publicationFile = path.join(evidence, 'publication.json');
    const publication = JSON.parse(await fs.readFile(publicationFile, 'utf8'));
    publication.evidence.find((item: { file: string }) => item.file === 'encoded/technical-review.json').sha256 = sha(await fs.readFile(reportFile));
    await fs.writeFile(publicationFile, JSON.stringify(publication));
    await assert.rejects(verifyIntroductionEvidence(evidence, [result]), /encoded identity/i);
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
    await mutate('receipt hash', 'index.html.receipt.json', html, bytes => {
      const receipt = JSON.parse(bytes.toString()); receipt.outputHash = '0'.repeat(64);
      return JSON.stringify(receipt);
    });
    await mutate('source bytes', path.join('projects', 'html', 'html', 'index.html'), html, bytes => Buffer.concat([bytes, Buffer.from('\n')]));
    await mutate('canonical dossier', path.join('research', 'report.md'), html, bytes => Buffer.concat([bytes, Buffer.from('\nChanged research.\n')]));
    await mutate('output bytes', 'index.html', html, bytes => Buffer.concat([bytes, Buffer.from('\n')]));
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
    await mutate('original recording hash', path.join('audio-origin', 'recordings.json'), video, bytes => {
      const recordings = JSON.parse(bytes.toString()); recordings.recordings[0].sha256 = '0'.repeat(64);
      return JSON.stringify(recordings);
    });
    await mutate('original narration', path.join('audio-origin', 'original-plan.json'), video, bytes => {
      const plan = JSON.parse(bytes.toString()); plan.segments[0].text += ' Changed original narration.';
      return JSON.stringify(plan);
    });
    await mutate('original failure plan binding', path.join('audio-origin', 'failure.json'), video, bytes => {
      const failure = JSON.parse(bytes.toString()); failure.planHash = '0'.repeat(64);
      return JSON.stringify(failure);
    });
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

test('Git autocrlf preserves all sixteen sealed outputs, source trees, audio and old/current QA', async () => {
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
    files.push(path.join('examples', '.gitattributes'), path.join('examples', 'delivery-manifest.json'), path.join('examples', 'pptx-publication.json'));
    for (const topic of Object.keys(topics)) await collect(path.join('examples', topic));
    for (const file of [
      'publication.json',
      'projects/html/qa/browser-observations.json', 'projects/image/qa/image-observations.json',
      ...['html', 'image', 'pptx'].map(format => `projects/${format}/qa/agent-review.json`),
    ]) {
      assert(files.includes(path.join('examples', 'aha-introduction', ...file.split('/'))), `Current introduction byte coverage: ${file}`);
    }
    await collect(path.join('evals', 'examples', 'greenland-20260917'));
    await collect(path.join('evals', 'examples', 'code-pilots-20260917'));
    await collect(path.join('evals', 'examples', 'aha-introduction-20260917'));
    const qaFiles = [
      '.gitattributes', 'anc-git/runtime.json', 'anc-git/review.json',
      'anc-git/screenshots/anc-390-light-zh-opening.png',
      'refresh-20260916/final-visual-review.json', 'refresh-20260916/production-status.json',
      ...['anc', 'git-merge'].flatMap(topic => [
        `refresh-20260916/${topic}/browser-observations.json`,
        `refresh-20260916/${topic}/media-check.json`,
      ]),
    ];
    files.push(...qaFiles.map(file => path.join('evals', 'examples', ...file.split('/'))));
    for (const file of files) {
      const target = path.join(workspace, file);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(path.join(root, file), target);
    }
    git('add', '--', 'examples', 'evals');
    // Re-materialize from Git rather than testing a hand-selected text-only subset.
    for (const file of files) await fs.rm(path.join(workspace, file));
    git('checkout-index', '--all', '--force');
    for (const file of files) {
      assert.deepEqual(await fs.readFile(path.join(workspace, file)), await fs.readFile(path.join(root, file)), `${file}: checkout must retain sealed bytes`);
    }
    for (const entry of manifest.requestedOutputs) {
      const { topic, format } = entry;
      const project = path.join('examples', topic, 'projects', format);
      assert.equal(await sourceHash(path.join(workspace, project)), entry.sourceHash);
    }
  } finally { await fs.rm(workspace, { recursive: true, force: true }); }
});
