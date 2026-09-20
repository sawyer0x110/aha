import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { inspectPptxBytes } from '../pptx-first-round/inspect.mjs';
import { inventory, readRegular, safePath, safeRelative, sha256 } from '../pptx-first-round/prepare.mjs';
import { verifyRepairRun } from './prepare.mjs';

const json = value => `${JSON.stringify(value, null, 2)}\n`;
const parse = bytes => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
const fingerprint = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const at = (root, name) => path.join(root, ...safeRelative(name).split('/'));
const beforeStage = 'before-second-round-repair-only-common-seed';
const afterStage = 'after-second-round-repair-only-single-submission';
const within = (parent, child) => {
  const relative = path.relative(parent, child);
  return !relative || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
};
async function refuseExisting(file) {
  if (await fs.lstat(file).then(() => true, error => {
    if (error.code !== 'ENOENT') throw error;
    return false;
  })) throw new Error(`Output already exists: ${file}`);
}
async function writeNew(file, bytes) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes, { flag: 'wx' });
}

// Runtime receipt framing from src/artifacts/files.ts; all path/link validation stays in shared helpers.
export async function receiptSourceHash(project) {
  const files = await inventory(project);
  const hash = createHash('sha256');
  for (const name of Object.keys(files).filter(name => !['research', 'dist', 'qa'].includes(name.split('/')[0])).sort()) {
    const bytes = await readRegular(at(project, name));
    if (sha256(bytes) !== files[name].sha256) throw new Error(`Source changed while hashing: ${name}`);
    hash.update(`${Buffer.byteLength(name)}:${name}:${bytes.length}:`).update(bytes);
  }
  return hash.digest('hex');
}

async function readPresentation(deckPath, rendered, receiptPath) {
  const bytes = await readRegular(deckPath);
  const inspection = await inspectPptxBytes(bytes);
  const observedPath = path.join(rendered, 'powerpoint-observations.json');
  const observationBytes = await readRegular(observedPath);
  const observation = parse(observationBytes);
  if (observation.application !== 'Microsoft PowerPoint' || observation.outputHash !== sha256(bytes) ||
      observation.originalUnchanged !== true) throw new Error(`Stale rendering or invalid PowerPoint observation: ${deckPath}`);
  if (!Array.isArray(observation.slides) || observation.slides.length !== inspection.slides.length ||
      observation.slides.length < 5 || observation.slides.length > 8) throw new Error('Observation/OOXML slide count mismatch or budget exceeded');
  const files = await inventory(rendered);
  const slideNames = observation.slides.map((slide, index) => {
    const name = `slide-${String(index + 1).padStart(2, '0')}.png`;
    if (slide.slide !== index + 1 || slide.image !== name || !files[name]?.bytes) {
      throw new Error(`Missing/nonsequential slide image: ${name}`);
    }
    return name;
  });
  const actualNames = Object.keys(files).filter(name => /^slide-.*\.png$/i.test(name)).sort();
  if (JSON.stringify(actualNames) !== JSON.stringify([...slideNames].sort())) throw new Error('Extra or stale slide images');
  const selected = Object.keys(files).filter(name => /\.png$/i.test(name) || name === 'editing-probe.pptx');
  const minTime = receiptPath ? Math.max((await fs.stat(deckPath)).mtimeMs, (await fs.stat(receiptPath)).mtimeMs) : null;
  const observationTime = (await fs.stat(observedPath)).mtimeMs;
  const artifacts = {};
  for (const name of selected) {
    const file = at(rendered, name);
    const content = await readRegular(file);
    if (sha256(content) !== files[name].sha256) throw new Error(`Rendered file changed during review: ${name}`);
    if (/\.png$/i.test(name) && !content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      throw new Error(`Invalid PNG: ${name}`);
    }
    if (receiptPath) {
      const modified = (await fs.stat(file)).mtimeMs;
      if (modified < minTime || modified > observationTime) throw new Error(`Stale image/probe timestamp: ${name}; rerender into a new directory`);
    }
    artifacts[name] = content;
  }
  const { application, version, method, outputHash, originalUnchanged, slides, edits, unperformed } = observation;
  return {
    bytes, inspection, artifacts, observationBytes,
    observation: { application, version, method, outputHash, originalUnchanged, slides, edits, unperformed },
    evidence: {
      deck: fingerprint(bytes), application_observations: fingerprint(observationBytes),
      rendered_files: Object.fromEntries(Object.entries(artifacts).map(([name, content]) => [name, fingerprint(content)])),
      freshness: receiptPath ? 'Deck/receipt/source hashes plus export timestamps between delivery and application observation; not a signed image-to-deck binding.'
        : 'Previously frozen common seed files; not newly rendered or newly scored.',
    },
  };
}

