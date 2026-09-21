import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inventory, readRegular, safePath, safeRelative, sha256 } from './prepare.mjs';

const conditions = ['baseline', 'candidate'];
const caseIds = ['git-merge', 'anc', 'greenland', 'aha-introduction'];
const sourceNames = ['cases.json', 'prepare.mjs', 'inspect.mjs', 'verify-run.mjs'];
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const within = (parent, child) => {
  const relative = path.relative(parent, child);
  return !relative || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
};

function normalizeConditionPaths(value, author, bundle) {
  let normalized = value;
  for (const [directory, marker] of [[author, '<AUTHOR>'], [bundle, '<PINNED_SKILL>']]) {
    normalized = normalized.split(JSON.stringify(directory).slice(1, -1)).join(marker);
    normalized = normalized.split(directory).join(marker);
  }
  return normalized;
}

export async function verifyRun(runRoot, reportPath) {
  const root = await safePath(runRoot);
  const destination = await safePath(reportPath);
  if (path.extname(destination).toLowerCase() !== '.json') throw new Error('Report must be a new .json file');
  for (const protectedDirectory of ['bundles', ...caseIds, path.join('evaluator', 'source')]) {
    if (within(path.join(root, protectedDirectory), destination)) throw new Error('Report cannot be written into author inputs/outputs, bundles or frozen source');
  }
  if (await fs.lstat(destination).then(() => true, error => {
    if (error.code !== 'ENOENT') throw error;
    return false;
  })) throw new Error(`Report already exists: ${destination}`);
  const manifestPath = path.join(root, 'evaluator', 'run.json');
  const manifestBytes = await readRegular(manifestPath);
  const report = {
    schema_version: 1, verification: 'static-run-integrity-only',
    run_root: root, manifest_path: manifestPath, manifest_sha256: sha256(manifestBytes),
    checked_at: new Date().toISOString(), status: 'pending',
    verified: { source_files: 0, bundle_files: 0, input_files: 0, task_files: 0,
      bundle_inventory_hashes: 0, input_pairs: 0, prompt_pairs: 0, task_pairs: 0, instruction_pairs: 0 },
    source_snapshot_status: 'not-recorded',
    failures: [],
    behavior_and_process: {
      status: 'unknown', author_tool_usage: null, procedural_isolation_compliance: null,
      generated_source_safety: null, execution_approval: null, semantic_quality: null,
      powerpoint_review: null, model: null, input_tokens: null, output_tokens: null, runtime_ms: null,
    },
    limitations: [
      'Hashes compare observed bytes against the supplied run.json; the manifest is not an independently authenticated or tamper-proof trust anchor.',
      'This is a point-in-time file check, not proof that authors used these files, followed instructions, or remained isolated.',
      'No author outputs are read. No generated module is imported/executed, rendered, or semantically graded.',
      'Original bundle/checkout paths are not read; only staged inputs, pinned bundles, task/RUN packets and recorded frozen evaluator/source files are checked.',
      'Mutable evaluator observations/metadata and grading reports are not hash-verified. Successful hashes do not imply behavioral/process or PowerPoint approval.',
      'Counts are successfully matched file records per scope and successful pair comparisons, not shape counts or quality scores.',
    ],
  };
  function fail(scope, check, file, expected, actual) {
    report.failures.push({ scope, check, path: file, expected, actual });
  }
  function equal(scope, check, file, expected, actual) {
    if (stable(expected) === stable(actual)) return true;
    fail(scope, check, file, expected, actual);
    return false;
  }
  function fileMap(value, scope, allowed = () => true) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length) {
      fail(scope, 'nonempty-file-inventory', null, 'nonempty object', value ?? null);
      return {};
    }
    const valid = {};
    for (const [name, hash] of Object.entries(value)) {
      try {
        safeRelative(name);
        if (!allowed(name) || !hash || !Number.isInteger(hash.bytes) || hash.bytes < 0 ||
            !/^[a-f0-9]{64}$/.test(hash.sha256)) throw new Error('Unexpected path or invalid byte/hash record');
        valid[name] = hash;
      } catch (error) {
        fail(scope, 'safe-file-record', name, 'allowed path and byte/SHA-256 record', error.message);
      }
    }
    return valid;
  }
  async function checkFiles(directory, expected, scope, count, wholeTree) {
    const actual = {};
    const buffers = {};
    if (wholeTree) {
      try {
        Object.assign(actual, await inventory(directory));
      } catch (error) {
        fail(scope, 'read-safe-directory', directory, 'readable tree without symlinks/hardlinks', error.message);
        return { actual: null, buffers };
      }
    } else {
      for (const relative of Object.keys(expected)) {
        const file = path.join(directory, ...relative.split('/'));
        try {
          const bytes = await readRegular(file);
          buffers[relative] = bytes;
          actual[relative] = { bytes: bytes.length, sha256: sha256(bytes) };
        } catch (error) {
          fail(scope, 'read-safe-file', file, expected[relative], error.message);
        }
      }
    }
    for (const [relative, hash] of Object.entries(expected)) {
      if (equal(scope, 'file-bytes-and-sha256', path.join(directory, ...relative.split('/')), hash, actual[relative] ?? null)) {
        report.verified[count]++;
      }
    }
    for (const relative of Object.keys(actual)) {
      if (!Object.hasOwn(expected, relative)) fail(scope, 'unrecorded-file', path.join(directory, ...relative.split('/')), null, actual[relative]);
    }
    return { actual, buffers };
  }

  try {
    const run = JSON.parse(manifestBytes);
    if (run.schema_version !== 1 || run.round !== 'pptx-first-round' || !Array.isArray(run.cases)) {
      throw new Error('Unsupported run manifest');
    }
    let corpus = null;
    if (run.source_files && Object.keys(run.source_files).length) {
      const before = report.failures.length;
      const expected = fileMap(run.source_files, 'source', name => sourceNames.includes(name));
      const result = await checkFiles(path.join(root, 'evaluator', 'source'), expected, 'source', 'source_files', true);
      if (result.actual && expected['cases.json'] &&
          stable(result.actual['cases.json']) === stable(expected['cases.json'])) {
        corpus = JSON.parse(await readRegular(path.join(root, 'evaluator', 'source', 'cases.json')));
      }
      report.source_snapshot_status = before === report.failures.length ? 'hashes-verified' : 'mismatch';
    }

    for (const condition of conditions) {
      const bundle = run.bundles?.[condition];
      const directory = path.join(root, 'bundles', condition, 'aha-explain');
      equal(condition, 'pinned-bundle-path', directory, directory, bundle?.pinned_path ?? null);
      const expected = fileMap(bundle?.files, `${condition}-bundle`);
      const { actual } = await checkFiles(directory, expected, `${condition}-bundle`, 'bundle_files', true);
      if (bundle?.files && equal(condition, 'manifest-bundle-inventory-sha256', directory,
        bundle.inventory_sha256, sha256(json(bundle.files))) && actual &&
        equal(condition, 'observed-bundle-inventory-sha256', directory, bundle.inventory_sha256, sha256(json(actual)))) {
        report.verified.bundle_inventory_hashes++;
      }
    }

    const records = new Map();
    for (const entry of run.cases) {
      if (!caseIds.includes(entry?.id) || !conditions.includes(entry?.condition)) {
        fail('manifest', 'known-case-condition', null, 'one of four case IDs and baseline/candidate', entry);
        continue;
      }
      const key = `${entry.id}/${entry.condition}`;
      if (records.has(key)) fail('manifest', 'unique-case-condition', key, 'one record', 'duplicate');
      else records.set(key, entry);
    }
    for (const id of caseIds) {
      const pair = {};
      for (const condition of conditions) {
        const scope = `${id}/${condition}`;
        const entry = records.get(scope);
        if (!entry) {
          fail(scope, 'case-record', null, 'present', null);
          continue;
        }
        const author = path.join(root, id, condition);
        const bundle = path.join(root, 'bundles', condition, 'aha-explain');
        equal(scope, 'author-directory', author, author, entry.author_directory);
        const expectedInputs = fileMap(entry.staged_inputs, scope, name => name.startsWith('research/') || name.startsWith('assets/'));
        const inputs = await checkFiles(path.join(author, 'inputs'), expectedInputs, scope, 'input_files', true);
        const expectedTasks = fileMap(entry.task_files, scope, name => ['task.json', 'RUN.md'].includes(name));
        for (const required of ['task.json', 'RUN.md']) {
          if (!expectedTasks[required]) fail(scope, 'required-task-hash', required, 'recorded', null);
        }
        const tasks = await checkFiles(author, expectedTasks, scope, 'task_files', false);
        let task = null;
        try {
          if (tasks.buffers['task.json']) task = JSON.parse(tasks.buffers['task.json']);
        } catch (error) {
          fail(scope, 'parse-task', path.join(author, 'task.json'), 'JSON object', error.message);
        }
        if (task) {
          equal(scope, 'task-id', null, id, task.id);
          equal(scope, 'task-author-directory', null, author, task.author_directory);
          equal(scope, 'task-pinned-skill', null, bundle, task.skill);
          equal(scope, 'task-research-path', null, path.join('inputs', 'research'), task.research);
          equal(scope, 'task-project-path', null, path.join('outputs', 'project'), task.project);
          equal(scope, 'approved-image-path', null, id === 'aha-introduction'
            ? path.join(author, 'inputs', 'assets', 'git-slide-03.png') : null, task.approved_image_path);
          if (typeof task.prompt !== 'string' || !task.prompt.trim()) fail(scope, 'nonempty-prompt', null, 'nonempty string', task.prompt ?? null);
          const original = corpus?.cases?.find(item => item.id === id);
          if (original) equal(scope, 'frozen-case-prompt', null, `${corpus.common_prompt}\n\n${original.prompt}`, task.prompt);
        }
        pair[condition] = {
          inputs: inputs.actual, task,
          normalizedTask: task ? normalizeConditionPaths(stable(task), author, bundle) : null,
          normalizedInstructions: tasks.buffers['RUN.md'] ? normalizeConditionPaths(tasks.buffers['RUN.md'].toString('utf8'), author, bundle) : null,
        };
      }
      const a = pair.baseline;
      const b = pair.candidate;
      if (!a || !b) continue;
      if (a.inputs && b.inputs && equal(id, 'paired-inputs', null, a.inputs, b.inputs)) report.verified.input_pairs++;
      if (typeof a.task?.prompt === 'string' && a.task.prompt.trim() && typeof b.task?.prompt === 'string' &&
          equal(id, 'paired-prompt', null, a.task.prompt, b.task.prompt)) report.verified.prompt_pairs++;
      if (a.normalizedTask && b.normalizedTask && equal(id, 'paired-task-except-condition-paths', null, a.normalizedTask, b.normalizedTask)) report.verified.task_pairs++;
      if (a.normalizedInstructions && b.normalizedInstructions &&
          equal(id, 'paired-instructions-except-condition-paths', null, a.normalizedInstructions, b.normalizedInstructions)) report.verified.instruction_pairs++;
    }
  } catch (error) {
    fail('manifest', 'read-and-verify-manifest', manifestPath, 'supported valid manifest and frozen source JSON', error.message);
  }
  try {
    equal('manifest', 'manifest-unchanged-during-verification', manifestPath, report.manifest_sha256, sha256(await readRegular(manifestPath)));
  } catch (error) {
    fail('manifest', 'manifest-unchanged-during-verification', manifestPath, report.manifest_sha256, error.message);
  }
  report.status = report.failures.length ? 'mismatch' : 'hashes-and-pairs-verified';
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, json(report), { flag: 'wx' });
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4) throw new Error('Usage: node evals\\pptx-first-round\\verify-run.mjs <run-root> <new-report-path.json>');
    const report = await verifyRun(process.argv[2], process.argv[3]);
    console.log(JSON.stringify({ status: report.status, verified: report.verified, failures: report.failures.length,
      behavior_and_process: report.behavior_and_process.status, report: path.resolve(process.argv[3]) }));
    if (report.failures.length) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
