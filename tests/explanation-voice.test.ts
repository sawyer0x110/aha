import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const { prepareVoiceEval } = await import(pathToFileURL(path.join(root, 'evals', 'explanation-voice', 'prepare.mjs')).href);
const readJson = async (file: string) => JSON.parse(await fs.readFile(file, 'utf8'));

async function fixture(t: { after: (callback: () => Promise<void>) => void }) {
  await fs.mkdir(path.join(root, 'dist'), { recursive: true });
  const directory = await fs.mkdtemp(path.join(root, 'dist', '.voice-eval-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const baseline = path.join(directory, 'baseline');
  const candidate = path.join(directory, 'candidate');
  for (const skill of [baseline, candidate]) {
    for (const file of ['SKILL.md', 'references/explanation-writing.md', 'references/language.md',
      'references/video.md', 'scripts/aha.mjs']) {
      await fs.mkdir(path.dirname(path.join(skill, file)), { recursive: true });
      await fs.writeFile(path.join(skill, file), `${file}\n`);
    }
  }
  await fs.writeFile(path.join(candidate, 'references', 'explanation-writing.md'), 'Candidate editorial guidance.\n');
  return { directory, baseline, candidate, output: path.join(directory, 'runs') };
}

test('voice packets freeze paired guidance and prompts without leaking rubrics to authors', async t => {
  const options = await fixture(t);
  const manifest = await prepareVoiceEval(options);
  const corpus = await readJson(path.join(options.output, 'evaluator', 'evals.json'));
  assert.equal(manifest.repetitions, 1);
  assert.equal(manifest.humanComprehension, 'unperformed');
  assert.match(manifest.scope, /not full skill routing/);
  for (const item of corpus.evals) {
    const caseRoot = path.join(options.output, `eval-${item.id}-${item.name}`);
    const packets = [];
    for (const condition of ['with_skill', 'old_skill']) {
      const run = path.join(caseRoot, condition, 'run-1');
      const packet = await readJson(path.join(run, 'task.json'));
      const metadata = await readJson(path.join(run, 'eval_metadata.json'));
      packets.push(packet);
      assert.equal(packet.prompt, item.prompt);
      assert.equal(packet.outputs, path.join(run, 'outputs'));
      assert.deepEqual(await fs.readdir(packet.outputs), []);
      assert.equal(metadata.prompt, packet.prompt);
      for (const answer of [...item.assertions, ...item.qualitative_checks, item.expected_output]) {
        assert.ok(!JSON.stringify({ packet, metadata }).includes(answer), 'Author packet leaked evaluator guidance.');
      }
      for (const guide of packet.guides) await fs.access(path.join(packet.skill, guide));
    }
    assert.equal(packets[0].prompt, packets[1].prompt);
    assert.deepEqual(packets[0].guides, packets[1].guides);
    assert.deepEqual((await readJson(path.join(caseRoot, 'eval_metadata.json'))).assertions, item.assertions);
  }
  const frozen = path.join(manifest.skills.with_skill.path, 'references', 'explanation-writing.md');
  await fs.writeFile(path.join(options.candidate, 'references', 'explanation-writing.md'), 'Later edit.\n');
  assert.equal(await fs.readFile(frozen, 'utf8'), 'Candidate editorial guidance.\n');
  await assert.rejects(prepareVoiceEval(options), /EEXIST/);
  assert.equal(await fs.readFile(frozen, 'utf8'), 'Candidate editorial guidance.\n');
});

test('voice comparison refuses runtime changes, missing guides and nested destinations before staging', async t => {
  const options = await fixture(t);
  const runtime = path.join(options.candidate, 'scripts', 'aha.mjs');
  await fs.writeFile(runtime, 'Changed runtime.\n');
  await assert.rejects(prepareVoiceEval(options), /Non-editorial file differs: scripts\/aha.mjs/);
  await assert.rejects(fs.access(options.output), { code: 'ENOENT' });
  await fs.writeFile(runtime, 'scripts/aha.mjs\n');
  await fs.unlink(path.join(options.candidate, 'references', 'language.md'));
  await assert.rejects(prepareVoiceEval(options), /Skill file sets differ/);
  for (const source of [options.baseline, options.candidate]) {
    await assert.rejects(prepareVoiceEval({ ...options, output: path.join(source, 'nested') }), /inside an input skill/);
  }
});

test('voice cases separate factual checks from qualitative voice judgments across readers and media', async () => {
  const corpus = await readJson(path.join(root, 'evals', 'explanation-voice', 'evals.json'));
  assert.deepEqual(corpus.evals.map((item: { name: string }) => item.name),
    ['cold-cup-page', 'retry-narration', 'migration-handoff']);
  for (const item of corpus.evals) {
    assert.ok(item.prompt.length > 200 && item.expected_output.length > 60);
    assert.equal(item.assertions.length, 4);
    assert.equal(item.qualitative_checks.length, 3);
    assert.deepEqual(item.files, []);
  }
  const writing = await fs.readFile(path.join(root, 'skills', 'aha-explain', 'references', 'explanation-writing.md'), 'utf8');
  assert.match(writing, /expert readers may need the established term immediately/);
  assert.match(writing, /not a generic friendly persona/);
  assert.match(writing, /not new evidence or prescribed openings/);
  assert.match(writing, /not actual listening/);
  for (const file of ['video.md', 'artifact-qa.md']) {
    const reference = await fs.readFile(path.join(root, 'skills', 'aha-explain', 'references', file), 'utf8');
    assert.ok(reference.includes('(explanation-writing.md#sound-like-someone-explaining-this)'));
  }
});
