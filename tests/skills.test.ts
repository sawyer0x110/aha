import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Type } from '@sinclair/typebox';
import { check } from '../src/core/check.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const skillNames = ['aha-research', 'aha-explain'] as const;
type SkillName = typeof skillNames[number];
const FixtureSchema = Type.Object({
  id: Type.String({ pattern: '^[a-z][a-z0-9-]+$' }),
  skill: Type.Union(skillNames.map(name => Type.Literal(name))),
  priority: Type.Union([
    Type.Literal('codebase'), Type.Literal('public'), Type.Literal('html'),
    Type.Literal('image'), Type.Literal('pptx'), Type.Literal('video'),
  ]),
  prompt: Type.String({ minLength: 61, pattern: '\\S' }),
  materials: Type.Array(Type.String({ minLength: 1, pattern: '\\S' }), { minItems: 1 }),
  references: Type.Array(Type.String({ minLength: 1, pattern: '\\S' }), { minItems: 2 }),
  manualChecks: Type.Array(Type.String({ minLength: 41, pattern: '\\S' }), { minItems: 4 }),
}, { additionalProperties: false });
const ScenariosSchema = Type.Array(FixtureSchema, { minItems: 1 });

// These are host-run evaluation cases, not claims of automated semantic or visual acceptance.
const scenarioData: unknown = JSON.parse(await fs.readFile(new URL('../evals/skills/scenarios.json', import.meta.url), 'utf8'));
const benchmarkPromptFixtures = check(ScenariosSchema, scenarioData);

async function markdownFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(target));
    else if (entry.name.endsWith('.md')) files.push(target);
  }
  return files;
}

function relativeLinks(markdown: string): string[] {
  return [...markdown.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)]
    .map(match => match[1]!)
    .filter(link => !/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(link));
}

async function publishedFiles(name: SkillName): Promise<Map<string, string>> {
  const ownRoot = path.join(root, 'skills', name);
  const sharedRoot = path.join(root, 'skills', 'shared', 'references');
  const published = new Map<string, string>();
  for (const file of await markdownFiles(ownRoot)) published.set(path.relative(ownRoot, file), file);
  for (const file of await markdownFiles(sharedRoot)) {
    const relative = path.join('references', path.relative(sharedRoot, file));
    assert.ok(!published.has(relative), `${name}: shared reference collision ${relative}`);
    published.set(relative, file);
  }
  return published;
}

async function reference(name: string, skill: SkillName = 'aha-explain'): Promise<string> {
  const files = await publishedFiles(skill);
  const file = files.get(path.join('references', name));
  assert.ok(file, `${skill}: missing reference ${name}`);
  return fs.readFile(file, 'utf8');
}

