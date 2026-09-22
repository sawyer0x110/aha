import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const [destination, baseline, candidate] = process.argv.slice(2);
if (process.argv.length !== 5 || ![destination, baseline, candidate].every(value => value && path.isAbsolute(value))) {
  throw new Error('Usage: node evals\\task-video\\prepare.mjs <new absolute run root> <absolute baseline skill> <absolute candidate skill>');
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function inventory(directory, prefix = '') {
  const files = {};
  for (const entry of (await fs.readdir(path.join(directory, prefix), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = path.join(prefix, entry.name);
    assert.ok(!entry.isSymbolicLink(), `Symlink not supported: ${relative}`);
    if (entry.isDirectory()) Object.assign(files, await inventory(directory, relative));
    else {
      assert.ok(entry.isFile(), `Not a regular file: ${relative}`);
      files[relative.split(path.sep).join('/')] = sha(await fs.readFile(path.join(directory, relative)));
    }
  }
  return files;
}
for (const skill of [baseline, candidate]) {
  await fs.access(path.join(skill, 'SKILL.md'));
  await fs.access(path.join(skill, 'scripts', 'aha.mjs'));
}
const skills = { old_skill: await inventory(baseline), with_skill: await inventory(candidate) };
for (const [file, hash] of Object.entries(skills.old_skill)) {
  if (file.startsWith('scripts/') || file.startsWith('assets/') || file.startsWith('schemas/') || file.startsWith('node_modules/')) {
    assert.equal(skills.with_skill[file], hash, `Runtime differs: ${file}`);
  }
}
assert.deepEqual(
  Object.keys(skills.with_skill).filter(file => /^(scripts|assets|schemas|node_modules)\//.test(file)).sort(),
  Object.keys(skills.old_skill).filter(file => /^(scripts|assets|schemas|node_modules)\//.test(file)).sort(),
);
const source = await fs.readFile(new URL('./evals.json', import.meta.url), 'utf8');
const corpus = JSON.parse(source);
await fs.mkdir(destination);
await fs.mkdir(path.join(destination, 'evaluator'));
await fs.writeFile(path.join(destination, 'evaluator', 'evals.json'), source, { flag: 'wx' });
const cases = [];
for (const item of corpus.evals) {
  const caseRoot = path.join(destination, `eval-${item.id}-${item.name}`);
  await fs.mkdir(caseRoot);
  await fs.writeFile(path.join(caseRoot, 'eval_metadata.json'), JSON.stringify({
    eval_id: item.id, eval_name: item.name, prompt: item.prompt, assertions: item.assertions,
  }, null, 2));
  const inputs = {};
  for (const [condition, skill] of [['old_skill', baseline], ['with_skill', candidate]]) {
    const run = path.join(caseRoot, condition);
    await fs.mkdir(path.join(run, 'inputs'), { recursive: true });
    await fs.mkdir(path.join(run, 'outputs'));
    await fs.cp(path.join(repo, ...item.files[0].split('/')), path.join(run, 'inputs', 'research'), { recursive: true });
    if (item.name === 'docker-mechanism-video') {
      const plan = JSON.parse(await fs.readFile(path.join(repo, ...item.files[1].split('/')), 'utf8'));
      await fs.writeFile(path.join(run, 'inputs', 'narration.json'), JSON.stringify({
        language: 'en', duration: plan.duration, segments: plan.segments,
      }, null, 2));
    }
    const task = {
      prompt: item.prompt,
      skill,
      inputs: path.join(run, 'inputs'),
      outputs: path.join(run, 'outputs'),
      permissions: 'Read only your assigned skill and inputs. Write only outputs. You may use the trusted installed Aha CLI to validate research, initialize/check a project and package HTML without executing authored code. Do not browse, execute authored code, run input code, install, network, synthesize/import audio, or edit input/skill/example files. No other conditions, evaluator files, repository tests or existing example outputs. This is procedural isolation, not an OS sandbox.',
      delivery: 'Use outputs/project for the authored project. HTML case: package outputs/explanation.html using render-html. Video case: create source only, preserve narration.json segments verbatim, do not bind an audio plan. Record commands actually run and unperformed review in outputs/author-notes.txt. Stop after static checks; do not await coordinator approval inside the author run.',
    };
    await fs.writeFile(path.join(run, 'task.json'), JSON.stringify(task, null, 2));
    inputs[condition] = await inventory(path.join(run, 'inputs'));
  }
  assert.deepEqual(inputs.old_skill, inputs.with_skill, 'Paired inputs differ');
  cases.push({ id: item.id, name: item.name, inputs: inputs.old_skill, promptHash: sha(item.prompt) });
}
await fs.writeFile(path.join(destination, 'evaluator', 'manifest.json'), JSON.stringify({
  protocol: corpus.protocol, preparedAt: new Date().toISOString(), corpusHash: sha(source),
  skills: { old_skill: { path: baseline, files: skills.old_skill }, with_skill: { path: candidate, files: skills.with_skill } },
  cases, generation: 'pending', repetitions: 1, model: null, tokens: null, humanComprehension: 'unperformed',
  limitations: 'Two bounded authoring pilots; fixed Docker narration tests visuals, not narration writing. Same host defaults; exact backend model, full trace and seed are unavailable unless independently recorded. Source/layout checks are not listening or comprehension.',
}, null, 2));
console.log(destination);
