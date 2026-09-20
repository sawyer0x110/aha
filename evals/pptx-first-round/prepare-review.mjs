import * as fs from 'node:fs/promises';
import path from 'node:path';
import { randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { inspectPptxBytes } from './inspect.mjs';
import { safePath, sha256 } from './prepare.mjs';

export async function prepareReview(runRoot, destination, stage = 'first-pass') {
  if (!['first-pass', 'technical-repair'].includes(stage)) throw new Error('Unknown review stage.');
  const repaired = stage === 'technical-repair';
  const root = await safePath(runRoot);
  const output = await safePath(destination);
  if (output === root || output.startsWith(`${root}${path.sep}`)) {
    throw new Error('Review must be outside the generation directory.');
  }
  const mappingPath = path.join(root, 'evaluator', repaired ? 'review-mapping-repaired.json' : 'review-mapping.json');
  for (const reserved of [output, mappingPath]) {
    const exists = await fs.lstat(reserved).then(() => true, error => {
      if (error.code !== 'ENOENT') throw error;
      return false;
    });
    if (exists) throw new Error(`Output already exists: ${reserved}`);
  }
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'evaluator', 'run.json'), 'utf8'));
  const cases = [...new Set(manifest.cases.map(item => item.id))];
  const sources = [];
  for (const id of cases) {
    const conditions = randomInt(2) ? ['baseline', 'candidate'] : ['candidate', 'baseline'];
    for (const [index, condition] of conditions.entries()) {
      const author = manifest.cases.find(item => item.id === id && item.condition === condition);
      if (!author) throw new Error(`Missing paired author: ${id}/${condition}`);
      const directory = await safePath(path.join(author.author_directory, 'outputs'));
      const deck = await safePath(path.join(directory, repaired ? 'deck-repaired.pptx' : 'deck.pptx'));
      const rendered = await safePath(path.join(directory, repaired ? 'rendered-repaired' : 'rendered'));
      const observation = JSON.parse((await fs.readFile(path.join(rendered, 'powerpoint-observations.json'), 'utf8')).replace(/^\uFEFF/, ''));
      const bytes = await fs.readFile(deck);
      if (sha256(bytes) !== observation.outputHash) throw new Error(`Stale rendering: ${id}/${condition}`);
      sources.push({ id, condition, label: ['A', 'B'][index], deck, rendered, observation, bytes });
    }
  }
  await fs.mkdir(output);
  const mapping = [];
  for (const source of sources) {
    const caseRoot = path.join(output, source.id);
    const run = path.join(caseRoot, source.label);
    const artifacts = path.join(run, 'outputs');
    await fs.mkdir(artifacts, { recursive: true });
    await fs.writeFile(path.join(artifacts, 'deck.pptx'), source.bytes, { flag: 'wx' });
    for (const slide of source.observation.slides) {
      const file = await safePath(path.join(source.rendered, slide.image));
      await fs.copyFile(file, path.join(artifacts, path.basename(slide.image)));
    }
    const inspection = await inspectPptxBytes(source.bytes);
    await fs.writeFile(path.join(artifacts, 'ooxml.json'), JSON.stringify(inspection, null, 2) + '\n', { flag: 'wx' });
    const { application, version, method, outputHash, originalUnchanged, edits, unperformed } = source.observation;
    await fs.writeFile(path.join(run, 'application-observations.json'), JSON.stringify({
      application, version, method, outputHash, originalUnchanged, edits, unperformed,
    }, null, 2) + '\n', { flag: 'wx' });
    for (const entry of await fs.readdir(source.rendered)) {
      if (/^contact-\d+\.png$/.test(entry)) await fs.copyFile(path.join(source.rendered, entry), path.join(artifacts, entry));
    }
    const metadataSource = path.join(root, 'evaluator', source.id, 'eval_metadata.json');
    if (source.label === 'A') {
      const metadata = JSON.parse(await fs.readFile(metadataSource, 'utf8'));
      await fs.writeFile(path.join(caseRoot, 'eval_metadata.json'), JSON.stringify({
        eval_id: cases.indexOf(source.id) + 1,
        eval_name: source.id,
        prompt: metadata.prompt,
        assertions: metadata.assertions,
        observation_policy: metadata.observation_policy,
        stage,
      }, null, 2) + '\n', { flag: 'wx' });
      const packet = manifest.cases.find(item => item.id === source.id);
      await fs.cp(path.join(packet.author_directory, 'inputs', 'research'), path.join(caseRoot, 'research'), { recursive: true, errorOnExist: true, force: false });
    }
    mapping.push({ case: source.id, label: source.label, condition: source.condition, stage, outputHash: sha256(source.bytes) });
  }
  // The mapping stays with the host, outside the neutral review directory.
  await fs.writeFile(mappingPath, JSON.stringify(mapping, null, 2) + '\n', { flag: 'wx' });
  return { status: 'prepared-for-independent-review', review: output, runs: mapping.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4 && !(process.argv.length === 5 && process.argv[4] === '--technical-repair')) {
      throw new Error('Usage: prepare-review.mjs <run-root> <new-review-directory> [--technical-repair]');
    }
    console.log(JSON.stringify(await prepareReview(process.argv[2], process.argv[3],
      process.argv[4] ? 'technical-repair' : 'first-pass')));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
