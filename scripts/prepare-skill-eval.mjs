import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const fixtureRoot = fileURLToPath(new URL('../evals/skills/', import.meta.url));
const json = value => `${JSON.stringify(value, null, 2)}\n`;
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const dimensions = ['correctness_source_support', 'structure_operation', 'clarity_visual', 'human_comprehension'];
const names = ['aha-research', 'aha-explain'];
const canonicalText = bytes => Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');

export function safeRelative(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes(':') ||
    value.split('/').some(part => !part || part === '.' || part === '..' ||
      /[<>:"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(part))) {
    throw new Error(`Unsafe relative path: ${value}`);
  }
  return value;
}

async function safePath(target) {
  const absolute = path.resolve(target);
  let cursor = path.parse(absolute).root;
  for (const part of absolute.slice(cursor.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    const stat = await fs.lstat(cursor).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
    if (stat?.isSymbolicLink()) throw new Error(`Symlink/junction refused: ${cursor}`);
    if (stat && cursor !== absolute && !stat.isDirectory()) throw new Error(`Not a directory: ${cursor}`);
  }
}

async function readRegular(file) {
  await safePath(file);
  if (!(await fs.lstat(file)).isFile()) throw new Error(`Not a regular file: ${file}`);
  return fs.readFile(file);
}

async function inventory(directory, prefix = '') {
  await safePath(directory);
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const result = {};
  for (const entry of entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const relative = safeRelative(prefix + entry.name);
    const target = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink/junction refused: ${target}`);
    if (entry.isDirectory()) Object.assign(result, await inventory(target, `${relative}/`));
    else {
      const bytes = await readRegular(target);
      result[relative] = { sha256: sha256(bytes), bytes: bytes.length };
    }
  }
  return result;
}

function contained(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export function validateHumanResponse(value) {
  if (!value || value.schema_version !== 1 || !['pending', 'collected', 'scored'].includes(value.status)) {
    throw new Error('Invalid human response status/schema');
  }
  if (!Array.isArray(value.responses)) throw new Error('Human responses must be an array');
  if (value.status === 'pending') {
    if (value.consent !== null || value.comprehension_score !== null || value.responses.length ||
        value.anonymous_participant_id !== null || value.rater_id !== null) {
      throw new Error('Pending human response must contain null/uncollected values');
    }
    return;
  }
  if (value.consent !== true || !value.anonymous_participant_id ||
      !Number.isInteger(value.case_id) || !value.blind_artifact_label ||
      !['pre-post', 'balanced-order'].includes(value.design) ||
      !['pre', 'post'].includes(value.phase) || !Array.isArray(value.presentation_order) ||
      !value.presentation_order.length || value.responses.length < 2 || value.responses.length > 3) {
    throw new Error('Collected human response requires consent, anonymous ID, design and 2–3 responses');
  }
  const ids = new Set();
  for (const response of value.responses) {
    if (!response.question_id || ids.has(response.question_id) || typeof response.answer !== 'string' || !response.answer.trim()) {
      throw new Error('Invalid human question/answer');
    }
    ids.add(response.question_id);
    if (value.status === 'collected' && (response.score !== null || response.rationale !== null)) {
      throw new Error('Unscored responses must have null scores/rationales');
    }
    if (value.status === 'scored' && (![0, 1, 2].includes(response.score) ||
        typeof response.rationale !== 'string' || !response.rationale.trim())) {
      throw new Error('Scored responses require a 0–2 score and evidence rationale');
    }
  }
  if (value.status === 'collected' && value.comprehension_score !== null) throw new Error('Unscored total must be null');
  if (value.status === 'scored' &&
      (!value.rater_id || value.comprehension_score !== value.responses.reduce((sum, row) => sum + row.score, 0))) {
    throw new Error('Scored total must equal response scores and identify an anonymized rater');
  }
}

export function validateProcessObservations(value) {
  if (value?.schema_version !== 1 || value.rubricVersion !== 2 || !Array.isArray(value.checks) || !value.checks.length) {
    throw new Error('Invalid process observations schema/version');
  }
  const ids = new Set();
  for (const check of value.checks) {
    if (!check.id || ids.has(check.id) || !check.text || !check.required_evidence ||
        !['pending', 'verified', 'failed', 'insufficient-evidence'].includes(check.status) ||
        !Array.isArray(check.evidence)) throw new Error('Invalid process observation');
    ids.add(check.id);
    const expected = check.status === 'verified' ? true : check.status === 'failed' ? false : null;
    if (check.result !== expected) throw new Error('Unknown process observations require null; verified/failed require true/false');
    if (check.status === 'pending' && (check.evidence.length || check.reason !== null)) {
      throw new Error('Pending process observations must be uncollected');
    }
    if (check.status !== 'pending' && (typeof check.reason !== 'string' || !check.reason.trim())) {
      throw new Error('Reviewed process observations require a reason');
    }
    if (['verified', 'failed'].includes(check.status) &&
        (!check.evidence.length || check.evidence.some(item => typeof item !== 'string' || !item.trim()))) {
      throw new Error('Verified/failed process observations require evidence locators');
    }
  }
}

export async function loadFixtures() {
  const lockBytes = canonicalText(await readRegular(path.join(fixtureRoot, 'fixture-lock.json')));
  const lock = JSON.parse(lockBytes);
  if (lock.schema_version !== 1 || lock.rubricVersion !== 2 || lock.normalization !== 'utf8-lf' || !lock.files || !Object.keys(lock.files).length) throw new Error('Invalid fixture lock');
  const files = {};
  for (const [relative, hash] of Object.entries(lock.files)) {
    safeRelative(relative);
    if (!/^(evals\.json|inputs\/.+|evaluator\/.+)$/.test(relative)) throw new Error(`Unexpected fixture path: ${relative}`);
    const bytes = canonicalText(await readRegular(path.join(fixtureRoot, ...relative.split('/'))));
    if (sha256(bytes) !== hash) throw new Error(`Fixture hash mismatch: ${relative}`);
    files[relative] = bytes;
  }
  const actual = await inventory(fixtureRoot);
  if (Object.keys(actual).some(relative => relative !== 'fixture-lock.json' && !files[relative])) {
    throw new Error('Unbound fixture file');
  }
  const manifest = JSON.parse(files['evals.json']);
  const processChecks = JSON.parse(files['evaluator/process-checks.json']);
  validateProcessObservations({
    ...processChecks,
    checks: processChecks.checks.map(check => ({ ...check, status: 'pending', result: null, reason: null, evidence: [] })),
  });
  const ids = new Set();
  const caseNames = new Set();
  for (const item of manifest.evals ?? []) {
    if (!Number.isInteger(item.id) || ids.has(item.id) || !/^[a-z0-9-]+$/.test(item.name) ||
        caseNames.has(item.name) || !names.includes(item.skill) || !item.prompt?.trim() ||
        !item.expected_output?.trim() || !Array.isArray(item.files) || !item.files.length) {
      throw new Error('Invalid evaluation case');
    }
    ids.add(item.id);
    caseNames.add(item.name);
    for (const file of item.files) {
      safeRelative(file);
      if (!file.startsWith(`inputs/${item.name}/`) || !files[file]?.length) throw new Error(`Invalid author input: ${file}`);
    }
    safeRelative(item.evaluator);
    if (!item.evaluator.startsWith('evaluator/') || !files[item.evaluator]) throw new Error('Missing evaluator rubric');
    const grading = JSON.parse(files[item.evaluator]);
    if (grading.eval_id !== item.id || grading.rubricVersion !== 2 ||
        grading.process_checks !== 'evaluator/process-checks.json') throw new Error('Mismatched rubric ID/version/process checks');
    for (const dimension of dimensions) {
      if (!grading.rubric?.[dimension]?.length || grading.rubric[dimension].some(row => !row.id || !row.text?.trim())) {
        throw new Error(`Empty rubric dimension: ${dimension}`);
      }
    }
    if (grading.rubric.correctness_source_support.some(row => !row.locators?.length) ||
        grading.transfer?.length < 2 || grading.transfer?.length > 3 ||
        !grading.transfer?.every(row => row.id && row.question?.trim() && row.expected_reasoning?.trim())) {
      throw new Error('Missing source locators or transfer questions/keys');
    }
  }
  if (ids.size !== 4) throw new Error('Expected four evaluation cases');
  const humanTemplate = JSON.parse(files['evaluator/human-response-template.json']);
  validateHumanResponse(humanTemplate);
  return { manifest, files, lock, lockSha256: sha256(lockBytes), humanTemplate, processChecks };
}

async function writeNew(file, bytes) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes, { flag: 'wx' });
}

async function resolveGit(explicit, forbiddenRoots) {
  if (explicit && !path.isAbsolute(explicit)) throw new Error('--git must be absolute');
  const candidates = explicit ? [explicit] : (process.env.PATH ?? '').split(path.delimiter)
    .filter(directory => directory && path.isAbsolute(directory))
    .map(directory => path.join(directory, process.platform === 'win32' ? 'git.exe' : 'git'));
  for (const candidate of candidates) {
    if (forbiddenRoots.some(root => contained(root, candidate))) continue;
    try {
      // Git itself may be an OS-managed symlink. Resolve it, never a fixture-local executable.
      const resolved = await fs.realpath(candidate);
      if (forbiddenRoots.some(root => contained(root, resolved))) continue;
      if ((await fs.stat(resolved)).isFile()) return resolved;
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
    }
  }
  throw new Error('Trusted Git executable not found; use --git <absolute-path>');
}

async function makeGitContext(executable, evaluatorRoot) {
  const home = path.join(evaluatorRoot, 'git-environment');
  const template = path.join(home, 'empty-template');
  await fs.mkdir(template, { recursive: true });
  const config = path.join(home, 'empty-config');
  await writeNew(config, '');
  const env = {
    PATH: [path.dirname(executable), process.env.SystemRoot && path.join(process.env.SystemRoot, 'System32')]
      .filter(Boolean).join(path.delimiter),
    HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: home,
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: config,
    GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0',
    GIT_AUTHOR_NAME: 'Synthetic Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Synthetic Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
    GIT_AUTHOR_DATE: '2030-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2030-01-01T00:00:00Z',
    LC_ALL: 'C', TZ: 'UTC',
    ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot, WINDIR: process.env.SystemRoot } : {}),
  };
  const git = (cwd, args) => execFileSync(executable, [
    '-c', 'core.hooksPath=.git/no-hooks', '-c', 'core.fsmonitor=false',
    '-c', 'core.autocrlf=false', '-c', 'core.safecrlf=false',
    '-c', 'commit.gpgSign=false', '-c', 'core.quotePath=false', ...args,
  ], { cwd, env, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  return { git, template, version: git(evaluatorRoot, ['--version']).trim(), executable };
}

async function stageDirtyGit(directory, recipe, context) {
  const { git, template } = context;
  if (recipe.recipe !== 'dirty-git-v1' || recipe.commit_timestamp !== '2030-01-01T00:00:00Z') throw new Error('Invalid Git recipe');
  git(directory, ['init', '--quiet', '--object-format=sha1', '--initial-branch=fixture', `--template=${template}`, '.']);
  await fs.mkdir(path.join(directory, '.git', 'no-hooks'));
  git(directory, ['config', '--local', 'core.hooksPath', '.git/no-hooks']);
  git(directory, ['config', '--local', 'core.fsmonitor', 'false']);
  git(directory, ['config', '--local', 'core.autocrlf', 'false']);
  const tracked = ['README.md', 'config.mjs', 'worker.mjs', 'worker.test.mjs'];
  git(directory, ['add', '--', ...tracked]);
  git(directory, ['commit', '--quiet', '--no-verify', '-m', 'Original synthetic parcel relay fixture']);
  for (const change of [recipe.staged, recipe.unstaged]) {
    safeRelative(change.path);
    const file = path.join(directory, ...change.path.split('/'));
    const text = (await readRegular(file)).toString();
    if (text.split(change.before).length !== 2) throw new Error(`Git recipe replacement is not unique: ${change.path}`);
    await fs.writeFile(file, text.replace(change.before, change.after));
    if (change === recipe.staged) git(directory, ['add', '--', change.path]);
  }
  safeRelative(recipe.untracked.path);
  await writeNew(path.join(directory, ...recipe.untracked.path.split('/')), recipe.untracked.content);
  const revisions = {};
  for (const file of tracked) {
    revisions[file] = {
      head: sha256(git(directory, ['show', `HEAD:${file}`])),
      index: sha256(git(directory, ['show', `:${file}`])),
      worktree: sha256(await readRegular(path.join(directory, file))),
    };
  }
  revisions[recipe.untracked.path] = { head: null, index: null, worktree: sha256(recipe.untracked.content) };
  const snapshot = {
    head: git(directory, ['rev-parse', 'HEAD']).trim(),
    status: git(directory, ['status', '--porcelain=v1', '--untracked-files=all']),
    staged_diff: git(directory, ['diff', '--cached', '--no-ext-diff', '--no-textconv', '--']),
    unstaged_diff: git(directory, ['diff', '--no-ext-diff', '--no-textconv', '--']),
    files: revisions,
  };
  if (snapshot.status !== 'M  config.mjs\n M worker.mjs\n?? ticket.md\n') throw new Error(`Unexpected Git state: ${snapshot.status}`);
  return snapshot;
}

const authorInstructions = `# Author run

Read task.json and the selected skill's SKILL.md. Perform only that task.
The task.json fields are id, prompt, skill (absolute bundle directory) and files (relative inputs).
Inputs are original synthetic fixtures, not real studies or live-web findings.
Write deliverables only inside outputs. Treat inputs and the selected skill as read-only.
Read only this case's packet and the selected installed skill bundle. Do not inspect sibling
cases, the source checkout, evaluator metadata, rubrics, transfer questions or answer keys.

Permissions: read inputs and skill references; use the trusted selected Aha CLI for checks,
builds and packaging of your deliverables where those operations do not execute authored code.
Read-only Git inspection is allowed with external diff/textconv/fsmonitor disabled.
Do not execute input code/tests or authored HTML/JavaScript; do not browse/render authored HTML.
No network, package installs, shell hooks, publication or changes to input Git state.
If a check needs forbidden execution or unavailable tools, record it as not run.
Record actual CLI checks and their limits; do not invent runtime tests or learner scores.
The host supplies the same model, tools and budgets to both conditions.
`;

export async function prepareSkillEval({ output, skillRoot, cases = [], label = 'unlabelled', gitExecutable } = {}) {
  if (!output || typeof output !== 'string') throw new Error('A new output directory is required');
  if (!skillRoot || !path.isAbsolute(skillRoot)) throw new Error('--skill-root must be an absolute bundles directory');
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(label)) throw new Error('Invalid label');
  const destination = path.resolve(output);
  const bundles = path.resolve(skillRoot);
  if (contained(fixtureRoot, destination) || contained(bundles, destination) || contained(destination, bundles)) {
    throw new Error('Output must be separate from fixtures and skill bundles');
  }
  await safePath(destination);
  await safePath(bundles);
  if (await fs.lstat(destination).catch(error => { if (error.code !== 'ENOENT') throw error; })) {
    throw new Error(`Refusing to overwrite existing output: ${destination}`);
  }
  const corpus = await loadFixtures();
  const requested = new Set(cases.map(String));
  for (const value of requested) {
    if (!corpus.manifest.evals.some(item => String(item.id) === value || item.name === value)) throw new Error(`Unknown case: ${value}`);
  }
  const selected = corpus.manifest.evals.filter(item => !requested.size || requested.has(String(item.id)) || requested.has(item.name));
  const skills = {};
  for (const name of new Set(selected.map(item => item.skill))) {
    const directory = path.join(bundles, name);
    const files = await inventory(directory);
    if (!files['SKILL.md']?.bytes || !files['scripts/aha.mjs']?.bytes) throw new Error(`Incomplete skill bundle: ${name}`);
    skills[name] = { path: directory, content_sha256: sha256(json(files)), files };
  }
  const needsGit = selected.some(item => item.preparation === 'dirty-git-v1');
  const executable = needsGit ? await resolveGit(gitExecutable, [fileURLToPath(new URL('../', import.meta.url)), destination]) : null;
  // Exclusive reservation: no overwrite, no rollback of a possibly shared directory.
  // A failure leaves an incomplete packet for inspection, without a run.json completion marker.
  await fs.mkdir(destination);
  const evaluatorRoot = path.join(destination, 'evaluator');
  await fs.mkdir(evaluatorRoot);
  const gitContext = needsGit ? await makeGitContext(executable, evaluatorRoot) : null;
  const run = {
    schema_version: 1, rubricVersion: 2, status: 'prepared', label, created_at: new Date().toISOString(),
    preparer_sha256: sha256(await readRegular(fileURLToPath(import.meta.url))),
    environment: { node: process.version, platform: process.platform, arch: process.arch,
      git: gitContext ? { executable, version: gitContext.version } : null },
    corpus: { lock_sha256: corpus.lockSha256, manifest_sha256: corpus.lock.files['evals.json'], files: corpus.lock.files },
    skills, cases: [],
    generation: { status: 'pending', model: null, tools: null, budget: null, seed: null, tokens: null, duration_ms: null },
  };
  for (const item of selected) {
    const author = path.join(destination, 'author', item.name);
    await fs.mkdir(path.join(author, 'outputs'), { recursive: true });
    for (const relative of item.files) {
      await writeNew(path.join(author, ...relative.split('/')), corpus.files[relative]);
    }
    let snapshot = null;
    const authorFiles = [...item.files];
    if (item.preparation === 'dirty-git-v1') {
      const recipe = JSON.parse(corpus.files['evaluator/git-state.json']);
      snapshot = await stageDirtyGit(path.join(author, 'inputs', item.name), recipe, gitContext);
      authorFiles.push(`inputs/${item.name}/${recipe.untracked.path}`);
    }
    const task = { id: item.id, prompt: item.prompt, skill: skills[item.skill].path, files: authorFiles };
    await writeNew(path.join(author, 'task.json'), json(task));
    await writeNew(path.join(author, 'RUN.md'), authorInstructions);
    const inputHashes = {};
    for (const relative of authorFiles) inputHashes[relative] = sha256(await readRegular(path.join(author, ...relative.split('/'))));
    const processObservations = {
      schema_version: 1, rubricVersion: 2, eval_id: item.id,
      checks: corpus.processChecks.checks.map(check => ({
        ...check, status: 'pending', result: null, reason: null, evidence: [],
      })),
    };
    validateProcessObservations(processObservations);
    const metadata = {
      id: item.id, name: item.name, rubricVersion: 2, expected_output: item.expected_output,
      author_directory: author, task_sha256: sha256(json(task)), prompt_sha256: sha256(item.prompt),
      instructions_sha256: sha256(authorInstructions), input_sha256: inputHashes, git_snapshot: snapshot,
      rubric: JSON.parse(corpus.files[item.evaluator]),
      process_observations: processObservations,
      grading: Object.fromEntries(dimensions.map(dimension => [dimension, { status: 'pending', score: null, evidence: [] }])),
    };
    await writeNew(path.join(evaluatorRoot, item.name, 'eval-metadata.json'), json(metadata));
    await writeNew(path.join(evaluatorRoot, item.name, 'eval_metadata.json'), json({
      rubricVersion: 2,
      eval_id: item.id,
      eval_name: item.name,
      prompt: item.prompt,
      assertions: ['correctness_source_support', 'structure_operation']
        .flatMap(dimension => metadata.rubric.rubric[dimension].map(row => row.text)),
    }));
    await writeNew(path.join(evaluatorRoot, item.name, 'process-observations.json'), json(processObservations));
    await writeNew(path.join(evaluatorRoot, item.name, 'human-responses.json'), json(corpus.humanTemplate));
    run.cases.push({ id: item.id, name: item.name, author_directory: author,
      metadata: path.join(evaluatorRoot, item.name, 'eval-metadata.json') });
  }
  await writeNew(path.join(evaluatorRoot, 'run.json'), json(run));
  return run;
}

function parseArguments(args) {
  const options = { output: args[0], cases: [] };
  if (!options.output || options.output.startsWith('--')) throw new Error('Usage: node scripts\\prepare-skill-eval.mjs <new-output-directory> --skill-root <absolute-bundles-directory> [--case <id-or-name>] [--label <label>] [--git <absolute-executable>]');
  const seen = new Set();
  for (let index = 1; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!['--skill-root', '--case', '--label', '--git'].includes(flag) || !value || value.startsWith('--')) throw new Error(`Invalid argument: ${flag}`);
    if (flag !== '--case' && seen.has(flag)) throw new Error(`Duplicate argument: ${flag}`);
    seen.add(flag);
    if (flag === '--case') options.cases.push(value);
    else options[({ '--skill-root': 'skillRoot', '--label': 'label', '--git': 'gitExecutable' })[flag]] = value;
  }
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await prepareSkillEval(parseArguments(process.argv.slice(2)));
    console.log(json({ status: result.status, cases: result.cases.length,
      manifest: path.join(path.resolve(process.argv[2]), 'evaluator', 'run.json') }).trim());
  } catch (error) {
    console.error(`Skill evaluation preparation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
