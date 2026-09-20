import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { inventory, safePath, safeRelative, readRegular, sha256 } from '../pptx-first-round/prepare.mjs';

const here = fileURLToPath(new URL('./', import.meta.url));
const corpusPath = fileURLToPath(new URL('../pptx-first-round/cases.json', import.meta.url));
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const fingerprint = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const runtimeManifestBytes = (metadata, files) => Buffer.from(json({
  ...metadata, files: Object.fromEntries(Object.keys(files).filter(name => name !== 'runtime-manifest.json').sort()
    .map(name => [name, files[name].sha256])),
}));
const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const equal = (actual, expected, label) => {
  if (stable(actual) !== stable(expected)) throw new Error(`Integrity mismatch: ${label}`);
};
const at = (root, relative) => path.join(root, ...safeRelative(relative).split('/'));
const within = (parent, child) => {
  const relative = path.relative(parent, child);
  return !relative || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
};
const exists = file => fs.lstat(file).then(() => true, error => {
  if (error.code !== 'ENOENT') throw error;
  return false;
});
async function writeNew(file, bytes, readonly = true) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes, { flag: 'wx' });
  if (readonly) await fs.chmod(file, 0o444);
}
async function copyFiles(source, destination, files, readonly = true, overrides = {}) {
  for (const [name, expected] of Object.entries(files)) {
    const bytes = await readRegular(at(source, name));
    equal(fingerprint(bytes), expected, `source changed during freeze: ${name}`);
    await writeNew(at(destination, name), overrides[name] ?? bytes, readonly);
  }
  return inventory(destination);
}
function disjoint(output, input) {
  if (within(output, input) || within(input, output)) throw new Error(`Output and input must not overlap: ${input}`);
}
function requireFiles(files, names, label) {
  for (const name of names) if (!files[name]?.bytes) throw new Error(`Missing ${label}: ${name}`);
}

