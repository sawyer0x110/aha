import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSafePath, inventory, sha256 } from '../../scripts/install-skills.mjs';

const json = value => `${JSON.stringify(value, null, 2)}\n`;
const editable = new Set([
  'SKILL.md', 'references/explanation-writing.md', 'references/video.md',
  'references/artifact-qa.md', 'runtime-manifest.json',
]);
const guides = ['SKILL.md', 'references/explanation-writing.md', 'references/language.md', 'references/video.md'];

export async function prepareVoiceEval({ output, baseline, candidate }) {
  for (const value of [output, baseline, candidate]) {
    assert.ok(typeof value === 'string' && path.isAbsolute(value), 'Paths must be absolute.');
    await assertSafePath(value);
  }
  for (const source of [baseline, candidate]) {
    const relative = path.relative(source, output);
    assert.ok(relative !== '' && (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)),
      'Output must not be inside an input skill.');
  }
  const corpusBytes = await fs.readFile(new URL('./evals.json', import.meta.url));
  const corpus = JSON.parse(corpusBytes);
  const bundles = { with_skill: await inventory(candidate), old_skill: await inventory(baseline) };
  assert.deepEqual(Object.keys(bundles.with_skill).sort(), Object.keys(bundles.old_skill).sort(),
    'Skill file sets differ.');
  for (const file of ['scripts/aha.mjs', ...guides]) {
    assert.ok(bundles.with_skill[file]?.length && bundles.old_skill[file]?.length, `Missing skill file: ${file}`);
  }
  for (const [file, bytes] of Object.entries(bundles.old_skill)) {
    if (!editable.has(file)) assert.equal(sha256(bundles.with_skill[file]), sha256(bytes), `Non-editorial file differs: ${file}`);
  }
  await fs.mkdir(output);
  const write = async (file, bytes) => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes, { flag: 'wx' });
  };
  await write(path.join(output, 'evaluator', 'evals.json'), corpusBytes);
  const skills = {};
  for (const [condition, files] of Object.entries(bundles)) {
    const directory = path.join(output, 'skills', condition);
    const hashes = {};
    for (const [file, bytes] of Object.entries(files)) {
      await write(path.join(directory, ...file.split('/')), bytes);
      hashes[file] = sha256(bytes);
    }
    skills[condition] = { path: directory, files: hashes };
  }
  for (const item of corpus.evals) {
    const caseRoot = path.join(output, `eval-${item.id}-${item.name}`);
    await write(path.join(caseRoot, 'eval_metadata.json'), json({
      eval_id: item.id, eval_name: item.name, prompt: item.prompt,
      assertions: item.assertions, qualitative_checks: item.qualitative_checks,
    }));
    for (const condition of Object.keys(bundles)) {
      const run = path.join(caseRoot, condition, 'run-1');
      const outputs = path.join(run, 'outputs');
      await fs.mkdir(outputs, { recursive: true });
      await write(path.join(run, 'eval_metadata.json'), json({
        eval_id: item.id, eval_name: item.name, prompt: item.prompt,
      }));
      await write(path.join(run, 'task.json'), json({
        prompt: item.prompt, skill: skills[condition].path, guides, outputs,
        scope: 'Editorial component only: write copy, not a full artifact or research dossier. Read the assigned guides, apply relevant editorial advice and preserve the task scope. Do not follow media initialization, execution or approval steps for this copy-only task.',
        permissions: 'Read only this task and assigned guides. Write only outputs/copy.md. Do not read other conditions, evaluator files, repository examples, tests or rubrics. No network, installs, code execution, audio processing or additional skills. Directory separation is procedural, not an OS sandbox.',
      }));
    }
  }
  const manifest = {
    protocol: corpus.protocol, scope: corpus.scope, createdAt: new Date().toISOString(),
    corpusHash: sha256(corpusBytes), skills,
    cases: corpus.evals.map(item => ({ id: item.id, name: item.name, promptHash: sha256(item.prompt) })),
    repetitions: 1, generation: 'pending', model: null, tokens: null,
    humanReview: 'unperformed', humanComprehension: 'unperformed',
  };
  await write(path.join(output, 'evaluator', 'manifest.json'), json(manifest));
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [output, baseline, candidate] = process.argv.slice(2);
  assert.equal(process.argv.length, 5,
    'Usage: node evals\\explanation-voice\\prepare.mjs <new absolute run root> <absolute baseline skill> <absolute candidate skill>');
  await prepareVoiceEval({ output, baseline, candidate });
  console.log(output);
}