/** Read-only preparation: no source execution, rendering, PowerPoint or grader invocation. */
export async function prepareRepairReview({ runRoot, destination, manifestSha256 }) {
  const root = await safePath(runRoot);
  const output = await safePath(destination);
  if (within(root, output) || within(output, root)) throw new Error('Review must be outside and disjoint from the run directory');
  const mappingPath = path.join(root, 'evaluator', 'review-mapping.json');
  await refuseExisting(output);
  await refuseExisting(mappingPath);
  const verified = await verifyRepairRun(root, manifestSha256);
  const run = parse(await readRegular(path.join(root, 'evaluator', 'run.json')));
  const protocol = parse(await readRegular(path.join(root, 'evaluator', 'source', 'protocol.json')));
  const sources = [];
  const recheck = [];
  for (const id of protocol.case_ids) {
    const seed = path.join(root, 'seeds', id);
    const before = await readPresentation(path.join(seed, 'deck.pptx'), path.join(seed, 'rendered'));
    const research = {};
    for (const name of Object.keys(await inventory(path.join(seed, 'project', 'research')))) {
      research[name] = await readRegular(at(path.join(seed, 'project', 'research'), name));
    }
    const rubric = await readRegular(path.join(root, 'evaluator', id, 'rubric.json'));
    const conditions = randomInt(2) ? ['baseline', 'candidate'] : ['candidate', 'baseline'];
    const finals = [];
    for (const [index, condition] of conditions.entries()) {
      const directory = path.join(root, id, condition, 'outputs');
      const directoryFiles = await inventory(directory);
      const project = path.join(directory, 'project');
      const projectFiles = await inventory(project);
      const seedFiles = run.seeds[id].original_project_files;
      if (JSON.stringify(Object.keys(projectFiles).sort()) !== JSON.stringify(Object.keys(seedFiles).sort()) ||
          Object.entries(projectFiles).some(([name, value]) => !['pptx/main.mjs', 'artifact.json'].includes(name) &&
            value.sha256 !== seedFiles[name].sha256)) throw new Error(`Non-permitted project edits: ${id}/${condition}`);
      const sourceHash = await receiptSourceHash(project);
      const receiptPath = path.join(directory, 'deck.pptx.receipt.json');
      const receiptBytes = await readRegular(receiptPath);
      const receipt = parse(receiptBytes);
      const artifact = parse(await readRegular(path.join(project, 'artifact.json')));
      const final = await readPresentation(path.join(directory, 'deck.pptx'), path.join(directory, 'rendered'), receiptPath);
      if (receipt.sourceHash !== sourceHash || receipt.outputHash !== sha256(final.bytes) ||
          receipt.researchHash !== artifact.researchHash || artifact.researchHash !==
            parse(await readRegular(path.join(seed, 'project', 'artifact.json'))).researchHash ||
          receipt.status !== 'delivered' || receipt.format !== 'pptx' || receipt.output !== 'deck.pptx' ||
          receipt.codeExecuted !== true || receipt.slides !== final.inspection.slides.length) {
        throw new Error(`Stale source/output receipt: ${id}/${condition}`);
      }
      const receiptTime = (await fs.stat(receiptPath)).mtimeMs;
      for (const name of ['pptx/main.mjs', 'artifact.json']) {
        if ((await fs.stat(at(project, name))).mtimeMs > receiptTime) throw new Error(`Source edited after delivery: ${id}/${condition}`);
      }
      recheck.push({ directory, files: directoryFiles });
      finals.push({ ...final, label: ['A', 'B'][index], condition, receiptBytes, sourceHash });
    }
    sources.push({ id, before, research, rubric, finals });
  }
  for (const entry of recheck) {
    if (JSON.stringify(await inventory(entry.directory)) !== JSON.stringify(entry.files)) {
      throw new Error('Final outputs changed during review preparation');
    }
  }
  await verifyRepairRun(root, verified.manifest_sha256);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.mkdir(output);
  const mapping = [];
  async function stagePresentation(directory, presentation, stage, receipt) {
    const artifacts = stage === beforeStage ? directory : path.join(directory, 'outputs');
    await writeNew(path.join(artifacts, 'deck.pptx'), presentation.bytes);
    await writeNew(path.join(artifacts, 'ooxml.json'), json(presentation.inspection));
    for (const [name, bytes] of Object.entries(presentation.artifacts)) await writeNew(at(artifacts, name), bytes);
    await writeNew(path.join(directory, 'application-observations.json'), json({ stage, ...presentation.observation }));
    await writeNew(path.join(directory, 'stage.json'), json({ stage, design: 'repair-only-not-first-pass', evidence: presentation.evidence }));
    if (receipt) {
      const value = parse(receipt);
      await writeNew(path.join(directory, 'delivery-identity.json'), json({
        stage, sourceHash: value.sourceHash, outputHash: value.outputHash, researchHash: value.researchHash,
        receipt_sha256: sha256(receipt), slides: value.slides,
        limitation: 'Receipt identity is not source approval, visual QA or semantic validation.',
      }));
    }
  }
  for (const source of sources) {
    const caseRoot = path.join(output, source.id);
    await stagePresentation(path.join(caseRoot, 'before'), source.before, beforeStage);
    for (const [name, bytes] of Object.entries(source.research)) {
      await writeNew(at(path.join(caseRoot, 'before', 'research'), name), bytes);
    }
    const neutralRubric = parse(source.rubric);
    neutralRubric.seed_native_object_locators = neutralRubric.seed_native_object_locators.map(locator => ({
      ...locator, artifact: 'before/application-observations.json', image: `before/${path.basename(locator.image)}`,
    }));
    await writeNew(path.join(caseRoot, 'rubric.json'), json(neutralRubric));
    await writeNew(path.join(caseRoot, 'eval_metadata.json'), json({
      eval_id: protocol.case_ids.indexOf(source.id) + 1, eval_name: source.id, prompt: protocol.prompt,
      assertions: parse(source.rubric).criteria.map(row => row.criterion), stage: afterStage,
      before_stage: beforeStage, scored_runs: ['A', 'B'], before_is_scored_run: false,
      observation_policy: 'Compare each A/B final with before/. Common seed successes are not new first-pass results. Use exact before/after locators; missing evidence is unverified, not passed.',
    }));
    for (const final of source.finals) {
      await stagePresentation(path.join(caseRoot, final.label), final, afterStage, final.receiptBytes);
      mapping.push({
        case: source.id, label: final.label, condition: final.condition, stage: afterStage,
        before_stage: beforeStage, before_outputHash: sha256(source.before.bytes),
        outputHash: sha256(final.bytes), sourceHash: final.sourceHash,
        receipt: fingerprint(final.receiptBytes), evidence: final.evidence,
      });
    }
  }
  await writeNew(path.join(output, 'REVIEW.md'), `# Independent repair-only review

Only case/A and case/B are scored runs. case/before is the shared BEFORE seed, outside A/B, not a third submission.
BEFORE stage: ${beforeStage}.
AFTER stage: ${afterStage}.
Compare each final to its common before/ deck, PNGs and OOXML; use before/research as the source Dossier.
Application observations live beside outputs, separately from static OOXML inspection. Export/edit-probe images are distinct.
Grade using each case's rubric with exact slide/object/cell/notes/source locators and separate observations from judgments.
Missing evidence is unverified. Record improved/unchanged/regressed/mixed separately; no aesthetic composite.
Prior seed success is not a new first-pass result. Delivery identity and freshness checks are not semantic or visual approval.
Condition assignment is withheld, but deck content/style can still reveal clues; perfect blinding is not claimed.
`);
  const files = await inventory(output);
  await writeNew(mappingPath, json({
    schema_version: 1, stage: afterStage, run_manifest_sha256: verified.manifest_sha256,
    review_root: output, review_files: files, mappings: mapping,
  }));
  return { status: 'prepared-for-independent-repair-review', review: output, cases: sources.length, scored_runs: mapping.length,
    before_stage: beforeStage, after_stage: afterStage, mapping_path: mappingPath };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length < 4 || process.argv.length > 5) {
      throw new Error('Usage: node evals\\pptx-repair-round\\prepare-review.mjs <run-root> <new-neutral-review-root> [manifest-sha256]');
    }
    console.log(JSON.stringify(await prepareRepairReview({
      runRoot: process.argv[2], destination: process.argv[3], manifestSha256: process.argv[4],
    }), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