test('only two short independent skill entrances have research and creation triggers', async () => {
  const entrances = (await markdownFiles(path.join(root, 'skills')))
    .filter(file => path.basename(file) === 'SKILL.md')
    .map(file => path.basename(path.dirname(file))).sort();
  assert.deepEqual(entrances, [...skillNames].sort());
  for (const name of skillNames) {
    const markdown = await fs.readFile(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
    const frontmatter = markdown.match(/^---\r?\n([\s\S]+?)\r?\n---(?:\r?\n|$)/)?.[1];
    assert.ok(frontmatter, `${name}: frontmatter`);
    assert.match(frontmatter, new RegExp(`^name: ${name}$`, 'm'));
    const description = frontmatter.match(/^description: (.+)$/m)?.[1];
    assert.ok(description);
    assert.match(description, /codebases?/i);
    assert.match(description, /public topics|open-world/i);
    assert.match(description, /research/i);
    assert.ok(markdown.split(/\r?\n/).length < 80, `${name}: progressive disclosure`);
    assert.ok(relativeLinks(markdown).includes('references/research-workflow.md'));
    assert.ok(relativeLinks(markdown).includes('references/execution.md'));
    assert.match(markdown, /absolute installed skill.*scripts\/aha\.mjs/);
  }
  const explain = await fs.readFile(path.join(root, 'skills', 'aha-explain', 'SKILL.md'), 'utf8');
  for (const format of ['html', 'image', 'pptx', 'video']) {
    assert.ok(relativeLinks(explain).includes(`references/${format}.md`));
  }
});

test('all relative links resolve inside each distributable merged reference layout', async () => {
  for (const name of skillNames) {
    const published = await publishedFiles(name);
    for (const [relative, file] of published) {
      for (const link of relativeLinks(await fs.readFile(file, 'utf8'))) {
        const destination = path.normalize(path.join(path.dirname(relative), decodeURIComponent(link.split('#')[0]!)));
        assert.ok(published.has(destination), `${name}/${relative}: unresolved portable link ${link}`);
        assert.ok(!destination.startsWith('..'), `${name}: link escapes installation`);
      }
    }
  }
});

test('legacy entrances, authoring contracts, and command aliases are not published', async () => {
  const files = await markdownFiles(path.join(root, 'skills'));
  for (const file of files) {
    assert.ok(!['authoring.md', 'audience.md', 'formats.md', 'quality-loop.md', 'teaching-design.md'].includes(path.basename(file)));
    const markdown = await fs.readFile(file, 'utf8');
    assert.doesNotMatch(markdown, /aha-lab|aha-story|TeachingVisual|narrative\.slides|build-pack|render-card|init-draft/);
  }
});

test('research references require iterative, source-grounded inquiry rather than media planning', async () => {
  const workflow = await reference('research-workflow.md', 'aha-research');
  for (const concept of [/question tree/i, /counterevidence/i, /targeted follow-up/i, /stopping reason/i, /semantic/i, /structural/i, /observed execution/i]) {
    assert.match(workflow, concept);
  }
  const publicResearch = await reference('research-public.md', 'aha-research');
  for (const concept of [/primary/i, /methods/i, /independent/i, /denominator/i, /actual read extent/i, /paywall/i, /source support/i]) {
    assert.match(publicResearch, concept);
  }
  const code = await reference('research-codebase.md', 'aha-research');
  for (const concept of [/diff endpoints/i, /unstaged/i, /content hashes/i, /callers/i, /cancellation/i, /read-only/i, /does not mean it passed/i]) {
    assert.match(code, concept);
  }
});

test('authored source, provenance, permissions, and actual QA remain distinct contracts', async () => {
  const authoring = await reference('artifact-authoring.md');
  for (const concept of [/editable.*source|source.*authority/i, /coverage/i, /omissions/i, /draft/i, /authored/i, /explain-check/, /snapshot/i]) {
    assert.match(authoring, concept);
  }
  const execution = await reference('execution.md');
  for (const concept of [/not a sandbox/i, /explicit.*execution approval/i, /timeout/i, /no automatic installs/i, /offline/i, /license/i, /--allow-code/, /--allow-network/, /planHash/]) {
    assert.match(execution, concept);
  }
  const qa = await reference('artifact-qa.md');
  for (const concept of [/not semantic proof/i, /source context/i, /actually operate/i, /presentation application/i, /watch and listen/i, /do not fabricate human feedback/i, /blocked/i]) {
    assert.match(qa, concept);
  }
});

test('research decision guidance is shared and preserves scoped evidence and permission boundaries', async () => {
  for (const skill of skillNames) {
    const workflow = await reference('research-workflow.md', skill);
    const code = await reference('research-codebase.md', skill);
    assert.match(workflow, /smallest sufficient next check/i);
    assert.match(workflow, /comparably useful actions/i);
    assert.match(workflow, /Simple, adequately supported questions need no extra cycle/);
    assert.match(workflow, /Only executed searches, reads, and failures belong in `researchLog`/);
    assert.match(workflow, /read permission does not authorize execution/);
    assert.match(code, /Match code claims to evidence/);
    for (const claim of ['A calls B', 'Data flows from A to Z', 'Configuration X controls Y', 'Cancellation prevents retry', 'A diff changes behavior', 'Code is unused']) {
      assert.ok(code.includes(claim), `${skill}: missing claim guidance ${claim}`);
    }
    assert.match(code, /not a whole-repository checklist/);
    assert.match(code, /no caller found in the inspected scope/);
    assert.match(code, /Delayed cleanup and an extra send are different claims/);
  }
});

test('format references describe free authoring and truthful media capabilities', async () => {
  const html = await reference('html.md');
  for (const concept of [/Mermaid/, /SVG/, /keyboard/i, /reduced.motion/i, /narrow.screen/i, /offline/i]) assert.match(html, concept);
  const image = await reference('image.md');
  for (const concept of [/independent.*composition/i, /reading.size/i, /crop/i]) assert.match(image, concept);
  assert.ok(relativeLinks(image).includes('artifact-authoring.md#working-history-and-current-delivery'));
  const pptx = await reference('pptx.md');
  for (const concept of [/export default async/, /pptx, research/, /native text/i, /12-slide/, /OOXML/, /not visual review/i]) assert.match(pptx, concept);
  const video = await reference('video.md');
  for (const concept of [/Edge TTS/, /complete.*narration/i, /planHash/, /renderFrame/, /segmentFrames/, /FFmpeg/, /measured|actual audio/i, /provided-audio/, /pilot/i]) assert.match(video, concept);
});

test('format routing and optional visual recipes are available in the portable skill', async () => {
  const entrance = await fs.readFile(path.join(root, 'skills', 'aha-explain', 'SKILL.md'), 'utf8');
  for (const file of ['format-selection.md', 'visual-design.md', 'design-themes.md']) {
    assert.ok(relativeLinks(entrance).includes(`references/${file}`));
    await reference(file);
  }
  const selection = await reference('format-selection.md');
  for (const concept of [/default to HTML/i, /research-only/i, /no.*auto.*all/i, /unsupported/i, /one project per medium/i, /permission/i]) {
    assert.match(selection, concept);
  }
  for (const file of ['artifact-authoring.md', 'html.md', 'image.md', 'pptx.md', 'video.md']) {
    const markdown = await reference(file);
    assert.ok(relativeLinks(markdown).includes('visual-design.md'), `${file}: design workflow`);
    assert.doesNotMatch(markdown, /keep the Clawpilot theme|retaining the theme|preserve the scaffold's Clawpilot theme|keep a coherent Clawpilot-derived/i);
  }
});

test('language guidance distinguishes bilingual HTML, English media defaults and translation review', async () => {
  const language = await reference('language.md');
  for (const concept of [/initially English/i, /data-aha-lang/, /data-aha-title/, /English\/中文/, /en-US-JennyNeural/, /zh-CN-XiaoxiaoNeural/, /legacy/i, /negation/i, /fresh approval/i]) {
    assert.match(language, concept);
  }
  for (const name of ['artifact-authoring.md', 'html.md', 'image.md', 'pptx.md', 'video.md', 'artifact-qa.md']) {
    assert.ok(relativeLinks(await reference(name)).includes('language.md'), `${name}: language contract`);
  }
});
test('documented CLI invocations use only the canonical installed entry and command set', async () => {
  const commands = new Set([
    'doctor', 'research-init', 'research-check', 'research-build', 'research-validate',
    'explain-init', 'explain-check', 'render-html', 'render-image', 'render-pptx', 'browser-check',
    'prepare-video', 'video-plan-check', 'synthesize', 'import-audio', 'render-video',
  ]);
  const seen = new Set<string>();
  for (const file of await markdownFiles(path.join(root, 'skills'))) {
    const markdown = await fs.readFile(file, 'utf8');
    for (const match of markdown.matchAll(/^node "([^"]+)" ([a-z][a-z-]*)\b/gm)) {
      assert.equal(match[1], '<absolute installed skill>/scripts/aha.mjs');
      assert.ok(commands.has(match[2]!), `${file}: unknown command ${match[2]}`);
      seen.add(match[2]!);
    }
  }
  assert.deepEqual([...seen].sort(), [...commands].sort());
});

test('explanation editing is reachable before styling and distinct from runtime acceptance', async () => {
  const entrance = await fs.readFile(path.join(root, 'skills', 'aha-explain', 'SKILL.md'), 'utf8');
  assert.ok(relativeLinks(entrance).includes('references/explanation-writing.md'));
  assert.match(entrance, /Before styling/);
  for (const name of ['artifact-authoring.md', 'language.md', 'artifact-qa.md']) {
    assert.ok(relativeLinks(await reference(name)).includes('explanation-writing.md'), `${name}: editorial workflow`);
  }
  const writing = await reference('explanation-writing.md');
  for (const concept of [/missing relationship/i, /not a required paragraph template/i, /secondary branch/i, /headings|headlines/i, /return to research/i, /full reader-facing copy/i]) {
    assert.match(writing, concept);
  }
  const language = await reference('language.md');
  assert.match(language, /each branch independently first/i);
  assert.match(language, /revise both versions/i);
  assert.match(await reference('artifact-qa.md'), /does not pass the editorial review/i);
  assert.match(await reference('research-workflow.md', 'aha-research'), /reasoning bridge/i);
});

test('production guidance covers relationship inspection, useful editing and truthful audio reuse', async () => {
  assert.match(await reference('visual-design.md'), /marker-end/);
  assert.match(await reference('pptx.md'), /editing usability/i);
  assert.match(await reference('pptx.md'), /On a copy/i);
  const video = await reference('video.md');
  assert.match(video, /state A, a different state B, then A again/);
  assert.match(video, /new `provided-audio` plan/);
  assert.match(video, /normalization or padding/i);
  assert.match(await reference('artifact-qa.md'), /mixed-tool run/i);
});

test('editorial guidance checks standalone entry points before introducing example values', async () => {
  const writing = await reference('explanation-writing.md');
  for (const concept of [/Read the title alone/i, /without the prompt/i, /after naming the entity/i, /do not invent them/i, /Revert a change, not a number/i, /separately in each language/i, /browser titles, gallery labels/i]) {
    assert.match(writing, concept);
  }
  assert.match(await reference('artifact-qa.md'), /title alone as a cold reader/i);
});

test('HTML structures are alternatives rather than mandatory article ingredients', async () => {
  const html = await reference('html.md');
  assert.match(html, /diagram-led single view/);
  assert.match(html, /interactive exploration/);
  assert.match(html, /accessible textual explanation/);
  assert.match(html, /not mandatory ingredients/);
  assert.doesNotMatch(html, /Use a readable long-form document/);
});

test('common contracts have explicit owners and delivery distinguishes history from current output', async () => {
  const authoring = await reference('artifact-authoring.md');
  for (const concept of [
    /owns permissions and dependencies/, /owns final acceptance/, /owns source identity/,
    /Working history/, /Current delivery/, /CLI still rejects overwrites/,
    /user-authorized scope/, /output and its receipt together/, /original output filename/,
    /not an atomic publishing feature/, /cleanup was not authorized/,
  ]) assert.match(authoring, concept);
  const lifecycle = 'artifact-authoring.md#working-history-and-current-delivery';
  for (const name of ['artifact-qa.md', 'image.md', 'pptx.md', 'video.md']) {
    assert.ok(relativeLinks(await reference(name)).includes(lifecycle), `${name}: shared delivery contract`);
  }
});

test('learner acceptance requires unseen reasoning and does not treat model judgment as human evidence', async () => {
  const qa = await reference('artifact-qa.md');
  for (const concept of [
    /unseen case/, /before revealing answers/, /prior knowledge/,
    /anonymized responses with consent/, /balanced allocation or matched tasks/,
    /practice gains/, /not a mandatory quiz/,
  ]) assert.match(qa, concept);
});

test('editorial evaluation prompts preserve concrete evidence and held-out topic coverage', async () => {
  const fixtures = JSON.parse(await fs.readFile(path.join(root, 'tests', 'fixtures', 'explanation-writing-evals.json'), 'utf8')) as {
    skill_name: string;
    scope: string;
    evals: { id: number; name: string; prompt: string; expected_output: string; files: string[]; assertions: string[] }[];
  };
  assert.equal(fixtures.skill_name, 'aha-explain');
  assert.match(fixtures.scope, /not full media generation/);
  assert.match(fixtures.scope, /answer-rich rewriting regression/i);
  assert.deepEqual(fixtures.evals.map(item => item.id), [1, 2, 3]);
  assert.deepEqual(fixtures.evals.map(item => item.name), ['anc-opening', 'git-net-change', 'cold-glass-transfer']);
  for (const item of fixtures.evals) {
    assert.ok(item.prompt.length > 200);
    assert.match(item.prompt, /中文和英文/);
    assert.ok(item.expected_output.length > 60);
    assert.equal(item.assertions.length, 6);
    assert.ok(item.assertions.some(assertion => /Each title alone/.test(assertion)));
    assert.deepEqual(item.files, []);
  }
});

test('worked research example is a complete valid dossier, not only a documentation placeholder', async () => {
  const example = await reference('research-example.md', 'aha-research');
  const json = example.match(/```json\r?\n([\s\S]*?)\r?\n```/)?.[1];
  assert.ok(json, 'example must contain a complete JSON draft');
  const input: unknown = JSON.parse(json);
  const { buildDossier, checkResearchDraft, validateDossier } = await import('../src/research/dossier.js');
  const draftCheck = checkResearchDraft(input);
  assert.equal(draftCheck.ready, false);
  assert.deepEqual(draftCheck.pending, []);
  const dossier = await buildDossier(input);
  await validateDossier(dossier);
  assert.equal(dossier.research.kind, 'provided');
  assert.equal(dossier.research.researchLog.length, 0);
  assert.match(dossier.research.report, /synthetic example/i);
  assert.match(dossier.research.report, /Tuesday/);
  assert.ok(dossier.research.subquestions.some(question => question.status === 'unresolved' && question.gapIds.length));
});

test('scenario schema rejects malformed and unknown fields before fixtures are consumed', () => {
  const fixture = benchmarkPromptFixtures[0];
  assert.ok(fixture);
  for (const value of [null, {}, [], [null]]) {
    assert.throws(() => check(ScenariosSchema, value));
  }
  for (const field of ['id', 'skill', 'priority', 'prompt', 'materials', 'references', 'manualChecks']) {
    assert.throws(() => check(ScenariosSchema, [{ ...fixture, [field]: undefined }]), field);
  }
  for (const invalid of [
    { id: 'invalid id' }, { skill: 'unknown-skill' }, { priority: 'unknown-priority' },
    { prompt: 42 }, { prompt: ' '.repeat(70) }, { materials: [] }, { materials: [42] },
    { materials: [' '] }, { references: ['only-one.md'] }, { references: [null, null] },
    { manualChecks: ['too short'] }, { manualChecks: Array(4).fill(42) }, { unexpected: true },
  ]) {
    assert.throws(() => check(ScenariosSchema, [{ ...fixture, ...invalid }]));
  }
});

test('manual benchmark fixtures cover both entry points and all media without pretending to run host QA', async () => {
  const ids = new Set<string>();
  const priorities = new Set<string>();
  const coveredSkills = new Set<string>();
  for (const fixture of benchmarkPromptFixtures) {
    assert.match(fixture.id, /^[a-z][a-z0-9-]+$/);
    assert.ok(!ids.has(fixture.id), `duplicate fixture ${fixture.id}`);
    ids.add(fixture.id);
    assert.ok(skillNames.includes(fixture.skill));
    assert.ok(fixture.prompt.length > 60);
    assert.ok(fixture.materials.length > 0 && fixture.materials.every(item => item.trim()));
    assert.ok(fixture.manualChecks.length >= 4 && fixture.manualChecks.every(item => item.length > 40));
    assert.ok(fixture.references.length >= 2);
    for (const name of fixture.references) await reference(name, fixture.skill);
    priorities.add(fixture.priority);
    coveredSkills.add(fixture.skill);
  }
  assert.deepEqual([...priorities].sort(), ['codebase', 'html', 'image', 'pptx', 'public', 'video']);
  assert.deepEqual([...coveredSkills].sort(), [...skillNames].sort());
});

test('research host scenarios include evidence selection, unavailable evidence and an early-stop control', () => {
  for (const id of [
    'deep-public-conflicting-results', 'dirty-codebase-cancellation',
    'decisive-evidence-unavailable', 'sufficient-evidence-stop',
  ]) {
    const scenario = benchmarkPromptFixtures.find(item => item.id === id);
    assert.ok(scenario, `missing host scenario ${id}`);
    assert.equal(scenario.skill, 'aha-research');
    assert.ok(scenario.references.includes('research-workflow.md'));
  }
  // These assertions check scenario availability, not author behavior or semantic quality.
});
