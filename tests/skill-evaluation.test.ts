import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const runner = await import(pathToFileURL(path.join(root, 'evals', 'skills', 'prepare.mjs')).href);
let workspace: string;
let bundles: string;
let baseline: Awaited<ReturnType<typeof runner.prepareSkillEval>>;
let current: Awaited<ReturnType<typeof runner.prepareSkillEval>>;
let corpus: Awaited<ReturnType<typeof runner.loadFixtures>>;

async function readJson(file: string) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function filesBelow(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, item.name);
    if (item.isDirectory()) files.push(...await filesBelow(target));
    else files.push(target);
  }
  return files;
}

before(async () => {
  await fs.mkdir(path.join(root, 'dist'), { recursive: true });
  workspace = await fs.mkdtemp(path.join(root, 'dist', '.skill-evaluation-test-'));
  bundles = path.join(workspace, 'bundles-a');
  const otherBundles = path.join(workspace, 'bundles-b');
  // Minimal trusted bundle doubles: never execute either CLI or model output.
  for (const directory of [bundles, otherBundles]) {
    for (const name of ['aha-research', 'aha-explain']) {
      await fs.mkdir(path.join(directory, name, 'scripts'), { recursive: true });
      await fs.writeFile(path.join(directory, name, 'SKILL.md'), `# ${name}\nBundle ${path.basename(directory)}\n`);
      await fs.writeFile(path.join(directory, name, 'scripts', 'aha.mjs'), '// Trusted CLI test double; not executed.\n');
    }
  }
  corpus = await runner.loadFixtures();
  baseline = await runner.prepareSkillEval({ output: path.join(workspace, 'a'), skillRoot: bundles, label: 'A' });
  current = await runner.prepareSkillEval({ output: path.join(workspace, 'b'), skillRoot: otherBundles, label: 'B' });
});

after(async () => {
  if (workspace) await fs.rm(workspace, { recursive: true, force: true });
});

test('four realistic cases have canonical hash-bound original sources and withheld nonempty rubrics', async () => {
  assert.equal(corpus.manifest.evals.length, 4);
  assert.equal(corpus.lock.normalization, 'utf8-lf');
  assert.equal(corpus.lock.rubricVersion, 2);
  assert.equal(corpus.lock.supersedes_lock_sha256, '23282bdc4d87e5dbfdb0bc952cd2060c6c30c0a57f04e265720eb8e33296230c');
  for (const [relative, expected] of Object.entries(corpus.lock.files)) {
    const raw = await fs.readFile(path.join(runner.fixtureRoot, ...relative.split('/')), 'utf8');
    assert.equal(runner.sha256(raw.replace(/\r\n/g, '\n')), expected, relative);
  }
  for (const item of corpus.manifest.evals) {
    for (const field of ['id', 'name', 'prompt', 'expected_output', 'files']) assert.ok(item[field]);
    assert.ok(item.files.length > 0 && item.files.length <= 5);
    assert.ok(item.prompt.length < 220);
    const grading = JSON.parse(corpus.files[item.evaluator]);
    assert.equal(grading.rubricVersion, 2);
    assert.equal(grading.process_checks, 'evaluator/process-checks.json');
    assert.deepEqual(Object.keys(grading.rubric), [
      'correctness_source_support', 'structure_operation', 'clarity_visual', 'human_comprehension',
    ]);
    for (const dimension of Object.values(grading.rubric) as Array<Array<{ text: string }>>) {
      assert.ok(dimension.length && dimension.every(row => row.text.trim()));
    }
    assert.ok(grading.transfer.length >= 2 && grading.transfer.length <= 3);
    for (const question of grading.transfer) assert.ok(question.question && question.expected_reasoning);
    for (const row of grading.rubric.correctness_source_support) {
      for (const locator of row.locators as string[]) {
        const [relative, anchor] = locator.split('#');
        let bytes = corpus.files[relative!];
        if (!bytes && relative === 'inputs/code-retry/ticket.md') {
          bytes = Buffer.from(JSON.parse(corpus.files['evaluator/git-state.json']).untracked.content);
        }
        assert.ok(bytes?.length, locator);
        const text = bytes.toString();
        if (text.includes(`[${anchor}]`)) continue;
        const lines = /^L(\d+)(?:-L(\d+))?$/.exec(anchor!);
        assert.ok(lines, locator);
        assert.ok(Number(lines[1]) > 0 && Number(lines[2] ?? lines[1]) <= text.trimEnd().split('\n').length, locator);
      }
    }
  }
});

