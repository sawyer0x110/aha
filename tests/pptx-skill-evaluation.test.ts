import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import JSZip from 'jszip';

const root = fileURLToPath(new URL('../', import.meta.url));
const harness = path.join(root, 'evals', 'pptx-first-round');
const prepare = await import(pathToFileURL(path.join(harness, 'prepare.mjs')).href);
const inspect = await import(pathToFileURL(path.join(harness, 'inspect.mjs')).href);
const verifier = await import(pathToFileURL(path.join(harness, 'verify-run.mjs')).href);
const reviewer = await import(pathToFileURL(path.join(harness, 'prepare-review.mjs')).href);
const readJson = async (file: string) => JSON.parse(await fs.readFile(file, 'utf8'));
let workspace: string;
let baseline: string;
let candidate: string;
let output: string;
let run: Awaited<ReturnType<typeof prepare.preparePptxEval>>;
let fixedCasesBefore: unknown;

async function fixedCaseInventory() {
  const files = await prepare.inventory(path.join(root, 'evals', 'skills'));
  return Object.fromEntries(Object.entries(files).filter(([file]) => !['scenarios.json', 'prepare.mjs'].includes(file)));
}

before(async () => {
  await fs.mkdir(path.join(root, 'dist'), { recursive: true });
  workspace = await fs.mkdtemp(path.join(root, 'dist', '.pptx-evaluation-test-'));
  baseline = path.join(workspace, 'baseline');
  candidate = path.join(workspace, 'candidate');
  for (const directory of [baseline, candidate]) {
    await fs.mkdir(path.join(directory, 'scripts'), { recursive: true });
    await fs.mkdir(path.join(directory, 'references'));
    await fs.writeFile(path.join(directory, 'SKILL.md'), `# ${path.basename(directory)}\r\nFrozen dummy bundle\n`);
    await fs.writeFile(path.join(directory, 'scripts', 'aha.mjs'), 'throw new Error("Test double must never execute");\n');
    await fs.writeFile(path.join(directory, 'references', 'pptx.md'), 'Pinned guide\n');
  }
  fixedCasesBefore = await fixedCaseInventory();
  output = path.join(workspace, 'paired');
  run = await prepare.preparePptxEval({ output, baseline, candidate });
});

