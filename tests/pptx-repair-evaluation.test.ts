import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import JSZip from 'jszip';
import { hashFiles, sourceFiles } from '../src/artifacts/files.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const harness = path.join(root, 'evals', 'pptx-repair-round');
const { prepareRepairEval, verifyRepairRun, discoverImageLiteral } = await import(
  pathToFileURL(path.join(harness, 'prepare.mjs')).href);
const { inventory, sha256 } = await import(pathToFileURL(path.join(root, 'evals', 'pptx-first-round', 'prepare.mjs')).href);
const { prepareRepairReview, receiptSourceHash } = await import(pathToFileURL(path.join(harness, 'prepare-review.mjs')).href);
const ids = ['git-merge', 'anc', 'greenland', 'aha-introduction'];
const conditions = ['baseline', 'candidate'];
const workspace = path.join(harness, `.fixtures-${randomUUID()}`);
const baseline = path.join(workspace, 'baseline');
const candidate = path.join(workspace, 'candidate');
const seedRunRoot = path.join(workspace, 'first-round-runs');
const commonRuntime = path.join(workspace, 'common', 'scripts', 'aha.mjs');
const commonNotices = path.join(workspace, 'common', 'THIRD-PARTY-NOTICES.txt');
const output = path.join(workspace, 'paired');
const options = { output, baseline, candidate, seedRunRoot, commonRuntime };
let result: Awaited<ReturnType<typeof prepareRepairEval>>;
let originalSeeds: unknown;
let originalBundles: unknown[];
let imagePath: string;
let introductionSource: string;
const readJson = async (file: string) => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
async function write(file: string, contents: string | Buffer) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, contents);
}
async function replace(file: string, content: string | Buffer) {
  await fs.chmod(file, 0o644);
  await fs.writeFile(file, content);
}
async function tamper(file: string, contents: string) {
  const previous = await fs.readFile(file);
  try {
    await replace(file, contents);
    await assert.rejects(verifyRepairRun(output, result.manifest_sha256), /Integrity mismatch|Unexpected seed|Cannot parse/);
  } finally {
    await replace(file, previous);
  }
}