test('author packets select only id/prompt/skill/files, never evaluator answers or unrelated files', async () => {
  for (const entry of baseline.cases) {
    const item = corpus.manifest.evals.find((row: { id: number }) => row.id === entry.id);
    const packet = await readJson(path.join(entry.author_directory, 'task.json'));
    assert.deepEqual(Object.keys(packet), ['id', 'prompt', 'skill', 'files']);
    assert.equal(packet.prompt, item.prompt);
    assert.equal(packet.skill, path.join(bundles, item.skill));
    const files = await filesBelow(entry.author_directory);
    const contents = (await Promise.all(files.map(file => fs.readFile(file, 'utf8')))).join('\n');
    for (const file of files) {
      const relative = path.relative(entry.author_directory, file);
      assert.ok(!relative.includes('evaluator') && !relative.includes('node_modules'), relative);
      assert.ok(!['evals.json', 'fixture-lock.json', 'prepare.mjs', 'scenarios.json', 'human-responses.json', 'eval-metadata.json', 'eval_metadata.json', 'process-observations.json'].includes(path.basename(file)));
    }
    assert.ok(!contents.includes(item.expected_output));
    for (const evalCase of corpus.manifest.evals) {
      const grading = JSON.parse(corpus.files[evalCase.evaluator]);
      for (const rows of Object.values(grading.rubric) as Array<Array<{ text: string }>>) {
        for (const row of rows) assert.ok(!contents.includes(row.text), row.text);
      }
      for (const question of grading.transfer) {
        assert.ok(!contents.includes(question.question));
        assert.ok(!contents.includes(question.expected_reasoning));
      }
    }
    const metadata = await readJson(entry.metadata);
    const viewer = await readJson(path.join(path.dirname(entry.metadata), 'eval_metadata.json'));
    assert.equal(viewer.eval_id, entry.id);
    assert.equal(viewer.rubricVersion, 2);
    assert.equal(metadata.rubricVersion, 2);
    assert.equal(viewer.eval_name, item.name);
    assert.equal(viewer.prompt, packet.prompt);
    assert.ok(viewer.assertions.length > 0);
    assert.deepEqual(viewer.assertions, [
      ...metadata.rubric.rubric.correctness_source_support,
      ...metadata.rubric.rubric.structure_operation,
    ].map(row => row.text));
    assert.ok(!JSON.stringify(viewer).includes('expected_reasoning'));
    assert.ok(!JSON.stringify(viewer).includes('process_observations'));
    const observations = await readJson(path.join(path.dirname(entry.metadata), 'process-observations.json'));
    assert.deepEqual(metadata.process_observations, observations);
    runner.validateProcessObservations(observations);
    for (const check of observations.checks) {
      assert.equal(check.status, 'pending');
      assert.equal(check.result, null);
      assert.deepEqual(check.evidence, []);
      assert.ok(!contents.includes(check.text));
      assert.ok(!viewer.assertions.includes(check.text));
    }
    for (const relative of packet.files) {
      assert.equal(runner.sha256(await fs.readFile(path.join(entry.author_directory, ...relative.split('/')))),
        metadata.input_sha256[relative]);
    }
    for (const result of Object.values(metadata.grading) as Array<{ status: string; score: null }>) {
      assert.equal(result.status, 'pending');
      assert.equal(result.score, null);
    }
  }
});