// Parse only: no import or execution of the untrusted seed module.
export function discoverImageLiteral(source, id) {
  const ast = ts.createSourceFile('main.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  if (ast.parseDiagnostics.length) throw new Error(`Cannot parse seed source: ${id}`);
  const images = [];
  function visit(node) {
    const isImage = ts.isCallExpression(node) &&
      ((ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'addImage') ||
       (ts.isElementAccessExpression(node.expression) && ts.isStringLiteral(node.expression.argumentExpression) &&
        node.expression.argumentExpression.text === 'addImage'));
    if (isImage) {
      const object = node.arguments[0];
      if (node.arguments.length !== 1 || !object || !ts.isObjectLiteralExpression(object)) {
        throw new Error(`Seed addImage must use one explicit object: ${id}`);
      }
      const paths = object.properties.filter(p => ts.isPropertyAssignment(p) &&
        (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === 'path');
      if (paths.length !== 1 || !ts.isStringLiteral(paths[0].initializer) ||
          object.properties.some(p => ts.isSpreadAssignment(p) || (p.name && p.name.getText(ast) === 'data'))) {
        throw new Error(`Seed addImage must retain a single literal path: ${id}`);
      }
      const literal = paths[0].initializer;
      images.push({
        path: literal.text, literal: literal.getText(ast),
        source_line: ast.getLineAndCharacterOfPosition(literal.getStart(ast)).line + 1,
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (images.length !== (id === 'project-overview' ? 1 : 0)) throw new Error(`Unexpected seed image allowance: ${id}`);
  if (!images.length) return null;
  if (!path.isAbsolute(images[0].path) || path.extname(images[0].path).toLowerCase() !== '.png') {
    throw new Error('Overview image must be an existing absolute PNG literal');
  }
  return images[0];
}

function instructions(task) {
  const cli = path.join(task.skill, 'scripts', 'aha.mjs');
  return `# 第二轮：单次修复，不是重新创作

${task.prompt}

原问题（仅保持范围）：${task.original_question}

## 读取与隔离
工作目录：\`${task.author_directory}\`。先读指定技能 \`${task.skill}\\SKILL.md\` 及其 PPT 相关 references，
再读 inputs\\project\\research 的完整 Dossier 和 inputs\\project 的源文件，检查 inputs 下所有 PNG
（包括每页实际 PowerPoint 图），以及 inputs\\rendered\\powerpoint-observations.json 和已有 deck.pptx。
这些是同一既有 candidate 种子的历史材料，不是本轮新验证。
只可读取本任务 task.json、RUN.md、inputs、outputs 和所指定技能；不得读取兄弟条件/案例、evaluator、
原始 checkout 或其他目录，不得联网、安装、发布或启动子代理。技能和 inputs 不可修改。
这是共享文件系统上的程序性边界，不是安全沙箱；哈希和只读属性不证明行为隔离。
${task.approved_image ? `唯一外部文件例外：已有 addImage 字符串字面量 ${task.approved_image.literal}。
保留这一个 literal，不重写路径；只可将其作为提供的历史图片使用，SHA-256 ${task.approved_image.sha256}。
该路径仍指向原文件，宿主在后续获批执行前须核对哈希。inputs\\assets 内有同字节只读副本供查看。`
    : '本案例没有外部图片路径许可，不得添加图片路径或读取其他本地资产。'}

## 只提交一次修订
outputs\\project 已按字节复制 seed project；不要初始化或重新生成。
只可编辑 outputs\\project\\pptx\\main.mjs、outputs\\project\\artifact.json；
可另写 outputs\\qa\\repair.json（changes: [{slide, reason, source_lines}]，unperformed_qa: [...]）。
不改研究文件或其他文件，不增加导入（包括动态 import）、代码加载、eval/Function、
process、文件系统、网络或动态执行。只使用原有提供的对象及普通局部 JavaScript 计算。
保留 Dossier 身份和来源边界。分开记录按页修改理由、静态检查结果与尚未执行的 QA；
未做的应用检查不得写成成功。源文件不变也须说明，没有第二轮作者反馈/重试机会。

## 仅允许的检查
node --check outputs\\project\\pptx\\main.mjs
node "${cli}" explain-check outputs\\project

报告源项目路径、改动理由和未执行 QA，然后 STOP。
禁止 render-pptx、--allow-code、执行 main.mjs 或任何其他执行作者模块的方式。
之后由宿主单独做源代码审阅和执行审批，再用共同运行时及实际 PowerPoint 重渲染；
独立评审比较修复前后。作者不得自行执行这些后续步骤。
`;
}

function gradingInstructions() {
  return `# Host and independent grader: repair-only

Keep rubric.json, protocol.json and this packet evaluator-only. Do not disclose criteria or historical defect answers to authors.
Verify the frozen manifest digest before both authors and again before host execution. Preserve seeds unchanged.
Record the author/tool/model provenance and one submitted change-set hash per condition; never rerun an author with feedback.
Manually review permitted output diffs and all source execution risks; static explain-check is not a security approval.
Only main.mjs and artifact.json may differ inside outputs/project; outputs/qa/repair.json is optional.
Check the original external overview PNG at the recorded path/hash; never silently rewrite the seed or asset path.
Record explicit host approval before executing with bundles/<condition>/aha-explain/scripts/aha.mjs.
Both pinned scripts must match the frozen common runtime SHA-256, including later rendering, not just static checks.
Use the same actual Microsoft PowerPoint version, font environment and export/edit-probe procedure for both conditions.
Keep application observations, exported slide PNGs, source diffs, notes extraction and editing probes as separate artifacts.

Give the independent grader each seed and submission, Dossier and rubric without revealing the guide condition where feasible.
Compare each repaired submission to the seed, then compare paired deltas. Prior seed successes are not new first-pass results.
For every criterion record status, delta, separate factual observations and judgment, rationale and exact before/after locators.
Locators require artifact path, SHA-256 and slide number plus shape ID/name, table row/column, chart series/cell,
notes XML part/paragraph, source line range or Dossier JSON pointer as appropriate. Do not use vague "looks good" evidence.
Table clearance requires actual images/bounds and readable text, not just a reduced font number or object count.
Missing actual PowerPoint rerender, notes examination or edit probes means the relevant claim is unverified.
Unchanged, improved, regressed, mixed and unverified are distinct; no summed aesthetic score or automatic success from hashes.
Use eval_metadata.json as a mutable record; frozen rubric/protocol/tasks/seeds/bundles must not change.
Keep source-review, execution-approval, static-check and PowerPoint-review stages separate and pending until observed.
`;
}

/**
 * Prepare only. All input paths except output must be absolute.
 * seedRunRoot is the first-round "runs" directory; built skill roots include their release manifests/notices.
 * commonRuntime is scripts/aha.mjs in a built skill; its adjacent bundle THIRD-PARTY-NOTICES.txt is also overlaid.
 * Returns { run, manifest_sha256 }; retain the digest independently of the output tree.
 */
export async function prepareRepairEval({ output, baseline, candidate, seedRunRoot, commonRuntime }) {
  const target = await safePath(output);
  if (await exists(target)) throw new Error(`Output already exists (including empty directories): ${target}`);
  const sources = { baseline, candidate, seedRunRoot, commonRuntime };
  for (const [name, value] of Object.entries(sources)) {
    if (!path.isAbsolute(value ?? '')) throw new Error(`${name} must be absolute`);
    await safePath(value);
    disjoint(target, value);
  }
  const protocolBytes = await readRegular(path.join(here, 'protocol.json'));
  const protocol = JSON.parse(protocolBytes);
  const corpusBytes = await readRegular(corpusPath);
  const corpus = JSON.parse(corpusBytes);
  const runtime = await readRegular(commonRuntime);
  if (!runtime.length) throw new Error('Common runtime must not be empty');
  const noticesPath = path.join(path.dirname(path.dirname(commonRuntime)), 'THIRD-PARTY-NOTICES.txt');
  disjoint(target, noticesPath);
  const notices = await readRegular(noticesPath);
  if (!notices.length) throw new Error('Common runtime THIRD-PARTY-NOTICES.txt must not be empty');
  const bundles = {};
  const manifestMetadata = {};
  for (const condition of protocol.conditions) {
    const files = await inventory(sources[condition]);
    requireFiles(files, ['SKILL.md', 'scripts/aha.mjs', 'THIRD-PARTY-NOTICES.txt', 'runtime-manifest.json'], 'built skill file');
    if (!Object.keys(files).some(name => /^references\/.*ppt/i.test(name) && files[name].bytes)) {
      throw new Error(`Missing PPT references in ${condition} bundle`);
    }
    const manifestBytes = await readRegular(path.join(sources[condition], 'runtime-manifest.json'));
    equal(fingerprint(manifestBytes), files['runtime-manifest.json'], 'original runtime manifest');
    const manifest = JSON.parse(manifestBytes);
    if (manifest.skill !== 'aha-explain' || !manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files)) {
      throw new Error(`Invalid built skill runtime-manifest.json: ${condition}`);
    }
    manifestMetadata[condition] = Object.fromEntries(Object.entries(manifest).filter(([name]) => name !== 'files'));
    bundles[condition] = files;
  }
  const seeds = {};
  for (const id of protocol.case_ids) {
    const original = path.join(seedRunRoot, id, 'candidate', 'outputs');
    const project = path.join(original, 'project-repaired');
    const projectFiles = await inventory(project);
    requireFiles(projectFiles, ['pptx/main.mjs', 'artifact.json', 'research/manifest.json',
      'research/research.json', 'research/report.md'], 'seed project file');
    const deck = await readRegular(path.join(original, 'deck-repaired.pptx'));
    if (!deck.length) throw new Error(`Empty seed deck: ${id}`);
    const rendered = path.join(original, 'rendered-repaired');
    const renderedFiles = await inventory(rendered);
    requireFiles(renderedFiles, ['powerpoint-observations.json'], 'PowerPoint observations');
    const observations = JSON.parse((await readRegular(path.join(rendered, 'powerpoint-observations.json')))
      .toString('utf8').replace(/^\uFEFF/, ''));
    if (observations.application !== 'Microsoft PowerPoint' || observations.outputHash !== sha256(deck) ||
        !Array.isArray(observations.slides) || observations.slides.length < 5 || observations.slides.length > 8) {
      throw new Error(`Seed PowerPoint observations/deck identity or slide budget invalid: ${id}`);
    }
    const slides = observations.slides.map((slide, index) => {
      const name = `slide-${String(index + 1).padStart(2, '0')}.png`;
      if (slide.slide !== index + 1 || slide.image !== name || !renderedFiles[name]?.bytes) {
        throw new Error(`Missing or nonsequential seed slide image: ${id} ${name}`);
      }
      return name;
    });
    const pngs = Object.keys(renderedFiles).filter(name => /\.png$/i.test(name));
    equal(pngs.filter(name => /^slide-.*\.png$/i.test(name)).sort(), [...slides].sort(), `unexpected slide PNGs: ${id}`);
    const selected = Object.fromEntries(Object.entries(renderedFiles)
      .filter(([name]) => pngs.includes(name) || name === 'powerpoint-observations.json'));
    const source = await readRegular(path.join(project, 'pptx', 'main.mjs'));
    const approved = discoverImageLiteral(source.toString('utf8'), id);
    let asset = null;
    if (approved) {
      disjoint(target, approved.path);
      asset = await readRegular(approved.path);
      if (!asset.length) throw new Error('Approved overview PNG is empty');
      Object.assign(approved, fingerprint(asset));
    }
    if (!corpus.cases.find(item => item.id === id)) throw new Error(`Unknown corpus case: ${id}`);
    seeds[id] = { original, project, projectFiles, deck, rendered, selected, observations, approved, asset };
  }
  const sourceFiles = { 'protocol.json': protocolBytes, 'first-round-cases.json': corpusBytes };
  for (const name of ['prepare.mjs', 'verify.mjs', 'prepare-review.mjs']) sourceFiles[name] = await readRegular(path.join(here, name));
  sourceFiles['first-round-prepare.mjs'] = await readRegular(fileURLToPath(new URL('../pptx-first-round/prepare.mjs', import.meta.url)));
  sourceFiles['first-round-inspect.mjs'] = await readRegular(fileURLToPath(new URL('../pptx-first-round/inspect.mjs', import.meta.url)));

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.mkdir(target);
  const evaluator = path.join(target, 'evaluator');
  const metrics = () => ({ model: null, input_tokens: null, output_tokens: null, runtime_ms: null, cost: null });
  const run = {
    schema_version: 1, round: protocol.round, root: target, status: 'prepared-not-authored',
    frozen_before_authors: true, prepared_at: new Date().toISOString(),
    design: protocol.design, budget: protocol.budget, limitations: protocol.inference_limits,
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    common_runtime: { original_path: commonRuntime, ...fingerprint(runtime),
      notices: { original_path: noticesPath, ...fingerprint(notices) } },
    bundles: {}, seeds: {}, cases: [], metrics: metrics(),
  };
  for (const [name, bytes] of Object.entries(sourceFiles)) await writeNew(path.join(evaluator, 'source', name), bytes);
  await writeNew(path.join(evaluator, 'runtime', 'aha.mjs'), runtime);
  await writeNew(path.join(evaluator, 'runtime', 'THIRD-PARTY-NOTICES.txt'), notices);
  await writeNew(path.join(evaluator, 'GRADING.md'), gradingInstructions());
  for (const condition of protocol.conditions) {
    const pinned = path.join(target, 'bundles', condition, 'aha-explain');
    const overlaid = { ...bundles[condition], 'scripts/aha.mjs': fingerprint(runtime), 'THIRD-PARTY-NOTICES.txt': fingerprint(notices) };
    const regeneratedManifest = runtimeManifestBytes(manifestMetadata[condition], overlaid);
    const overrides = { 'scripts/aha.mjs': runtime, 'THIRD-PARTY-NOTICES.txt': notices, 'runtime-manifest.json': regeneratedManifest };
    const used = await copyFiles(sources[condition], pinned, bundles[condition], true, overrides);
    run.bundles[condition] = {
      original_path: sources[condition], original_files: bundles[condition],
      original_inventory_sha256: sha256(json(bundles[condition])),
      original_runtime_manifest_metadata: manifestMetadata[condition],
      pinned_path: pinned, used_files: used, used_inventory_sha256: sha256(json(used)),
      overlay: { policy: 'common-script-and-notices; regenerate complete file hashes excluding manifest; preserve own metadata and guides',
        files: Object.fromEntries(Object.entries(overrides).map(([name, bytes]) => [name, fingerprint(bytes)])) },
    };
  }
  for (const id of protocol.case_ids) {
    const seed = seeds[id];
    const frozen = path.join(target, 'seeds', id);
    await copyFiles(seed.project, path.join(frozen, 'project'), seed.projectFiles);
    await writeNew(path.join(frozen, 'deck.pptx'), seed.deck);
    await copyFiles(seed.rendered, path.join(frozen, 'rendered'), seed.selected);
    if (seed.asset) await writeNew(path.join(frozen, 'assets', 'approved-image.png'), seed.asset);
    const files = await inventory(frozen);
    run.seeds[id] = {
      original_output: seed.original, files, inventory_sha256: sha256(json(files)),
      original_project_files: seed.projectFiles, original_rendered_files: seed.selected,
      approved_image: seed.approved, deck: fingerprint(seed.deck),
    };
    const item = corpus.cases.find(row => row.id === id);
    const criteria = [...protocol.repair_criteria, ...corpus.common_rubric, ...item.rubric];
    const rubric = {
      case_id: id, evaluation: 'repair-delta-not-first-pass', criteria,
      judgment_statuses: protocol.judgment_statuses, delta_statuses: protocol.delta_statuses,
      evidence_schema: {
        before: { artifact: null, sha256: null, slide: null, object_or_cell: null, source_lines_or_pointer: null },
        after: { artifact: null, sha256: null, slide: null, object_or_cell: null, source_lines_or_pointer: null },
        dossier: { artifact: null, sha256: null, lines_or_pointer: null },
        observation: null, rationale: null,
      },
      seed_native_object_locators: seed.observations.slides.flatMap((slide, index) => (slide.shapes ?? [])
        .flatMap((shape, shapeIndex) => shape.hasTable || shape.hasChart ? [{
          artifact: 'inputs/rendered/powerpoint-observations.json',
          pointer: `/slides/${index}/shapes/${shapeIndex}`, slide: slide.slide,
          shape_id: shape.id, shape_name: shape.name, table: !!shape.hasTable, chart: !!shape.hasChart,
          image: `inputs/rendered/${slide.image}`,
        }] : [])),
    };
    await writeNew(path.join(evaluator, id, 'rubric.json'), json(rubric));
    await writeNew(path.join(evaluator, id, 'eval_metadata.json'), json({
      case_id: id, status: 'pending', paired_delta: null,
      conditions: Object.fromEntries(protocol.conditions.map(condition => [condition, {
        status: 'pending', submission_count: 0, submitted_source_sha256: null,
        metrics: metrics(), source_review: null, execution_approval: null, static_check: null,
        powerpoint_review: null, author_tool_log: null, observations: [],
        judgments: criteria.map(row => ({ id: row.id, status: 'pending', delta: 'pending', score: null,
          evidence: [], rationale: null })),
      }])),
    }), false);
    for (const condition of protocol.conditions) {
      const author = path.join(target, id, condition);
      const inputs = await copyFiles(frozen, path.join(author, 'inputs'), files);
      const initialProject = await copyFiles(path.join(frozen, 'project'), path.join(author, 'outputs', 'project'),
        seed.projectFiles, false);
      equal(initialProject, seed.projectFiles, 'initial output project');
      const task = {
        id, round: protocol.round, prompt: protocol.prompt, original_question: item.prompt, budget: protocol.budget,
        author_directory: author, skill: run.bundles[condition].pinned_path,
        research: path.join('inputs', 'project', 'research'), seed_project: path.join('inputs', 'project'),
        deck: path.join('inputs', 'deck.pptx'), images: Object.keys(seed.selected).filter(name => /\.png$/i.test(name))
          .map(name => path.join('inputs', 'rendered', ...name.split('/'))),
        application_observations: path.join('inputs', 'rendered', 'powerpoint-observations.json'),
        project: path.join('outputs', 'project'), approved_image: seed.approved,
        permitted_edits: [path.join('outputs', 'project', 'pptx', 'main.mjs'),
          path.join('outputs', 'project', 'artifact.json'), path.join('outputs', 'qa', 'repair.json')],
      };
      await writeNew(path.join(author, 'task.json'), json(task));
      await writeNew(path.join(author, 'RUN.md'), instructions(task));
      run.cases.push({
        id, condition, author_directory: author, staged_inputs: inputs, initial_output_project: initialProject,
        task_files: { 'task.json': fingerprint(Buffer.from(json(task))), 'RUN.md': fingerprint(Buffer.from(instructions(task))) },
      });
    }
  }
  const evaluatorFiles = await inventory(evaluator);
  run.frozen_evaluator_files = Object.fromEntries(Object.entries(evaluatorFiles).filter(([name]) => !name.endsWith('/eval_metadata.json')));
  const manifest = Buffer.from(json(run));
  await writeNew(path.join(evaluator, 'run.json'), manifest);
  const manifest_sha256 = sha256(manifest);
  await verifyRepairRun(target, manifest_sha256);
  return { run, manifest_sha256 };
}

/** Point-in-time integrity only. Author outputs and mutable grading records are deliberately excluded. */
export async function verifyRepairRun(output, expectedManifestSha256) {
  const root = await safePath(output);
  const bytes = await readRegular(path.join(root, 'evaluator', 'run.json'));
  const digest = sha256(bytes);
  if (expectedManifestSha256 !== undefined) equal(digest, expectedManifestSha256, 'independently retained manifest SHA-256');
  const run = JSON.parse(bytes);
  equal(run.schema_version, 1, 'manifest schema');
  equal(run.round, 'pptx-second-round-repair-only', 'round');
  equal(run.root, root, 'run root');
  const caseIds = ['git-merge', 'anc', 'greenland', 'project-overview'];
  const conditions = ['baseline', 'candidate'];
  const evaluator = path.join(root, 'evaluator');
  const mutable = new Set(['run.json', 'review-mapping.json', ...caseIds.map(id => `${id}/eval_metadata.json`)]);
  const actualEvaluator = Object.fromEntries(Object.entries(await inventory(evaluator)).filter(([name]) => !mutable.has(name)));
  equal(actualEvaluator, run.frozen_evaluator_files, 'frozen evaluator protocol/source/rubric');
  const runtime = fingerprint(await readRegular(path.join(evaluator, 'runtime', 'aha.mjs')));
  equal(runtime, { bytes: run.common_runtime.bytes, sha256: run.common_runtime.sha256 }, 'common runtime');
  const notices = fingerprint(await readRegular(path.join(evaluator, 'runtime', 'THIRD-PARTY-NOTICES.txt')));
  equal(notices, { bytes: run.common_runtime.notices.bytes, sha256: run.common_runtime.notices.sha256 }, 'common runtime notices');
  for (const condition of conditions) {
    const bundle = run.bundles[condition];
    const pinned = path.join(root, 'bundles', condition, 'aha-explain');
    equal(bundle.pinned_path, pinned, 'pinned bundle path');
    equal(sha256(json(bundle.original_files)), bundle.original_inventory_sha256, 'original bundle inventory hash');
    equal(sha256(json(bundle.used_files)), bundle.used_inventory_sha256, 'used bundle inventory hash');
    const expected = { ...bundle.original_files, 'scripts/aha.mjs': runtime, 'THIRD-PARTY-NOTICES.txt': notices };
    const regeneratedManifest = runtimeManifestBytes(bundle.original_runtime_manifest_metadata, expected);
    expected['runtime-manifest.json'] = fingerprint(regeneratedManifest);
    equal(bundle.used_files, expected, 'runtime/notices/own-manifest-only overlay');
    equal(await readRegular(path.join(pinned, 'runtime-manifest.json')), regeneratedManifest, 'complete release manifest with own guide hashes');
    equal(await inventory(pinned), bundle.used_files, `frozen ${condition} bundle`);
  }
  equal(Object.keys(run.bundles).sort(), [...conditions].sort(), 'bundle conditions');
  equal(Object.keys(run.seeds).sort(), [...caseIds].sort(), 'seed IDs');
  equal(run.cases.map(row => `${row.id}/${row.condition}`).sort(),
    caseIds.flatMap(id => conditions.map(condition => `${id}/${condition}`)).sort(), 'exact case pairs');
  for (const id of caseIds) {
    const seed = run.seeds[id];
    const frozen = path.join(root, 'seeds', id);
    equal(sha256(json(seed.files)), seed.inventory_sha256, `seed inventory hash: ${id}`);
    equal(await inventory(frozen), seed.files, `frozen seed: ${id}`);
    equal(await inventory(path.join(frozen, 'project')), seed.original_project_files, `byte-exact source project: ${id}`);
    const discovered = discoverImageLiteral((await readRegular(path.join(frozen, 'project', 'pptx', 'main.mjs'))).toString('utf8'), id);
    if (discovered) {
      const actualAsset = fingerprint(await readRegular(discovered.path));
      equal(seed.approved_image, { ...discovered, ...actualAsset }, 'original approved image literal/hash');
      equal(seed.files['assets/approved-image.png'], actualAsset, 'copied approved image hash');
    } else equal(seed.approved_image, null, 'no external image allowance');
    const normalized = [];
    for (const condition of conditions) {
      const entry = run.cases.find(row => row.id === id && row.condition === condition);
      const author = path.join(root, id, condition);
      const bundle = path.join(root, 'bundles', condition, 'aha-explain');
      equal(entry.author_directory, author, 'author path');
      equal(entry.staged_inputs, seed.files, 'paired input manifest');
      equal(await inventory(path.join(author, 'inputs')), seed.files, `paired frozen inputs: ${id}/${condition}`);
      equal(entry.initial_output_project, seed.original_project_files, 'recorded initial output identity');
      equal(Object.keys(entry.task_files).sort(), ['RUN.md', 'task.json'], 'task packet inventory');
      const packets = {};
      for (const name of ['task.json', 'RUN.md']) {
        const content = await readRegular(path.join(author, name));
        equal(fingerprint(content), entry.task_files[name], `task: ${id}/${condition}/${name}`);
        packets[name] = content.toString('utf8');
      }
      const task = JSON.parse(packets['task.json']);
      equal(task.id, id, 'task case');
      equal(task.author_directory, author, 'task author path');
      equal(task.skill, bundle, 'task bundle');
      equal(task.approved_image, seed.approved_image, 'task approved image');
      const normalize = text => {
        for (const [value, marker] of [[author, '<AUTHOR>'], [bundle, '<SKILL>']]) {
          text = text.split(JSON.stringify(value).slice(1, -1)).join(marker).split(value).join(marker);
        }
        return text;
      };
      normalized.push(Object.fromEntries(Object.entries(packets).map(([name, content]) => [name, normalize(content)])));
    }
    equal(normalized[0], normalized[1], `equal paired tasks and instructions: ${id}`);
  }
  equal(sha256(await readRegular(path.join(evaluator, 'run.json'))), digest, 'manifest unchanged during verification');
  return {
    status: 'frozen-integrity-and-pairs-verified', manifest_sha256: digest, pairs: caseIds.length,
    outputs_checked: false, behavior_verified: false, quality_verified: false,
    limitations: run.limitations,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 9 || args[1] !== '--baseline' || args[3] !== '--candidate' ||
        args[5] !== '--seed-run-root' || args[7] !== '--common-runtime') {
      throw new Error('Usage: node evals\\pptx-repair-round\\prepare.mjs <new-output-root> --baseline <absolute-built-skill> --candidate <absolute-built-skill> --seed-run-root <absolute-first-round-runs> --common-runtime <absolute-aha.mjs>');
    }
    const result = await prepareRepairEval({ output: args[0], baseline: args[2], candidate: args[4],
      seedRunRoot: args[6], commonRuntime: args[8] });
    console.log(json({ output: result.run.root, status: result.run.status, manifest_sha256: result.manifest_sha256,
      pairs: result.run.seeds && Object.keys(result.run.seeds).length }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