async function syntheticDeck(title: string) {
  const zip = new JSZip();
  const ns = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const relationships = (body: string) => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${body}</Relationships>`;
  const relation = (id: string, type: string, target: string) =>
    `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>');
  zip.file('_rels/.rels', relationships(relation('office', 'officeDocument', 'ppt/presentation.xml')));
  zip.file('ppt/presentation.xml', `<p:presentation ${ns}><p:sldIdLst>${[1, 2, 3, 4, 5].map(n => `<p:sldId id="${255 + n}" r:id="s${n}"/>`).join('')}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`);
  zip.file('ppt/_rels/presentation.xml.rels', relationships([1, 2, 3, 4, 5].map(n => relation(`s${n}`, 'slide', `slides/slide${n}.xml`)).join('')));
  for (let n = 1; n <= 5; n++) {
    zip.file(`ppt/slides/slide${n}.xml`, `<p:sld ${ns}><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${title} ${n}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`);
    zip.file(`ppt/slides/_rels/slide${n}.xml.rels`, relationships(relation('notes', 'notesSlide', `../notesSlides/notesSlide${n}.xml`)));
    zip.file(`ppt/notesSlides/notesSlide${n}.xml`, `<p:notes ${ns}><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>独立备注 ${n}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>`);
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

before(async () => {
  await fs.mkdir(workspace);
  for (const directory of [baseline, candidate]) {
    await write(path.join(directory, 'SKILL.md'), `# ${path.basename(directory)}\r\nRead references/pptx.md.\r\n`);
    await write(path.join(directory, 'references', 'pptx.md'), `Different ${path.basename(directory)} guide\r\n`);
    await write(path.join(directory, 'scripts', 'aha.mjs'), `throw new Error("NEVER EXECUTE ${path.basename(directory)}");\n`);
    await write(path.join(directory, 'THIRD-PARTY-NOTICES.txt'), `Original ${path.basename(directory)} notices\n`);
    const files = await inventory(directory);
    await write(path.join(directory, 'runtime-manifest.json'), JSON.stringify({
      skill: 'aha-explain', schemaVersion: '1.0.0', version: `${path.basename(directory)}-fixture`, node: '>=22',
      files: Object.fromEntries(Object.entries(files).map(([name, file]) => [name, (file as { sha256: string }).sha256])),
    }, null, 2));
  }
  await write(commonRuntime, 'throw new Error("NEVER EXECUTE COMMON RUNTIME IN HARNESS");\r\n');
  await write(commonNotices, 'Common bundled runtime notices: saxes and xmlchars\n');
  imagePath = path.join(seedRunRoot, 'aha-introduction', 'candidate', 'inputs', 'assets', 'original-approved.png');
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
  await write(imagePath, png);
  for (const id of ids) {
    const original = path.join(seedRunRoot, id, 'candidate', 'outputs');
    const project = path.join(original, 'project-repaired');
    const code = `// Byte-exact fixture: 中文\r\nexport default function ({ pptx }) {\r\n` +
      `  const s = pptx.addSlide();\r\n` +
      (id === 'aha-introduction' ? `  s.addImage({ path: ${JSON.stringify(imagePath)}, x: 1, y: 1, w: 2, h: 2 });\r\n` : '') +
      `  s.addNotes('保留来源边界');\r\n}\r\n`;
    if (id === 'aha-introduction') introductionSource = code;
    await write(path.join(project, 'pptx', 'main.mjs'), code);
    await fs.cp(path.join(root, 'examples', id, 'research'), path.join(project, 'research'), { recursive: true });
    const dossier = await readJson(path.join(project, 'research', 'manifest.json'));
    await write(path.join(project, 'artifact.json'), JSON.stringify({
      format: 'pptx', language: 'zh', status: 'authored', researchHash: dossier.contentHash,
    }));
    const deck = await syntheticDeck(`Seed ${id}`);
    await write(path.join(original, 'deck-repaired.pptx'), deck);
    const rendered = path.join(original, 'rendered-repaired');
    const slides = [];
    for (let slide = 1; slide <= 5; slide++) {
      const image = `slide-${String(slide).padStart(2, '0')}.png`;
      await write(path.join(rendered, image), png);
      slides.push({ slide, image, shapes: [{ id: slide, name: 'native table', hasTable: true, hasChart: false }] });
    }
    await write(path.join(rendered, 'contact-01.png'), png);
    await write(path.join(rendered, 'edit-table-cell-03.png'), png);
    await write(path.join(rendered, 'editing-probe.pptx'), 'Not the seed deck; excluded from author inputs.');
    await write(path.join(rendered, 'powerpoint-observations.json'), (id === 'git-merge' ? '\uFEFF' : '') + JSON.stringify({
      application: 'Microsoft PowerPoint', version: 'fixture-only', outputHash: sha256(deck), originalUnchanged: true, slides,
    }));
    await write(path.join(original, 'host-private-analysis.txt'), 'Do not leak old grading answers.');
  }
  originalSeeds = await inventory(seedRunRoot);
  originalBundles = await Promise.all([inventory(baseline), inventory(candidate)]);
  result = await prepareRepairEval(options);
});

after(async () => {
  await fs.rm(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

test('freezes four identical repair seed pairs, one submission budget and pending/null records', async () => {
  const run = result.run;
  assert.equal(run.status, 'prepared-not-authored');
  assert.equal(run.frozen_before_authors, true);
  assert.equal(run.cases.length, 8);
  assert.equal(run.budget.source_submissions, 1);
  assert.match(run.design, /Not fresh generation/);
  assert.deepEqual(Object.values(run.metrics), [null, null, null, null, null]);
  for (const id of ids) {
    const pair = run.cases.filter((row: { id: string }) => row.id === id);
    assert.deepEqual(pair[0].staged_inputs, pair[1].staged_inputs);
    assert.deepEqual(pair[0].initial_output_project, pair[1].initial_output_project);
    for (const entry of pair) {
      const author = entry.author_directory;
      assert.deepEqual(await inventory(path.join(author, 'inputs')), run.seeds[id].files);
      assert.deepEqual(await inventory(path.join(author, 'outputs', 'project')), run.seeds[id].original_project_files);
      assert.ok(entry.staged_inputs['rendered/contact-01.png']);
      assert.ok(entry.staged_inputs['rendered/edit-table-cell-03.png']);
      assert.ok(!entry.staged_inputs['rendered/editing-probe.pptx']);
      assert.ok(!Object.keys(entry.staged_inputs).some(name => /host-private/.test(name)));
      const task = await readJson(path.join(author, 'task.json'));
      assert.equal(task.images.length, 7);
      assert.equal(task.skill, run.bundles[entry.condition].pinned_path);
      assert.match(task.prompt, /5–8 页中文/);
      assert.match(task.prompt, /一次/);
      assert.equal(task.research, path.join('inputs', 'project', 'research'));
      const instructions = await fs.readFile(path.join(author, 'RUN.md'), 'utf8');
      for (const text of ['node --check', 'explain-check', 'STOP', '--allow-code', '所有 PNG', '不是安全沙箱',
        'evaluator', '子代理', '动态 import', 'process', '文件系统', '网络', '不重写路径']) {
        if (text === '不重写路径' && id !== 'aha-introduction') continue;
        assert.ok(instructions.includes(text), text);
      }
      assert.ok(!instructions.includes('explain-init'));
    }
    const metadata = await readJson(path.join(output, 'evaluator', id, 'eval_metadata.json'));
    assert.equal(metadata.paired_delta, null);
    for (const condition of conditions) {
      const record = metadata.conditions[condition];
      assert.equal(record.status, 'pending');
      assert.equal(record.submission_count, 0);
      assert.equal(record.powerpoint_review, null);
      assert.equal(record.execution_approval, null);
      assert.deepEqual(Object.values(record.metrics), [null, null, null, null, null]);
      assert.ok(record.judgments.every((row: { status: string; score: unknown; delta: string }) =>
        row.status === 'pending' && row.score === null && row.delta === 'pending'));
    }
  }
  assert.deepEqual(await inventory(seedRunRoot), originalSeeds);
  assert.deepEqual(await Promise.all([inventory(baseline), inventory(candidate)]), originalBundles);
});

test('all PPT evaluation entry points use the introduction corpus instead of the retired overview', async () => {
  const protocol = await readJson(path.join(harness, 'protocol.json'));
  const corpus = await readJson(path.join(root, 'evals', 'pptx-first-round', 'cases.json'));
  assert.equal(protocol.corpus_revision, corpus.corpus_revision);
  assert.deepEqual(protocol.case_ids, ids);
  assert.deepEqual(corpus.cases.map((item: { id: string }) => item.id), ids);
  for (const file of [
    path.join(harness, 'compose-pages.ps1'),
    path.join(harness, 'prepare.mjs'),
    path.join(root, 'evals', 'pptx-first-round', 'verify-run.mjs'),
  ]) {
    const source = await fs.readFile(file, 'utf8');
    for (const id of ids) assert(source.includes(`'${id}'`), `${file}: missing ${id}`);
    assert(!source.includes('project-overview'), `${file}: retired case`);
  }
});

test('accepts PowerShell BOM observations while preserving original seed bytes and hashes', async () => {
  const relative = path.join('rendered', 'powerpoint-observations.json');
  const original = await fs.readFile(path.join(seedRunRoot, 'git-merge', 'candidate', 'outputs',
    'rendered-repaired', 'powerpoint-observations.json'));
  assert.equal(original.subarray(0, 3).toString('hex'), 'efbbbf');
  assert.equal(result.run.seeds['git-merge'].files['rendered/powerpoint-observations.json'].sha256, sha256(original));
  for (const directory of [path.join(output, 'seeds', 'git-merge'),
    ...conditions.map(condition => path.join(output, 'git-merge', condition, 'inputs'))]) {
    assert.deepEqual(await fs.readFile(path.join(directory, relative)), original);
  }
});

test('overlays identical runtime/notices and regenerates own complete release manifests without altering guides', async () => {
  const runtime = await fs.readFile(commonRuntime);
  const notices = await fs.readFile(commonNotices);
  for (const condition of conditions) {
    const bundle = result.run.bundles[condition];
    assert.notEqual(bundle.original_files['scripts/aha.mjs'].sha256, sha256(runtime));
    assert.equal(bundle.used_files['scripts/aha.mjs'].sha256, sha256(runtime));
    assert.equal(bundle.used_inventory_sha256, sha256(`${JSON.stringify(bundle.used_files, null, 2)}\n`));
    assert.deepEqual(await fs.readFile(path.join(bundle.pinned_path, 'scripts', 'aha.mjs')), runtime);
    assert.deepEqual(await fs.readFile(path.join(bundle.pinned_path, 'THIRD-PARTY-NOTICES.txt')), notices);
    assert.equal(bundle.used_files['THIRD-PARTY-NOTICES.txt'].sha256, sha256(notices));
    const manifest = await readJson(path.join(bundle.pinned_path, 'runtime-manifest.json'));
    assert.equal(manifest.version, `${condition}-fixture`, 'retain own manifest metadata, not candidate metadata');
    assert.ok(!manifest.files['runtime-manifest.json']);
    assert.deepEqual(manifest.files, Object.fromEntries(Object.entries(bundle.used_files)
      .filter(([name]) => name !== 'runtime-manifest.json').map(([name, file]) => [name, (file as { sha256: string }).sha256])));
    for (const name of ['SKILL.md', 'references/pptx.md']) {
      assert.deepEqual(bundle.used_files[name], bundle.original_files[name]);
    }
  }
  assert.equal(result.run.common_runtime.sha256, sha256(runtime));
  assert.equal(result.run.common_runtime.notices.sha256, sha256(notices));
  assert.equal((await verifyRepairRun(output, result.manifest_sha256)).pairs, 4);
});

test('preserves introduction CRLF source and the discovered external addImage literal byte for byte', async () => {
  const approved = result.run.seeds['aha-introduction'].approved_image;
  assert.equal(approved.path, imagePath);
  assert.equal(approved.literal, JSON.stringify(imagePath));
  assert.equal(approved.source_line, 4);
  assert.equal(approved.sha256, sha256(await fs.readFile(imagePath)));
  for (const condition of conditions) {
    const author = path.join(output, 'aha-introduction', condition);
    for (const area of ['inputs', 'outputs']) {
      assert.equal(await fs.readFile(path.join(author, area, 'project', 'pptx', 'main.mjs'), 'utf8'), introductionSource);
    }
    assert.deepEqual(await fs.readFile(path.join(author, 'inputs', 'assets', 'approved-image.png')), await fs.readFile(imagePath));
    assert.deepEqual((await readJson(path.join(author, 'task.json'))).approved_image, approved);
  }
  assert.throws(() => discoverImageLiteral('s.addImage({path: getPath()});', 'aha-introduction'), /literal/);
  assert.throws(() => discoverImageLiteral(`s.addImage({path: ${JSON.stringify(imagePath)}});`, 'anc'), /Unexpected/);
  assert.throws(() => discoverImageLiteral('s.addImage(options);', 'aha-introduction'), /explicit object/);
  assert.throws(() => discoverImageLiteral('s.addImage({path: "relative.png"});', 'aha-introduction'), /absolute PNG/);
});

test('rubric stays evaluator-only with concrete evidence locators and unverified judgments, not an aesthetic score', async () => {
  const protocol = await readJson(path.join(harness, 'protocol.json'));
  for (const id of ids) {
    const rubric = await readJson(path.join(output, 'evaluator', id, 'rubric.json'));
    assert.ok(rubric.judgment_statuses.includes('unverified'));
    assert.ok(rubric.delta_statuses.includes('unchanged'));
    assert.ok(rubric.criteria.some((row: { id: string }) => row.id === 'table-clearance-repair'));
    assert.ok(rubric.criteria.some((row: { id: string }) => row.id === 'stage-notes-separation'));
    assert.equal(rubric.seed_native_object_locators[0].pointer, '/slides/0/shapes/0');
    assert.equal(rubric.evidence_schema.before.sha256, null);
    for (const condition of conditions) {
      const author = path.join(output, id, condition);
      const files = await inventory(author);
      assert.ok(!Object.keys(files).some(name => /rubric|protocol|evaluator/.test(name)));
      const packet = await fs.readFile(path.join(author, 'task.json'), 'utf8') +
        await fs.readFile(path.join(author, 'RUN.md'), 'utf8');
      for (const row of protocol.repair_criteria) {
        assert.ok(!packet.includes(row.id));
        assert.ok(!packet.includes(row.criterion));
      }
    }
  }
});

test('refuses existing output roots, overlapping inputs and relative required arguments', async () => {
  await assert.rejects(prepareRepairEval(options), /already exists/);
  const empty = path.join(workspace, 'empty');
  await fs.mkdir(empty);
  await assert.rejects(prepareRepairEval({ ...options, output: empty }), /already exists/);
  await assert.rejects(prepareRepairEval({ ...options, output: path.join(baseline, 'nested') }), /overlap/);
  for (const argument of ['baseline', 'candidate', 'seedRunRoot', 'commonRuntime']) {
    await assert.rejects(prepareRepairEval({ ...options, output: path.join(workspace, `relative-${argument}`),
      [argument]: 'relative' }), /absolute/);
  }
});

test('rejects mismatched seed deck observations before creating the output directory', async () => {
  const file = path.join(seedRunRoot, 'anc', 'candidate', 'outputs', 'rendered-repaired', 'powerpoint-observations.json');
  const before = await fs.readFile(file);
  const invalid = path.join(workspace, 'invalid-deck');
  try {
    const observation = JSON.parse(before.toString());
    observation.outputHash = 'f'.repeat(64);
    await fs.writeFile(file, JSON.stringify(observation));
    await assert.rejects(prepareRepairEval({ ...options, output: invalid }), /observations\/deck identity/);
    await assert.rejects(fs.lstat(invalid), { code: 'ENOENT' });
  } finally {
    await fs.writeFile(file, before);
  }
});

test('rejects renamed stale introduction research and mismatched metadata before freezing', async () => {
  const project = path.join(seedRunRoot, 'aha-introduction', 'candidate', 'outputs', 'project-repaired');
  for (const [relative, expected] of [
    [path.join('research', 'manifest.json'), /seed research must match current corpus: aha-introduction/],
    [path.join('research', 'report.md'), /seed research must match current corpus: aha-introduction/],
    ['artifact.json', /seed artifact research identity: aha-introduction/],
  ] as const) {
    const file = path.join(project, relative);
    const previous = await fs.readFile(file);
    const invalid = path.join(workspace, `stale-research-${path.basename(relative)}`);
    try {
      await fs.writeFile(file, relative.endsWith('.json')
        ? JSON.stringify({ ...JSON.parse(previous.toString()), contentHash: '0'.repeat(64), researchHash: '0'.repeat(64) })
        : '# Retired overview research under a new directory name.\n');
      await assert.rejects(prepareRepairEval({ ...options, output: invalid }), expected);
      await assert.rejects(fs.lstat(invalid), { code: 'ENOENT' });
    } finally {
      await fs.writeFile(file, previous);
    }
  }
});

test('detects seed, paired input, task, guide, runtime, protocol and external asset tampering', async () => {
  await tamper(path.join(output, 'seeds', 'anc', 'project', 'pptx', 'main.mjs'), '// changed');
  await tamper(path.join(output, 'anc', 'candidate', 'inputs', 'rendered', 'slide-01.png'), 'changed image');
  await tamper(path.join(output, 'anc', 'baseline', 'task.json'), '{}');
  await tamper(path.join(output, 'anc', 'baseline', 'RUN.md'), 'leaked answers');
  await tamper(path.join(output, 'bundles', 'baseline', 'aha-explain', 'SKILL.md'), 'changed guide');
  await tamper(path.join(output, 'bundles', 'candidate', 'aha-explain', 'scripts', 'aha.mjs'), 'different runtime');
  await tamper(path.join(output, 'bundles', 'candidate', 'aha-explain', 'THIRD-PARTY-NOTICES.txt'), 'wrong dependency notices');
  await tamper(path.join(output, 'bundles', 'baseline', 'aha-explain', 'runtime-manifest.json'), '{}');
  await tamper(path.join(output, 'evaluator', 'source', 'protocol.json'), '{}');
  await tamper(path.join(output, 'evaluator', 'runtime', 'aha.mjs'), 'other runtime');
  await tamper(imagePath, 'changed external image');
  const injected = path.join(output, 'anc', 'candidate', 'inputs', 'unrecorded.txt');
  await fs.writeFile(injected, 'extra input');
  try {
    await assert.rejects(verifyRepairRun(output, result.manifest_sha256), /paired frozen inputs/);
  } finally {
    await fs.unlink(injected);
  }
  await assert.rejects(verifyRepairRun(output, '0'.repeat(64)), /manifest SHA-256/);
  assert.equal((await verifyRepairRun(output, result.manifest_sha256)).status, 'frozen-integrity-and-pairs-verified');
});

test('verification excludes author outputs and mutable observations, and never implies quality or execution approval', async () => {
  await fs.writeFile(path.join(output, 'anc', 'candidate', 'outputs', 'project', 'pptx', 'main.mjs'),
    'throw new Error("Verification must not execute or inspect this output");');
  const record = path.join(output, 'evaluator', 'anc', 'eval_metadata.json');
  const metadata = await readJson(record);
  metadata.conditions.candidate.observations.push({ note: 'Host record is deliberately mutable.' });
  await fs.writeFile(record, JSON.stringify(metadata));
  const verified = await verifyRepairRun(output, result.manifest_sha256);
  assert.equal(verified.outputs_checked, false);
  assert.equal(verified.behavior_verified, false);
  assert.equal(verified.quality_verified, false);
  const cli = spawnSync(process.execPath, [path.join(harness, 'verify.mjs'), output, result.manifest_sha256], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(JSON.parse(cli.stdout).pairs, 4);
});

const review = path.join(workspace, 'neutral-review');
async function finalOutputFixtures() {
  const baseTime = Date.now() + 1000;
  for (const id of ids) {
    for (const [index, condition] of conditions.entries()) {
      const directory = path.join(output, id, condition, 'outputs');
      const project = path.join(directory, 'project');
      const deck = await syntheticDeck(`Repaired ${id} variation ${index + 1}`);
      const observation = await readJson(path.join(output, 'seeds', id, 'rendered', 'powerpoint-observations.json'));
      observation.outputHash = sha256(deck);
      observation.edits = [{ slide: 1, id: 1, type: 'text', persisted: true }];
      const source = await receiptSourceHash(project);
      assert.equal(source, hashFiles(await sourceFiles(project)), 'receipt framing must match the actual runtime');
      const receipt = {
        sourceHash: source, outputHash: sha256(deck),
        researchHash: (await readJson(path.join(project, 'artifact.json'))).researchHash, output: 'deck.pptx',
        format: 'pptx', status: 'delivered', slides: 5, codeExecuted: true,
      };
      await write(path.join(directory, 'deck.pptx'), deck);
      await write(path.join(directory, 'deck.pptx.receipt.json'), JSON.stringify(receipt));
      for (const name of ['deck.pptx', 'deck.pptx.receipt.json']) {
        await fs.utimes(path.join(directory, name), new Date(baseTime), new Date(baseTime));
      }
      for (const name of [...observation.slides.map((slide: { image: string }) => slide.image), 'contact-01.png']) {
        const bytes = await fs.readFile(path.join(output, 'seeds', id, 'rendered', name));
        await write(path.join(directory, 'rendered', name), bytes);
        await fs.utimes(path.join(directory, 'rendered', name), new Date(baseTime + 1000), new Date(baseTime + 1000));
      }
      await write(path.join(directory, 'rendered', 'powerpoint-observations.json'), JSON.stringify(observation));
      await fs.utimes(path.join(directory, 'rendered', 'powerpoint-observations.json'),
        new Date(baseTime + 2000), new Date(baseTime + 2000));
    }
  }
}

test('neutral review rejects stale deck observations, receipts, source changes and stale or missing PNGs before staging', async () => {
  await finalOutputFixtures();
  const directory = path.join(output, 'anc', 'candidate', 'outputs');
  async function rejectChanged(name: string, transform: (bytes: Buffer) => Buffer | string, pattern: RegExp) {
    const file = path.join(directory, ...name.split('/'));
    const previous = await fs.readFile(file);
    const stat = await fs.stat(file);
    try {
      await fs.writeFile(file, transform(previous));
      await fs.utimes(file, stat.atime, stat.mtime);
      await assert.rejects(prepareRepairReview({ runRoot: output, destination: review,
        manifestSha256: result.manifest_sha256 }), pattern);
      await assert.rejects(fs.lstat(review), { code: 'ENOENT' });
      await assert.rejects(fs.lstat(path.join(output, 'evaluator', 'review-mapping.json')), { code: 'ENOENT' });
    } finally {
      await fs.writeFile(file, previous);
      await fs.utimes(file, stat.atime, stat.mtime);
    }
  }
  await rejectChanged('rendered/powerpoint-observations.json', bytes =>
    JSON.stringify({ ...JSON.parse(bytes.toString()), outputHash: '0'.repeat(64) }), /Stale rendering/);
  await rejectChanged('deck.pptx.receipt.json', bytes =>
    JSON.stringify({ ...JSON.parse(bytes.toString()), sourceHash: '0'.repeat(64) }), /Stale source\/output receipt/);
  await rejectChanged('project/pptx/main.mjs', bytes => `${bytes.toString()}\n// Later revision`, /Stale source\/output receipt/);
  const slide = path.join(directory, 'rendered', 'slide-01.png');
  const stat = await fs.stat(slide);
  try {
    await fs.utimes(slide, new Date(0), new Date(0));
    await assert.rejects(prepareRepairReview({ runRoot: output, destination: review }), /Stale image\/probe timestamp/);
  } finally {
    await fs.utimes(slide, stat.atime, stat.mtime);
  }
  const png = await fs.readFile(slide);
  try {
    await fs.unlink(slide);
    await assert.rejects(prepareRepairReview({ runRoot: output, destination: review }), /Missing\/nonsequential slide image/);
  } finally {
    await fs.writeFile(slide, png);
    await fs.utimes(slide, stat.atime, stat.mtime);
  }
  assert.equal(await fs.lstat(review).then(() => true, () => false), false);
});

test('stages exactly two neutral scored runs and an unscored common BEFORE, with mapping only in evaluator', async () => {
  const prepared = await prepareRepairReview({ runRoot: output, destination: review, manifestSha256: result.manifest_sha256 });
  assert.equal(prepared.scored_runs, 8);
  assert.equal(prepared.cases, 4);
  assert.equal(prepared.before_stage, 'before-second-round-repair-only-common-seed');
  assert.equal(prepared.after_stage, 'after-second-round-repair-only-single-submission');
  const mapping = await readJson(path.join(output, 'evaluator', 'review-mapping.json'));
  assert.equal(mapping.mappings.length, 8);
  const reviewFiles = await inventory(review);
  assert.deepEqual(reviewFiles, mapping.review_files);
  assert.ok(!Object.keys(reviewFiles).some(name => /mapping|baseline|candidate/.test(name)));
  for (const id of ids) {
    const caseRoot = path.join(review, id);
    const before = path.join(caseRoot, 'before');
    assert.deepEqual(await fs.readFile(path.join(before, 'deck.pptx')),
      await fs.readFile(path.join(output, 'seeds', id, 'deck.pptx')));
    assert.deepEqual(await fs.readFile(path.join(before, 'slide-01.png')),
      await fs.readFile(path.join(output, 'seeds', id, 'rendered', 'slide-01.png')));
    assert.equal((await readJson(path.join(before, 'ooxml.json'))).slides[0].notes[0].paragraphs[0].text, '独立备注 1');
    assert.equal((await readJson(path.join(before, 'stage.json'))).stage, prepared.before_stage);
    assert.ok((await fs.stat(path.join(before, 'research', 'report.md'))).isFile());
    await assert.rejects(fs.lstat(path.join(before, 'outputs')), { code: 'ENOENT' });
    const scored = [];
    for (const name of await fs.readdir(caseRoot)) {
      if (await fs.stat(path.join(caseRoot, name, 'outputs')).then(stat => stat.isDirectory(), () => false)) scored.push(name);
    }
    assert.deepEqual(scored.sort(), ['A', 'B'], 'stock viewer must not discover a third before/outputs run');
    for (const label of ['A', 'B']) {
      const run = path.join(caseRoot, label);
      const entry = mapping.mappings.find((row: { case: string; label: string }) => row.case === id && row.label === label);
      const bytes = await fs.readFile(path.join(run, 'outputs', 'deck.pptx'));
      assert.equal(sha256(bytes), entry.outputHash);
      assert.equal((await readJson(path.join(run, 'outputs', 'ooxml.json'))).package_sha256, entry.outputHash);
      assert.equal((await readJson(path.join(run, 'application-observations.json'))).stage, prepared.after_stage);
      assert.equal((await readJson(path.join(run, 'delivery-identity.json'))).sourceHash, entry.sourceHash);
      await assert.rejects(fs.lstat(path.join(run, 'outputs', 'application-observations.json')), { code: 'ENOENT' });
    }
    const metadata = await readJson(path.join(caseRoot, 'eval_metadata.json'));
    assert.deepEqual(metadata.scored_runs, ['A', 'B']);
    assert.equal(metadata.before_is_scored_run, false);
    assert.equal((await readJson(path.join(caseRoot, 'rubric.json'))).seed_native_object_locators[0].artifact,
      'before/application-observations.json');
  }
  assert.equal((await verifyRepairRun(output, result.manifest_sha256)).pairs, 4, 'host-only mapping does not invalidate frozen inputs');
  await assert.rejects(prepareRepairReview({ runRoot: output, destination: review }), /already exists/);
  await assert.rejects(prepareRepairReview({ runRoot: output, destination: path.join(workspace, 'second-review') }), /review-mapping/);
  await assert.rejects(prepareRepairReview({ runRoot: output, destination: path.join(output, 'review') }), /disjoint/);
});