test('independent roots preserve comparable prompts and actual deterministic dirty Git identities', async () => {
  assert.equal(baseline.corpus.lock_sha256, current.corpus.lock_sha256);
  assert.notEqual(baseline.skills['aha-research'].content_sha256, current.skills['aha-research'].content_sha256);
  assert.equal(baseline.environment.node, process.version);
  assert.match(baseline.environment.git.version, /^git version /);
  for (let index = 0; index < baseline.cases.length; index++) {
    const a = await readJson(baseline.cases[index].metadata);
    const b = await readJson(current.cases[index].metadata);
    assert.equal(a.prompt_sha256, b.prompt_sha256);
    assert.equal(a.instructions_sha256, b.instructions_sha256);
    assert.deepEqual(a.input_sha256, b.input_sha256);
    assert.deepEqual(a.git_snapshot, b.git_snapshot);
  }
  const entry = baseline.cases.find((item: { id: number }) => item.id === 2);
  const meta = await readJson(entry.metadata);
  const snapshot = meta.git_snapshot;
  assert.match(snapshot.head, /^[a-f0-9]{40}$/);
  assert.equal(snapshot.status, 'M  config.mjs\n M worker.mjs\n?? ticket.md\n');
  assert.notEqual(snapshot.files['config.mjs'].head, snapshot.files['config.mjs'].index);
  assert.equal(snapshot.files['config.mjs'].index, snapshot.files['config.mjs'].worktree);
  assert.equal(snapshot.files['worker.mjs'].head, snapshot.files['worker.mjs'].index);
  assert.notEqual(snapshot.files['worker.mjs'].index, snapshot.files['worker.mjs'].worktree);
  assert.equal(snapshot.files['ticket.md'].head, null);
  const gitDirectory = path.join(entry.author_directory, 'inputs', 'code-retry');
  assert.equal((await fs.readFile(path.join(gitDirectory, '.git', 'HEAD'), 'utf8')).trim(), 'ref: refs/heads/fixture');
  assert.equal((await fs.readFile(path.join(gitDirectory, '.git', 'refs', 'heads', 'fixture'), 'utf8')).trim(), snapshot.head);
  assert.ok((await fs.stat(path.join(gitDirectory, '.git', 'index'))).size > 0);
  assert.deepEqual(await fs.readdir(path.join(gitDirectory, '.git', 'no-hooks')), []);
});

test('reviewed fixture cancellation path delays cleanup but does not perform an extra send', async () => {
  const entry = baseline.cases.find((item: { id: number }) => item.id === 2);
  const file = path.join(entry.author_directory, 'inputs', 'code-retry', 'worker.mjs');
  const recipe = JSON.parse(corpus.files['evaluator/git-state.json']);
  // Only the reviewed, hash-bound input module is executed by this host test.
  assert.equal(await fs.readFile(file, 'utf8'),
    corpus.files['inputs/code-retry/worker.mjs'].toString().replace(recipe.unstaged.before, recipe.unstaged.after));
  const { sendWithRetry } = await import(pathToFileURL(file).href);
  const controller = new AbortController();
  const events: string[] = [];
  let resume!: () => void;
  const result = sendWithRetry('parcel', {
    signal: controller.signal,
    transport: { open: async () => {
      events.push('open');
      return {
        send: async () => {
          events.push('send');
          controller.abort();
          throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
        },
        close: async () => { events.push('close'); },
      };
    } },
    clock: {
      setTimeout: () => 7,
      clearTimeout: (timer: number) => events.push(`clear:${timer}`),
      sleep: (ms: number) => {
        events.push(`sleep:${ms}`);
        return new Promise<void>(resolve => { resume = resolve; });
      },
    },
  });
  const rejected = assert.rejects(result, { name: 'AbortError' });
  await new Promise(setImmediate);
  assert.deepEqual(events, ['open', 'send', 'sleep:80']);
  resume();
  await rejected;
  assert.deepEqual(events, ['open', 'send', 'sleep:80', 'clear:7', 'close']);
});