after(async () => {
  if (workspace) await fs.rm(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

test('preparation freezes four paired cases, actual bytes, bundles and evaluator-only criteria before generation', async () => {
  assert.equal(run.status, 'prepared-not-generated');
  assert.equal(run.frozen_before_generation, true);
  assert.equal(run.cases.length, 8);
  assert.match(run.isolation, /no OS isolation/);
  assert.deepEqual(Object.values(run.metrics), [null, null, null, null, null]);
  const corpus = await readJson(path.join(harness, 'cases.json'));
  assert.equal(corpus.corpus_revision, 'current-topics-20260922');
  assert.deepEqual(corpus.cases.map((item: { id: string }) => item.id), ['cpython-string', 'anc', 'greenland', 'aha-introduction']);
  const introduction = corpus.cases.find((item: { id: string }) => item.id === 'aha-introduction');
  assert.equal(introduction.research, 'examples/aha-introduction/research');
  const dossier = await readJson(path.join(root, introduction.research, 'manifest.json'));
  assert.equal(dossier.contentHash, '6f94bda3a3e6330d31104e59a332a397ee1e0e79deae0946e4b970d9bc630c8d');
  assert.match(introduction.prompt, /2026-09-17/);
  for (const mechanism of ['格陵兰', 'CPython', 'Docker']) {
    assert.ok(introduction.prompt.includes(mechanism));
    assert.ok(introduction.rubric.some((row: { criterion: string }) => row.criterion.includes(mechanism)));
  }
  for (const item of corpus.cases) {
    const a = run.cases.find((entry: { id: string; condition: string }) => entry.id === item.id && entry.condition === 'baseline');
    const b = run.cases.find((entry: { id: string; condition: string }) => entry.id === item.id && entry.condition === 'candidate');
    assert.deepEqual(a.staged_inputs, b.staged_inputs);
    assert.deepEqual(a.input_source, b.input_source);
    const tasks = [];
    for (const entry of [a, b]) {
      const task = await readJson(path.join(entry.author_directory, 'task.json'));
      tasks.push(task);
      assert.match(task.prompt, /5–8/);
      assert.match(task.prompt, /中文/);
      assert.equal(task.skill, run.bundles[entry.condition].pinned_path);
      assert.equal(task.project, path.join('outputs', 'project'));
      assert.deepEqual(await fs.readdir(path.join(entry.author_directory, 'outputs')), []);
      assert.deepEqual(await prepare.inventory(path.join(entry.author_directory, 'inputs')), entry.staged_inputs);
      for (const [file, hash] of Object.entries(entry.input_source.files)) {
        assert.deepEqual(entry.staged_inputs[`research/${file}`], hash);
      }
      assert.deepEqual(Object.keys(entry.staged_inputs).filter(file => file.startsWith('assets/')),
        item.id === 'aha-introduction' ? ['assets/git-slide-03.png'] : []);
      if (task.approved_image_path) {
        assert.equal(prepare.sha256(await fs.readFile(task.approved_image_path)), entry.input_source.asset.sha256);
        assert.match(task.prompt, /历史幻灯片截图/);
      }
      const instructions = await fs.readFile(path.join(entry.author_directory, 'RUN.md'), 'utf8');
      assert.ok(instructions.includes('explain-init inputs\\research pptx outputs\\project --language zh'));
      assert.ok(instructions.includes('explain-check outputs\\project'));
      assert.match(instructions, /STOP/);
      assert.match(instructions, /共享文件系统/);
      assert.match(instructions, /禁止新增 import/);
      assert.match(instructions, /禁止读取兄弟案例/);
      for (const [file, expected] of Object.entries(entry.task_files) as Array<[string, { sha256: string }]>) {
        assert.equal(prepare.sha256(await fs.readFile(path.join(entry.author_directory, file))), expected.sha256);
      }
      const authorFiles = await prepare.inventory(entry.author_directory);
      assert.ok(Object.keys(authorFiles).every(file => ['task.json', 'RUN.md'].includes(file) || file.startsWith('inputs/')));
      const rubric = await readJson(path.join(output, 'evaluator', item.id, 'rubric.json'));
      for (const criterion of rubric.criteria) {
        assert.ok(!JSON.stringify(task).includes(criterion.criterion));
        assert.ok(!instructions.includes(criterion.criterion));
      }
    }
    assert.equal(tasks[0].prompt, tasks[1].prompt);
    const metadata = await readJson(path.join(output, 'evaluator', item.id, 'eval_metadata.json'));
    for (const condition of Object.values(metadata.conditions) as any[]) {
      assert.equal(condition.status, 'pending');
      assert.deepEqual(condition.observations, []);
      assert.ok(condition.judgments.every((judgment: any) => judgment.status === 'pending' && judgment.score === null && !judgment.evidence.length));
      assert.equal(condition.execution_approval, null);
      assert.equal(condition.powerpoint_review, null);
    }
  }
  for (const condition of ['baseline', 'candidate']) {
    const bundle = run.bundles[condition];
    assert.deepEqual(await prepare.inventory(bundle.pinned_path), await prepare.inventory(bundle.original_path));
    assert.equal(bundle.inventory_sha256, prepare.sha256(`${JSON.stringify(bundle.files, null, 2)}\n`));
    const pinnedBytes = await fs.readFile(path.join(bundle.pinned_path, 'SKILL.md'), 'utf8');
    assert.ok(pinnedBytes.includes('\r\n'), 'Hash/copy raw bytes, not normalized text');
  }
  assert.notEqual(run.bundles.baseline.inventory_sha256, run.bundles.candidate.inventory_sha256);
  for (const [file, expected] of Object.entries(run.source_files) as Array<[string, { sha256: string }]>) {
    assert.equal(prepare.sha256(await fs.readFile(path.join(harness, file))), expected.sha256);
    assert.equal(prepare.sha256(await fs.readFile(path.join(output, 'evaluator', 'source', file))), expected.sha256);
  }
  for (const [file, expected] of Object.entries(run.evaluator_files) as Array<[string, { sha256: string }]>) {
    assert.equal(prepare.sha256(await fs.readFile(path.join(output, 'evaluator', ...file.split('/')))), expected.sha256);
  }
  assert.deepEqual(await fixedCaseInventory(), fixedCasesBefore);
});

test('prepare refuses overwrites, escaping paths, incomplete bundles and overlapping roots', async () => {
  await assert.rejects(prepare.preparePptxEval({ output, baseline, candidate }), /already exists/);
  const empty = path.join(workspace, 'empty');
  await fs.mkdir(empty);
  await assert.rejects(prepare.preparePptxEval({ output: empty, baseline, candidate }), /already exists/);
  await assert.rejects(prepare.preparePptxEval({ output: path.join(workspace, 'relative-bundle'), baseline: '.', candidate }), /absolute/);
  await assert.rejects(prepare.preparePptxEval({ output: `${workspace}${path.sep}..${path.sep}escape`, baseline, candidate }), /Escaping/);
  await assert.rejects(prepare.preparePptxEval({ output: path.join(baseline, 'nested'), baseline, candidate }), /overlap/);
  await assert.rejects(prepare.preparePptxEval({ output: path.join(workspace, 'incomplete'), baseline: empty, candidate }), /Incomplete/);
  for (const relative of ['../bad', '/absolute', 'a\\b', 'a/../b', 'C:stream', 'NUL.txt', 'file.']) {
    assert.throws(() => prepare.safeRelative(relative), /Unsafe/);
  }
  const cli = spawnSync(process.execPath, [path.join(harness, 'prepare.mjs'), empty, '--baseline', baseline, '--candidate', candidate], { encoding: 'utf8' });
  assert.equal(cli.status, 1);
  assert.match(cli.stderr, /already exists/);
});

test('prepare rejects junctions in output ancestors and bundle contents', async t => {
  const link = path.join(workspace, 'junction');
  try {
    await fs.symlink(baseline, link, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error: any) {
    if (['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) return t.skip('Host cannot create links for rejection test');
    throw error;
  }
  await assert.rejects(prepare.preparePptxEval({ output: path.join(link, 'run'), baseline, candidate }), /Symlink/);
  await assert.rejects(prepare.preparePptxEval({ output: path.join(workspace, 'linked-input'), baseline: link, candidate }), /Symlink/);
  const embeddedLink = path.join(candidate, 'linked');
  await fs.symlink(baseline, embeddedLink, process.platform === 'win32' ? 'junction' : 'dir');
  try {
    await assert.rejects(prepare.preparePptxEval({ output: path.join(workspace, 'embedded-link'), baseline, candidate }), /Symlink/);
  } finally {
    await fs.unlink(embeddedLink);
    await fs.unlink(link);
  }
});

const rels = (body: string) => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${body}</Relationships>`;
const rel = (id: string, kind: string, target: string) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${kind}" Target="${target}"/>`;
const ns = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const paragraph = (value: string) => `<a:p><a:r><a:rPr sz="2400"><a:ea typeface="Microsoft YaHei"/></a:rPr><a:t>${value}</a:t></a:r></a:p>`;
const frame = '<a:xfrm><a:off x="914400" y="914400"/><a:ext cx="1828800" cy="914400"/></a:xfrm>';

function syntheticPptx() {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>');
  zip.file('_rels/.rels', rels(rel('office', 'officeDocument', 'ppt/presentation.xml')));
  zip.file('ppt/presentation.xml', `<p:presentation ${ns}><p:sldIdLst><p:sldId id="256" r:id="second"/><p:sldId id="257" r:id="first"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`);
  zip.file('ppt/_rels/presentation.xml.rels', rels(rel('second', 'slide', 'slides/slide2.xml') + rel('first', 'slide', 'slides/slide1.xml')));
  const cell = `<a:tc><a:txBody>${paragraph('重复')}</a:txBody><a:tcPr/></a:tc>`;
  zip.file('ppt/slides/slide2.xml', `<p:sld ${ns}><p:cSld><p:spTree>
    <p:sp><p:nvSpPr><p:cNvPr id="1" name="标题"/></p:nvSpPr><p:spPr>${frame}</p:spPr><p:txBody>${paragraph('中文 &amp; 安全 &#x4E2D;')}</p:txBody></p:sp>
    <p:graphicFrame><p:xfrm><a:off x="0" y="0"/><a:ext cx="1828800" cy="914400"/></p:xfrm><a:graphic><a:graphicData><a:tbl><a:tblGrid><a:gridCol w="914400"/><a:gridCol w="914400"/></a:tblGrid><a:tr h="914400">${cell}${cell}</a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>
    <p:graphicFrame><a:graphic><a:graphicData><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="chart"/></a:graphicData></a:graphic></p:graphicFrame>
    <p:pic><p:blipFill><a:blip r:embed="image"/></p:blipFill><p:spPr>${frame}</p:spPr></p:pic>
    <p:grpSp><p:sp><p:spPr>${frame}</p:spPr><p:txBody>${paragraph('分组')}</p:txBody></p:sp></p:grpSp>
    <p:cxnSp><p:spPr><a:xfrm rot="5400000"><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm></p:spPr></p:cxnSp>
    </p:spTree></p:cSld></p:sld>`);
  zip.file('ppt/slides/slide1.xml', `<p:sld ${ns}><p:cSld><p:spTree><p:sp><p:spPr><a:xfrm><a:off x="-1" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm></p:spPr><p:txBody>${paragraph('第二页')}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`);
  zip.file('ppt/slides/_rels/slide2.xml.rels', rels(rel('notes', 'notesSlide', '../notesSlides/notesSlide1.xml') + rel('chart', 'chart', '../charts/chart1.xml') + rel('image', 'image', '../media/image1.png')));
  zip.file('ppt/notesSlides/notesSlide1.xml', `<p:notes ${ns}><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><p:txBody>${paragraph('备注限定，不是幻灯片正文')}</p:txBody></p:sp></p:spTree></p:cSld></p:notes>`);
  zip.file('ppt/charts/chart1.xml', '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart><c:plotArea><c:barChart><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>面积</c:v></c:tx><c:cat><c:strRef><c:f>Sheet1!$A$2:$A$3</c:f><c:strCache><c:ptCount val="2"/><c:pt idx="0"><c:v>格陵兰</c:v></c:pt><c:pt idx="1"><c:v>非洲</c:v></c:pt></c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>Sheet1!$B$2:$B$3</c:f><c:numCache><c:formatCode>0</c:formatCode><c:ptCount val="2"/><c:pt idx="0"><c:v>2166086</c:v></c:pt><c:pt idx="1"><c:v>30365000</c:v></c:pt></c:numCache></c:numRef></c:val></c:ser></c:barChart></c:plotArea></c:chart></c:chartSpace>');
  zip.file('ppt/media/image1.png', Buffer.from('synthetic binary; not rendered'));
  return zip;
}

test('static OOXML extraction preserves slide order, Chinese runs, repeated table cells, chart caches and separate notes', async () => {
  const report = await inspect.inspectPptxBytes(await syntheticPptx().generateAsync({ type: 'nodebuffer' }));
  assert.equal(report.inspection, 'static-ooxml-only');
  assert.equal(report.slides[0].part, 'ppt/slides/slide2.xml');
  assert.equal(report.slides[1].part, 'ppt/slides/slide1.xml');
  const slide = report.slides[0];
  assert.equal(slide.paragraphs[0].text, '中文 & 安全 中');
  assert.equal(slide.paragraphs[0].runs[0].fonts[0].typeface, 'Microsoft YaHei');
  assert.equal(slide.paragraphs.filter((p: any) => p.text === '重复').length, 2);
  const table = slide.objects.find((object: any) => object.tables.length).tables[0];
  assert.deepEqual(table.rows[0].cells.map((cell: any) => cell.text), ['重复', '重复']);
  assert.equal(slide.notes[0].paragraphs[0].text, '备注限定，不是幻灯片正文');
  assert.equal(slide.notes[0].placeholders[0].type, 'body');
  assert.ok(!slide.paragraphs.some((p: any) => p.text.includes('备注')));
  const chart = report.charts['ppt/charts/chart1.xml'];
  assert.deepEqual(chart.types, ['barChart']);
  assert.deepEqual(chart.series[0].data[0].direct_values, ['面积']);
  assert.deepEqual(chart.series[0].data[1].caches[0].points.map((point: any) => point.value), ['格陵兰', '非洲']);
  assert.deepEqual(chart.series[0].data[2].caches[0].points.map((point: any) => point.value), ['2166086', '30365000']);
  assert.equal(slide.objects.find((object: any) => object.charts.length).charts[0].relationship.part, 'ppt/charts/chart1.xml');
  assert.equal(slide.objects.find((object: any) => object.pictures.length).pictures[0].relationship.part, 'ppt/media/image1.png');
  assert.equal(slide.objects[0].geometry.frame_inches.x, 1);
  assert.equal(slide.objects[0].geometry.outside_page_frame, false);
  assert.equal(report.slides[1].objects[0].geometry.outside_page_frame, true);
  assert.equal(slide.objects.find((object: any) => object.grouped).geometry.outside_page_frame, null);
  assert.equal(slide.objects.find((object: any) => object.kind === 'cxnSp').geometry.text_fit, 'not-verified');
  assert.equal(slide.objects.find((object: any) => object.kind === 'cxnSp').geometry.frame_inches, null);
  assert.equal(report.judgments, null);
  assert.equal(report.powerpoint_review, null);
  assert.ok(report.limitations.some((limit: string) => limit.includes('NOT VERIFIED')));
  assert.ok(report.binary_parts['ppt/media/image1.png'].sha256);
});

test('inspector rejects malformed/unsafe packages and XML without running or resolving code', async () => {
  await assert.rejects(inspect.inspectPptxBytes(Buffer.from('not a zip')));
  await assert.rejects(inspect.inspectPptxBytes(await new JSZip().generateAsync({ type: 'nodebuffer' })), /Missing package/);
  const traversal = syntheticPptx();
  traversal.file('../escape.xml', '<bad/>');
  await assert.rejects(inspect.inspectPptxBytes(await traversal.generateAsync({ type: 'nodebuffer' })), /Unsafe/);
  const escapingRel = syntheticPptx();
  escapingRel.file('ppt/slides/_rels/slide2.xml.rels', rels(rel('notes', 'notesSlide', '../../../outside.xml')));
  await assert.rejects(inspect.inspectPptxBytes(await escapingRel.generateAsync({ type: 'nodebuffer' })), /Unsafe/);
  const broken = syntheticPptx();
  broken.remove('ppt/charts/chart1.xml');
  await assert.rejects(inspect.inspectPptxBytes(await broken.generateAsync({ type: 'nodebuffer' })), /Missing relationship/);
  for (const invalid of ['<!DOCTYPE x [<!ENTITY e SYSTEM "file:///secret">]><x>&e;</x>', '<x><y></x>', '<x/><y/>', '<x>&undefined;</x>', '<x a="1" a="2"/>']) {
    assert.throws(() => inspect.parseXml(invalid));
  }
});

test('inspection CLI writes a static report and refuses overwriting or invalid output paths', async () => {
  const deck = path.join(workspace, 'synthetic.pptx');
  const report = path.join(workspace, 'inspection.json');
  await fs.writeFile(deck, await syntheticPptx().generateAsync({ type: 'nodebuffer' }));
  const cli = spawnSync(process.execPath, [path.join(harness, 'inspect.mjs'), deck, report], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal((await readJson(report)).slides.length, 2);
  await assert.rejects(inspect.inspectPptx(deck, report), /already exists/);
  await assert.rejects(inspect.inspectPptx(deck, path.join(workspace, 'wrong.txt')), /Expected/);
  await assert.rejects(inspect.inspectPptx(deck, `${workspace}${path.sep}..${path.sep}escape.json`), /Escaping/);
  await assert.rejects(inspect.inspectPptx(path.join(workspace, 'missing.pptx'), path.join(workspace, 'missing.json')), /ENOENT/);
});

test('run verifier checks frozen bytes and paired prompts without reading outputs or claiming process compliance', async () => {
  const manifest = path.join(output, 'evaluator', 'run.json');
  const original = await fs.readFile(manifest);
  const reportPath = path.join(workspace, 'verified.json');
  const unreadOutput = path.join(output, 'cpython-string', 'baseline', 'outputs', 'unread-junction');
  await fs.symlink(workspace, unreadOutput, process.platform === 'win32' ? 'junction' : 'dir');
  try {
    const report = await verifier.verifyRun(output, reportPath);
    assert.equal(report.status, 'hashes-and-pairs-verified');
    assert.equal(report.source_snapshot_status, 'hashes-verified');
    assert.deepEqual(report.failures, []);
    assert.deepEqual(report.verified, {
      source_files: 3, bundle_files: 6, input_files: 26, task_files: 16,
      bundle_inventory_hashes: 2, input_pairs: 4, prompt_pairs: 4, task_pairs: 4, instruction_pairs: 4,
    });
    assert.equal(report.behavior_and_process.status, 'unknown');
    for (const [key, value] of Object.entries(report.behavior_and_process)) {
      if (key !== 'status') assert.equal(value, null);
    }
    assert.equal(report.manifest_sha256, prepare.sha256(original));
    assert.deepEqual(await fs.readFile(manifest), original);
    await assert.rejects(verifier.verifyRun(output, reportPath), /already exists/);
    await assert.rejects(verifier.verifyRun(output, path.join(workspace, 'bad-report.txt')), /\.json/);
    await assert.rejects(verifier.verifyRun(output, path.join(output, 'cpython-string', 'baseline', 'outputs', 'report.json')), /cannot be written/);
  } finally {
    await fs.unlink(unreadOutput);
  }
});

test('run verifier reports actual mismatches/counts, extra inputs and unequal prompts with CLI failure', async () => {
  const files = [
    path.join(output, 'bundles', 'baseline', 'aha-explain', 'SKILL.md'),
    path.join(output, 'cpython-string', 'baseline', 'inputs', 'research', 'report.md'),
    path.join(output, 'cpython-string', 'baseline', 'task.json'),
    path.join(output, 'evaluator', 'source', 'prepare.mjs'),
  ];
  const originals = await Promise.all(files.map(file => fs.readFile(file)));
  const modes = await Promise.all(files.map(async file => (await fs.stat(file)).mode & 0o777));
  const extra = path.join(output, 'cpython-string', 'baseline', 'inputs', 'unexpected.txt');
  const manifest = path.join(output, 'evaluator', 'run.json');
  const manifestBefore = await fs.readFile(manifest);
  try {
    for (let index = 0; index < files.length; index++) {
      await fs.chmod(files[index]!, 0o666);
      if (path.basename(files[index]!) === 'task.json') {
        const task = JSON.parse(originals[index]!.toString('utf8'));
        task.prompt += '\n不同的任务。';
        await fs.writeFile(files[index]!, JSON.stringify(task));
      } else {
        await fs.writeFile(files[index]!, Buffer.concat([originals[index]!, Buffer.from('\nChanged fixture\n')]));
      }
    }
    await fs.writeFile(extra, 'unrecorded input');
    const reportPath = path.join(workspace, 'mismatches.json');
    const cli = spawnSync(process.execPath, [path.join(harness, 'verify-run.mjs'), output, reportPath], { encoding: 'utf8' });
    assert.equal(cli.status, 1, cli.stderr);
    const report = await readJson(reportPath);
    assert.equal(report.status, 'mismatch');
    assert.equal(report.source_snapshot_status, 'mismatch');
    assert.equal(report.verified.source_files, 2);
    assert.equal(report.verified.bundle_files, 5);
    assert.equal(report.verified.input_files, 25);
    assert.equal(report.verified.task_files, 15);
    assert.equal(report.verified.input_pairs, 3);
    assert.equal(report.verified.prompt_pairs, 3);
    assert.equal(report.verified.task_pairs, 3);
    assert.equal(report.verified.instruction_pairs, 4);
    for (const check of ['file-bytes-and-sha256', 'unrecorded-file', 'frozen-case-prompt', 'paired-inputs', 'paired-prompt']) {
      assert.ok(report.failures.some((failure: any) => failure.check === check), check);
    }
    assert.equal(report.behavior_and_process.status, 'unknown');
    assert.deepEqual(await fs.readFile(manifest), manifestBefore);
  } finally {
    await fs.rm(extra, { force: true });
    for (let index = 0; index < files.length; index++) {
      await fs.writeFile(files[index]!, originals[index]!);
      await fs.chmod(files[index]!, modes[index]!);
    }
  }
});

test('run verifier refuses manifest-directed output reads and reports missing recorded files', async () => {
  const manifest = path.join(output, 'evaluator', 'run.json');
  const original = await fs.readFile(manifest);
  const originalRun = JSON.parse(original.toString('utf8'));
  originalRun.cases[0].task_files['outputs/forbidden.txt'] = { bytes: 0, sha256: prepare.sha256('') };
  originalRun.cases[0].task_files['RUN.md'] = { bytes: 0, sha256: prepare.sha256('') };
  const missing = path.join(output, 'bundles', 'candidate', 'aha-explain', 'references', 'pptx.md');
  const saved = await fs.readFile(missing);
  try {
    await fs.writeFile(manifest, JSON.stringify(originalRun));
    await fs.chmod(missing, 0o666);
    await fs.unlink(missing);
    const report = await verifier.verifyRun(output, path.join(workspace, 'unsafe-record.json'));
    assert.equal(report.status, 'mismatch');
    assert.ok(report.failures.some((failure: any) => failure.check === 'safe-file-record' && failure.path === 'outputs/forbidden.txt'));
    assert.ok(report.failures.some((failure: any) => failure.check === 'file-bytes-and-sha256' && failure.path === missing && failure.actual === null));
    assert.equal(report.behavior_and_process.status, 'unknown');
    assert.deepEqual(await fs.readFile(manifest), Buffer.from(JSON.stringify(originalRun)));
  } finally {
    await fs.writeFile(manifest, original);
    await fs.writeFile(missing, saved);
    await fs.chmod(missing, 0o444);
  }
});

async function reviewFixture(name: string) {
  const directory = path.join(workspace, name);
  const bytes = await syntheticPptx().generateAsync({ type: 'nodebuffer' });
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  const records = [];
  for (const condition of ['baseline', 'candidate']) {
    const author = path.join(directory, 'cpython-string', condition);
    const rendered = path.join(author, 'outputs', 'rendered');
    const research = path.join(author, 'inputs', 'research');
    await fs.mkdir(rendered, { recursive: true });
    await fs.mkdir(research, { recursive: true });
    await fs.writeFile(path.join(research, 'report.md'), '冻结研究测试材料。\n');
    await fs.writeFile(path.join(author, 'outputs', 'deck.pptx'), bytes);
    for (const file of ['slide-01.png', 'slide-02.png', 'contact-1.png']) {
      await fs.writeFile(path.join(rendered, file), image);
    }
    await fs.writeFile(path.join(rendered, 'powerpoint-observations.json'), JSON.stringify({
      outputHash: prepare.sha256(bytes),
      application: 'Synthetic fixture; no PowerPoint execution',
      slides: [{ image: 'slide-01.png' }, { image: 'slide-02.png' }],
    }));
    records.push({ id: 'cpython-string', condition, author_directory: author });
  }
  await fs.mkdir(path.join(directory, 'evaluator', 'cpython-string'), { recursive: true });
  await fs.writeFile(path.join(directory, 'evaluator', 'run.json'), JSON.stringify({ cases: records }));
  await fs.writeFile(path.join(directory, 'evaluator', 'cpython-string', 'eval_metadata.json'), JSON.stringify({
    eval_id: 'cpython-string', prompt: '解释冻结材料中的合并机制。',
    assertions: ['用材料支撑关系。'], observation_policy: '观察与判断分开。',
    conditions: { baseline: { private: 'baseline-secret' }, candidate: { private: 'candidate-secret' } },
    private_author_directory: records[0]!.author_directory,
  }));
  return { directory, records, bytes, image };
}

test('neutral review copies keep mapping outside, project metadata without condition leaks, and refuse overwrites', async () => {
  const fixture = await reviewFixture('review-source');
  const destination = path.join(workspace, 'neutral-review');
  const prepared = await reviewer.prepareReview(fixture.directory, destination);
  assert.equal(prepared.status, 'prepared-for-independent-review');
  assert.equal(prepared.runs, 2);
  const mappingPath = path.join(fixture.directory, 'evaluator', 'review-mapping.json');
  const mappingBytes = await fs.readFile(mappingPath);
  const mapping = JSON.parse(mappingBytes.toString('utf8'));
  assert.ok(path.relative(destination, mappingPath).startsWith(`..${path.sep}`));
  assert.deepEqual(mapping.map((item: any) => item.label).sort(), ['A', 'B']);
  assert.deepEqual(mapping.map((item: any) => item.condition).sort(), ['baseline', 'candidate']);
  assert.ok(mapping.every((item: any) => item.outputHash === prepare.sha256(fixture.bytes)));
  const caseRoot = path.join(destination, 'cpython-string');
  const metadata = await readJson(path.join(caseRoot, 'eval_metadata.json'));
  assert.equal(metadata.eval_id, 1);
  assert.equal(metadata.prompt, '解释冻结材料中的合并机制。');
  assert.deepEqual(metadata.assertions, ['用材料支撑关系。']);
  assert.ok(!/baseline|candidate|private_author_directory|conditions/.test(JSON.stringify(metadata)));
  assert.equal(await fs.readFile(path.join(caseRoot, 'research', 'report.md'), 'utf8'), '冻结研究测试材料。\n');
  for (const label of ['A', 'B']) {
    const artifacts = path.join(caseRoot, label, 'outputs');
    assert.deepEqual(await fs.readFile(path.join(artifacts, 'deck.pptx')), fixture.bytes);
    for (const file of ['slide-01.png', 'slide-02.png', 'contact-1.png']) {
      assert.deepEqual(await fs.readFile(path.join(artifacts, file)), fixture.image);
    }
    assert.equal((await readJson(path.join(artifacts, 'ooxml.json'))).slides.length, 2);
    assert.equal((await readJson(path.join(caseRoot, label, 'application-observations.json'))).outputHash, prepare.sha256(fixture.bytes));
  }
  const inventoryBefore = await prepare.inventory(destination);
  assert.ok(Object.keys(inventoryBefore).every(file => !/review-mapping|baseline|candidate/.test(file)));
  await assert.rejects(reviewer.prepareReview(fixture.directory, destination), /already exists/);
  assert.deepEqual(await prepare.inventory(destination), inventoryBefore);
  assert.deepEqual(await fs.readFile(mappingPath), mappingBytes);
  const emptyDestination = path.join(workspace, 'empty-review');
  await fs.mkdir(emptyDestination);
  await assert.rejects(reviewer.prepareReview(fixture.directory, emptyDestination), /already exists/);
  assert.deepEqual(await fs.readdir(emptyDestination), []);
  const anotherDestination = path.join(workspace, 'another-review');
  await assert.rejects(reviewer.prepareReview(fixture.directory, anotherDestination), /review-mapping/);
  await assert.rejects(fs.stat(anotherDestination), /ENOENT/);
});

test('neutral review rejects stale rendering hashes before staging or writing mapping', async () => {
  const fixture = await reviewFixture('stale-review-source');
  const observationPath = path.join(fixture.records[0]!.author_directory, 'outputs', 'rendered', 'powerpoint-observations.json');
  const observation = await readJson(observationPath);
  observation.outputHash = prepare.sha256('different deck');
  await fs.writeFile(observationPath, JSON.stringify(observation));
  const destination = path.join(workspace, 'stale-review');
  const manifestBefore = await fs.readFile(path.join(fixture.directory, 'evaluator', 'run.json'));
  await assert.rejects(reviewer.prepareReview(fixture.directory, destination), /Stale rendering/);
  await assert.rejects(fs.stat(destination), /ENOENT/);
  await assert.rejects(fs.stat(path.join(fixture.directory, 'evaluator', 'review-mapping.json')), /ENOENT/);
  assert.deepEqual(await fs.readFile(path.join(fixture.directory, 'evaluator', 'run.json')), manifestBefore);
  await assert.rejects(reviewer.prepareReview(fixture.directory, path.join(fixture.directory, 'review')), /outside the generation/);
});

test('technical-repair review selects explicit derivatives and retains a separate mapping', async () => {
  const fixture = await reviewFixture('repair-review-source');
  for (const record of fixture.records) {
    const outputs = path.join(record.author_directory, 'outputs');
    await fs.copyFile(path.join(outputs, 'deck.pptx'), path.join(outputs, 'deck-repaired.pptx'));
    await fs.cp(path.join(outputs, 'rendered'), path.join(outputs, 'rendered-repaired'), { recursive: true });
    await fs.writeFile(path.join(outputs, 'deck.pptx'), 'Intentionally invalid first-pass test bytes');
  }
  const destination = path.join(workspace, 'technical-review');
  await reviewer.prepareReview(fixture.directory, destination, 'technical-repair');
  assert.equal((await readJson(path.join(destination, 'cpython-string', 'eval_metadata.json'))).stage, 'technical-repair');
  assert.deepEqual(await fs.readFile(path.join(destination, 'cpython-string', 'A', 'outputs', 'deck.pptx')), fixture.bytes);
  await fs.stat(path.join(fixture.directory, 'evaluator', 'review-mapping-repaired.json'));
  await assert.rejects(fs.stat(path.join(fixture.directory, 'evaluator', 'review-mapping.json')), /ENOENT/);
  await assert.rejects(reviewer.prepareReview(fixture.directory, path.join(workspace, 'unknown-stage'), 'unknown'), /Unknown review stage/);
});

test('neutral review accepts PowerShell BOM observations without rewriting original evidence', async () => {
  const fixture = await reviewFixture('bom-review-source');
  const originals = [];
  for (const record of fixture.records) {
    const file = path.join(record.author_directory, 'outputs', 'rendered', 'powerpoint-observations.json');
    const bytes = Buffer.concat([Buffer.from('\uFEFF'), await fs.readFile(file)]);
    await fs.writeFile(file, bytes);
    originals.push({ file, bytes });
  }
  const destination = path.join(workspace, 'bom-review');
  await reviewer.prepareReview(fixture.directory, destination);
  for (const label of ['A', 'B']) {
    assert.equal((await readJson(path.join(destination, 'cpython-string', label, 'application-observations.json'))).outputHash,
      prepare.sha256(fixture.bytes));
  }
  for (const { file, bytes } of originals) assert.deepEqual(await fs.readFile(file), bytes);
});
