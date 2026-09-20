import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const here = fileURLToPath(new URL('./', import.meta.url));
const json = value => `${JSON.stringify(value, null, 2)}\n`;
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function safeRelative(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') ||
      value.split('/').some(part => !part || part === '.' || part === '..' ||
        /[<>:"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(part))) {
    throw new Error(`Unsafe relative path: ${value}`);
  }
  return value;
}

export async function safePath(value) {
  if (typeof value !== 'string' || !value || value.split(/[\\/]/).includes('..')) {
    throw new Error(`Escaping path refused: ${value}`);
  }
  const target = path.resolve(value);
  let current = path.parse(target).root;
  for (const part of target.slice(current.length).split(path.sep).filter(Boolean)) {
    safeRelative(part);
    current = path.join(current, part);
    const stat = await fs.lstat(current).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
    if (stat?.isSymbolicLink()) throw new Error(`Symlink/junction refused: ${current}`);
    if (stat && current !== target && !stat.isDirectory()) throw new Error(`Not a directory: ${current}`);
  }
  return target;
}

export async function readRegular(file) {
  await safePath(file);
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.nlink > 1) throw new Error(`Expected a regular file without hard links: ${file}`);
  return fs.readFile(file);
}

export async function inventory(directory) {
  await safePath(directory);
  if (!(await fs.lstat(directory)).isDirectory()) throw new Error(`Not a directory: ${directory}`);
  const files = {};
  async function visit(dir, prefix = '') {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const relative = safeRelative(`${prefix}${entry.name}`);
      const target = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symlink/junction refused: ${target}`);
      if (entry.isDirectory()) await visit(target, `${relative}/`);
      else {
        const bytes = await readRegular(target);
        files[relative] = { bytes: bytes.length, sha256: sha256(bytes) };
      }
    }
  }
  await visit(directory);
  return files;
}

const fromRelative = (root, relative) => path.join(root, ...safeRelative(relative).split('/'));
const contains = (parent, child) => {
  const relative = path.relative(parent, child);
  return !relative || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
};
async function writeNew(file, bytes) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes, { flag: 'wx' });
}
async function copyInventory(source, destination, files, readOnly = false) {
  for (const [relative, expected] of Object.entries(files)) {
    const bytes = await readRegular(fromRelative(source, relative));
    if (sha256(bytes) !== expected.sha256) throw new Error(`Source changed during preparation: ${relative}`);
    const target = fromRelative(destination, relative);
    await writeNew(target, bytes);
    if (readOnly) await fs.chmod(target, 0o444);
  }
  const actual = await inventory(destination);
  if (JSON.stringify(actual) !== JSON.stringify(files)) throw new Error('Staged byte inventory differs');
  return actual;
}

function authorRun(task) {
  const cli = path.join(task.skill, 'scripts', 'aha.mjs');
  return `# PPTX 第一轮：作者边界

${task.prompt}

## 工作区域与程序性隔离
工作目录：\`${task.author_directory}\`。
只可读取本目录的 task.json、RUN.md、inputs，以及固定技能 \`${task.skill}\`；
初始化后可读取/编辑本目录 outputs。禁止读取兄弟案例/条件、evaluator、原始 checkout 或其他目录。
这是共享文件系统上的程序性约定，不是操作系统隔离或安全沙箱；宿主需保留实际工具记录。
固定技能和 inputs 只读，不可改写。只读文件属性/哈希用于审计，不是防篡改保证。
不得安装、联网、发布、启动子代理或执行生成的 main.mjs。

## 允许的流程
1. 读取固定技能 SKILL.md 及其针对本任务的相关指南；只把 inputs\\research 当作事实来源。
2. 从当前工作目录运行受信任的初始化命令：
   node "${cli}" explain-init inputs\\research pptx outputs\\project --language zh
3. 编辑 outputs\\project\\pptx\\main.mjs 和 outputs\\project\\artifact.json，
   完成作品、覆盖/省略、中文元数据及 authored 状态；保留初始化的研究身份。
4. 作者模块只能使用传入的 pptx、research 和普通局部 JavaScript 计算；
   禁止新增 import（含动态导入）、网络、process、文件系统、eval/Function 或其他代码加载。
   不得调用 writeFile；输出写入由以后获批的宿主渲染步骤负责。
${task.approved_image_path ? `   唯一允许图片路径是传给 addImage 的字符串字面量 ${JSON.stringify(task.approved_image_path)}。
   此图只作历史截图/插图，必须标明历史性质及不可编辑边界，不作本轮验证。` : '   本案例未提供图片；不得访问其他本地资源。'}
5. 仅运行静态结构检查（不会导入/执行作者模块）：
   node "${cli}" explain-check outputs\\project
6. 报告项目路径、静态检查结果和待核验事项，然后 STOP。
   不运行 render-pptx、node main.mjs、动态 import 或其他生成模块的测试执行。
   实际源代码审阅、执行许可、渲染、PowerPoint 逐页及编辑审阅由宿主另行完成。
`;
}

export async function preparePptxEval({ output, baseline, candidate }) {
  const target = await safePath(output);
  if (await fs.lstat(target).then(() => true, error => {
    if (error.code !== 'ENOENT') throw error;
    return false;
  })) throw new Error(`Output already exists (including empty directories): ${target}`);
  if (!path.isAbsolute(baseline ?? '') || !path.isAbsolute(candidate ?? '')) {
    throw new Error('--baseline and --candidate must be absolute built aha-explain directories');
  }
  const sourceBytes = {};
  for (const name of ['cases.json', 'prepare.mjs', 'inspect.mjs']) {
    sourceBytes[name] = await readRegular(path.join(here, name));
  }
  const corpus = JSON.parse(sourceBytes['cases.json']);
  const bundles = {};
  for (const [condition, source] of Object.entries({ baseline, candidate })) {
    await safePath(source);
    if (contains(source, target) || contains(target, source)) throw new Error('Output and bundle must not overlap');
    const files = await inventory(source);
    if (!files['SKILL.md']?.bytes || !files['scripts/aha.mjs']?.bytes) throw new Error(`Incomplete built bundle: ${source}`);
    bundles[condition] = { source: path.resolve(source), files };
  }
  const inputs = {};
  for (const item of corpus.cases) {
    safeRelative(item.id);
    const research = fromRelative(repositoryRoot, item.research);
    if (contains(target, research) || contains(research, target)) throw new Error('Output and inputs must not overlap');
    const files = await inventory(research);
    for (const required of ['manifest.json', 'research.json', 'report.md']) {
      if (!files[required]?.bytes) throw new Error(`Missing Dossier file: ${research} ${required}`);
    }
    const asset = item.asset ? await readRegular(fromRelative(repositoryRoot, item.asset)) : null;
    inputs[item.id] = { research, files, asset };
  }

  // Reserve once after preflight. Never merge with or clean up an existing run.
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.mkdir(target);
  const evaluator = path.join(target, 'evaluator');
  const run = {
    schema_version: 1, round: corpus.round, prepared_at: new Date().toISOString(),
    status: 'prepared-not-generated', frozen_before_generation: true,
    isolation: 'Procedural only on a shared filesystem; no OS isolation or sandbox is claimed.',
    bundle_policy: 'Copied byte snapshots, read-only file attributes, full SHA-256 inventory; verify again before execution. Not tamper-proof.',
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    source_files: {}, bundles: {}, cases: [],
    observations: [], judgments: [],
    metrics: { model: null, input_tokens: null, output_tokens: null, runtime_ms: null, cost: null },
  };
  for (const [name, bytes] of Object.entries(sourceBytes)) {
    await writeNew(path.join(evaluator, 'source', name), bytes);
    run.source_files[name] = { bytes: bytes.length, sha256: sha256(bytes) };
  }
  for (const [condition, bundle] of Object.entries(bundles)) {
    const pinned = path.join(target, 'bundles', condition, 'aha-explain');
    const files = await copyInventory(bundle.source, pinned, bundle.files, true);
    run.bundles[condition] = {
      original_path: bundle.source, pinned_path: pinned, files,
      inventory_sha256: sha256(json(files)),
    };
  }
  for (const item of corpus.cases) {
    const rubric = { schema_version: 1, case_id: item.id, criteria: [...corpus.common_rubric, ...item.rubric] };
    const caseEvaluator = path.join(evaluator, item.id);
    await writeNew(path.join(caseEvaluator, 'rubric.json'), json(rubric));
    await writeNew(path.join(caseEvaluator, 'eval_metadata.json'), json({
      eval_id: item.id, eval_name: item.id, prompt: `${corpus.common_prompt}\n\n${item.prompt}`,
      assertions: rubric.criteria.map(row => row.criterion),
      observation_policy: 'Record actual observations with artifact/slide/tool locators separately from judgments. Pending is not passed.',
      conditions: Object.fromEntries(['baseline', 'candidate'].map(condition => [condition, {
        status: 'pending', observations: [],
        judgments: rubric.criteria.map(row => ({ id: row.id, status: 'pending', score: null, evidence: [], rationale: null })),
        metrics: { model: null, input_tokens: null, output_tokens: null, runtime_ms: null, cost: null },
        source_review: null, execution_approval: null, static_check: null, powerpoint_review: null,
      }])),
    }));
    for (const condition of ['baseline', 'candidate']) {
      const author = path.join(target, item.id, condition);
      const input = inputs[item.id];
      await copyInventory(input.research, path.join(author, 'inputs', 'research'), input.files, true);
      let imagePath = null;
      if (input.asset) {
        imagePath = path.join(author, 'inputs', 'assets', path.basename(item.asset));
        await writeNew(imagePath, input.asset);
        await fs.chmod(imagePath, 0o444);
      }
      await fs.mkdir(path.join(author, 'outputs'));
      const task = {
        id: item.id, prompt: `${corpus.common_prompt}\n\n${item.prompt}`,
        author_directory: author, skill: run.bundles[condition].pinned_path,
        research: path.join('inputs', 'research'), project: path.join('outputs', 'project'),
        approved_image_path: imagePath,
      };
      await writeNew(path.join(author, 'task.json'), json(task));
      await writeNew(path.join(author, 'RUN.md'), authorRun(task));
      const staged = await inventory(path.join(author, 'inputs'));
      run.cases.push({
        id: item.id, condition, author_directory: author,
        input_source: { research: input.research, files: input.files,
          asset: item.asset ? { path: item.asset, bytes: input.asset.length, sha256: sha256(input.asset) } : null },
        staged_inputs: staged,
        task_files: Object.fromEntries(await Promise.all(['task.json', 'RUN.md'].map(async name => {
          const bytes = await readRegular(path.join(author, name));
          return [name, { bytes: bytes.length, sha256: sha256(bytes) }];
        }))),
      });
    }
  }
  run.evaluator_files = await inventory(evaluator);
  await writeNew(path.join(evaluator, 'run.json'), json(run));
  return run;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  try {
    if (args.length !== 5 || args[1] !== '--baseline' || args[3] !== '--candidate') {
      throw new Error('Usage: node evals\\pptx-first-round\\prepare.mjs <new-output-directory> --baseline <absolute built aha-explain dir> --candidate <absolute built aha-explain dir>');
    }
    const run = await preparePptxEval({ output: args[0], baseline: args[2], candidate: args[4] });
    console.log(JSON.stringify({ status: run.status, cases: run.cases.length, output: path.resolve(args[0]) }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