test('reviewed fixture deadline races leave the losing send active across a retry', async () => {
  const entry = baseline.cases.find((item: { id: number }) => item.id === 2);
  const { sendWithRetry } = await import(pathToFileURL(path.join(entry.author_directory, 'inputs', 'code-retry', 'worker.mjs')).href);
  let deadline!: () => void;
  let resume!: () => void;
  let sends = 0;
  let unsettled = 0;
  let overlap = false;
  let closed = false;
  const cleared: number[] = [];
  const result = sendWithRetry('parcel', {
    transport: { open: async () => ({
      send: () => {
        sends++;
        overlap ||= unsettled > 0;
        if (sends === 1) {
          unsettled++;
          return new Promise(() => {});
        }
        return Promise.resolve('sent');
      },
      close: async () => { closed = true; },
    }) },
    clock: {
      setTimeout: (callback: () => void) => { deadline = callback; return sends; },
      clearTimeout: (timer: number) => cleared.push(timer),
      sleep: () => new Promise<void>(resolve => { resume = resolve; }),
    },
  });
  await new Promise(setImmediate);
  deadline();
  await new Promise(setImmediate);
  assert.equal(closed, false);
  resume();
  assert.equal(await result, 'sent');
  assert.equal(overlap, true);
  assert.equal(unsettled, 1);
  assert.equal(closed, true);
  assert.deepEqual(cleared, [1, 2]);
});

test('reviewed fixture opens before a pre-abort check and cannot force an ignoring transport to cancel', async () => {
  const entry = baseline.cases.find((item: { id: number }) => item.id === 2);
  const { sendWithRetry } = await import(pathToFileURL(path.join(entry.author_directory, 'inputs', 'code-retry', 'worker.mjs')).href);
  const preAborted = new AbortController();
  preAborted.abort();
  const events: string[] = [];
  const clock = {
    setTimeout: () => 1, clearTimeout: () => events.push('clear'),
    sleep: async () => { throw new Error('Unexpected sleep'); },
  };
  await assert.rejects(sendWithRetry('parcel', {
    signal: preAborted.signal, clock,
    transport: { open: async () => {
      events.push('open');
      return { send: async () => events.push('send'), close: async () => { events.push('close'); } };
    } },
  }), { name: 'AbortError' });
  assert.deepEqual(events, ['open', 'close']);
  const ignored = new AbortController();
  assert.equal(await sendWithRetry('parcel', {
    signal: ignored.signal, clock,
    transport: { open: async () => ({
      send: async () => { ignored.abort(); return 'sent despite abort'; },
      close: async () => { events.push('close'); },
    }) },
  }), 'sent despite abort');
  assert.equal(ignored.signal.aborted, true);
  assert.deepEqual(events, ['open', 'close', 'clear', 'close']);
});

test('provided numerical evidence supports correction, net accumulation and editorial denominators', () => {
  const methods = corpus.files['inputs/public-topic/03-field-methods.md'].toString();
  const rows = [...methods.matchAll(/\| ([PC]\d) \| (?:yes|no) \| ([\d.]+) \|/g)];
  const panels = rows.filter(row => row[1]!.startsWith('P')).map(row => Number(row[2]));
  const comparison = rows.filter(row => row[1]!.startsWith('C')).map(row => Number(row[2]));
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  assert.ok(Math.abs(mean(panels) - 29.8) < 1e-10);
  const correction = corpus.files['inputs/public-topic/04-correction.md'].toString();
  const corrected = /P4 mean should be ([\d.]+) °C/.exec(correction);
  panels[3] = Number(corrected![1]);
  assert.ok(Math.abs(mean(comparison) - mean(panels) - 1.5) < 1e-10);
  const tank = corpus.files['inputs/tank/observations.md'].toString();
  assert.match(tank, /\| 5 \| 100 \|/);
  assert.match(tank, /200, 201 and 199 mL/);
  assert.equal((200 / 10 - 100 / 10) / 100, 0.1);
  const library = corpus.files['inputs/library/records.md'].toString();
  const collected = [...library.matchAll(/(\d+) of (\d+)/g)].map(row => Number(row[1]) / Number(row[2]));
  assert.ok(Math.abs((collected[1]! - collected[0]!) * 100 - 18) < 1e-10);
});

test('human template is pending, never an invented zero/pass, and scored responses need actual consented answers', () => {
  const pending = corpus.humanTemplate;
  assert.equal(pending.status, 'pending');
  assert.equal(pending.comprehension_score, null);
  assert.equal(pending.consent, null);
  runner.validateHumanResponse(pending);
  assert.throws(() => runner.validateHumanResponse({ ...pending, comprehension_score: 0 }), /Pending/);
  assert.throws(() => runner.validateHumanResponse({ ...pending, status: 'passed' }), /status/);
  const collected = {
    ...pending, status: 'collected', consent: true, anonymous_participant_id: 'p17',
    case_id: 3, blind_artifact_label: 'X', design: 'balanced-order', phase: 'post',
    presentation_order: ['X', 'Y'],
    responses: [
      { question_id: 't1', answer: 'A learner response.', score: null, rationale: null },
      { question_id: 't2', answer: 'Another learner response.', score: null, rationale: null },
    ],
  };
  runner.validateHumanResponse(collected);
  assert.throws(() => runner.validateHumanResponse({ ...collected, consent: false }), /consent/);
  assert.throws(() => runner.validateHumanResponse({ ...collected, status: 'scored' }), /Scored/);
  assert.throws(() => runner.validateHumanResponse({ ...collected, comprehension_score: 0 }), /null/);
});

test('rubric v2 separates process uncertainty from semantic scoring and does not prescribe a tank derivation', () => {
  assert.equal(baseline.rubricVersion, 2);
  const checks = corpus.processChecks.checks;
  assert.deepEqual(checks.map((check: { id: string }) => check.id), [
    'no-network', 'no-input-execution', 'no-publication', 'unchanged-inputs', 'no-installs', 'no-authored-code-execution',
  ]);
  const observation = {
    schema_version: 1, rubricVersion: 2,
    checks: [{ ...checks[0], status: 'insufficient-evidence', result: null,
      reason: 'Host trace coverage unavailable.', evidence: [] }],
  };
  runner.validateProcessObservations(observation);
  for (const result of [true, false]) {
    assert.throws(() => runner.validateProcessObservations({
      ...observation, checks: [{ ...observation.checks[0], result }],
    }), /null/);
  }
  for (const [status, result] of [['verified', true], ['failed', false]] as const) {
    const row = { ...observation.checks[0], status, result };
    assert.throws(() => runner.validateProcessObservations({ ...observation, checks: [row] }), /evidence locators/);
    runner.validateProcessObservations({ ...observation, checks: [{ ...row, evidence: ['host-trace.json#event-12'] }] });
  }
  const tank = JSON.parse(corpus.files['evaluator/tank.json']);
  const balance = tank.rubric.correctness_source_support.find((row: { id: string }) => row.id === 'balance').text;
  assert.match(balance, /inflow minus outflow/);
  assert.match(balance, /arithmetic are correct if used/);
  assert.match(balance, /no particular numerical derivation/);
  assert.ok(!balance.includes('0.1'));
  for (const item of corpus.manifest.evals) {
    const grading = JSON.parse(corpus.files[item.evaluator]);
    const assertions = [...grading.rubric.correctness_source_support, ...grading.rubric.structure_operation]
      .map(row => row.text).join('\n');
    assert.doesNotMatch(assertions, /No network, installs|keeps repository unchanged|never runs input|no network execution\/publication/);
  }
});

test('selection, no-overwrite, unsafe paths and missing/invalid arguments fail without changing existing output', async () => {
  const only = await runner.prepareSkillEval({ output: path.join(workspace, 'selected'), skillRoot: bundles, cases: ['tank'] });
  assert.deepEqual(only.cases.map((item: { id: number }) => item.id), [3]);
  assert.deepEqual(Object.keys(only.skills), ['aha-explain']);
  assert.equal(only.environment.git, null);
  const marker = path.join(workspace, 'a', 'evaluator', 'run.json');
  const original = await fs.readFile(marker);
  await assert.rejects(runner.prepareSkillEval({ output: path.join(workspace, 'a'), skillRoot: bundles }), /overwrite/);
  assert.deepEqual(await fs.readFile(marker), original);
  for (const relative of ['../escape', '/absolute', 'C:/escape', 'a\\b', 'a//b', 'NUL.md', 'x.']) {
    assert.throws(() => runner.safeRelative(relative), /Unsafe/);
  }
  await assert.rejects(runner.prepareSkillEval({ output: path.join(workspace, 'bad1'), skillRoot: 'relative' }), /absolute/);
  await assert.rejects(runner.prepareSkillEval({ output: path.join(workspace, 'bad2'), skillRoot: bundles, cases: ['999'] }), /Unknown case/);
  await assert.rejects(runner.prepareSkillEval({ output: path.join(bundles, 'inside'), skillRoot: bundles }), /separate/);
  await assert.rejects(runner.prepareSkillEval({ output: path.join(workspace, 'bad3'), skillRoot: path.join(workspace, 'missing') }), /ENOENT/);
  const link = path.join(workspace, 'bundle-link');
  await fs.symlink(bundles, link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(runner.prepareSkillEval({ output: path.join(workspace, 'bad4'), skillRoot: link }), /Symlink/);
  const script = path.join(root, 'evals', 'skills', 'prepare.mjs');
  for (const args of [[], ['x', '--unknown', 'bad'], ['x', '--skill-root'], ['x', '--skill-root', bundles, '--skill-root', bundles]]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 30000 });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /failed/i);
  }
  const cli = spawnSync(process.execPath, [script, path.join(workspace, 'cli'), '--skill-root', bundles, '--case', '4', '--label', 'blind-X'], {
    encoding: 'utf8', timeout: 30000,
  });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(JSON.parse(cli.stdout).cases, 1);
});

test('CLI rejects changed, missing and unbound fixture materials before reserving an author packet', async () => {
  const isolated = path.join(workspace, 'isolated-preparer');
  const script = path.join(isolated, 'evals', 'skills', 'prepare.mjs');
  const fixture = path.join(isolated, 'evals', 'skills');
  await fs.cp(runner.fixtureRoot, fixture, { recursive: true });
  // Host-run scenarios are not parsed, staged, or hash-bound by the fixed-case preparer.
  await fs.writeFile(path.join(fixture, 'scenarios.json'), 'Independent host-run scenarios, not fixed-case JSON.');
  const isolatedRunner = await import(pathToFileURL(script).href);
  const isolatedCorpus = await isolatedRunner.loadFixtures();
  assert.equal(isolatedCorpus.lockSha256, corpus.lockSha256);
  assert.deepEqual(Object.keys(isolatedCorpus.files), Object.keys(corpus.files));
  for (const name of ['prepare.mjs', 'scenarios.json']) assert.ok(!(name in isolatedCorpus.files));
  const target = path.join(fixture, 'inputs', 'tank', 'observations.md');
  const original = await fs.readFile(target);
  const output = path.join(workspace, 'must-not-exist');
  const invoke = () => spawnSync(process.execPath, [script, output, '--skill-root', bundles, '--case', '3'], {
    encoding: 'utf8', timeout: 30000,
  });
  await fs.appendFile(target, '\nUnreviewed alteration.\n');
  let result = invoke();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Fixture hash mismatch/);
  await fs.writeFile(target, original);
  await fs.writeFile(path.join(fixture, 'inputs', 'extra.md'), 'Unbound input');
  result = invoke();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unbound fixture file/);
  await fs.unlink(path.join(fixture, 'inputs', 'extra.md'));
  await fs.unlink(target);
  result = invoke();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ENOENT/);
  await assert.rejects(fs.stat(output), /ENOENT/);
});
