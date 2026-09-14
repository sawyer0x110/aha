import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const skillNames = ['aha-research', 'aha-explain'] as const;
type SkillName = typeof skillNames[number];
type Fixture = {
  id: string;
  skill: SkillName;
  priority: 'codebase' | 'public' | 'html' | 'image' | 'pptx' | 'video';
  prompt: string;
  materials: string[];
  references: string[];
  manualChecks: string[];
};

// These are host-run evaluation cases, not claims of automated semantic or visual acceptance.
export const benchmarkPromptFixtures: Fixture[] = [
  {
    id: 'deep-public-conflicting-results', skill: 'aha-research', priority: 'public',
    prompt: 'Investigate whether this public intervention improved outcomes. Follow original methods, compare contrary findings, and explain what remains uncertain. Spend at most eight substantive source reads; deliver research only.',
    materials: ['Primary report and methods appendix', 'Two derivative articles sharing that report', 'Independent null-result study', 'A later correction'],
    references: ['research-workflow.md', 'research-public.md', 'research-contract.md'],
    manualChecks: [
      'Question tree evolves after the correction; actual queries, source reads, failures, and stopping reason are logged separately from plans.',
      'Reads methods and contrary evidence, follows primary citations, and does not count derivative articles as independent support.',
      'Reconciles units, denominators, population, time window, causal strength, and uncertainty in the direct answer.',
      'Reverse-checks consequential claims against source context; preserves gaps rather than manufacturing consensus.',
      'Delivers an independently useful report and valid Dossier without requiring slides, a model, or teaching tests.',
    ],
  },
  {
    id: 'dirty-codebase-cancellation', skill: 'aha-research', priority: 'codebase',
    prompt: 'Investigate request cancellation and retry behavior from the supplied base commit to this dirty workspace. Follow state and failure paths; tools are read-only and LSP is unavailable. Do not execute or install anything.',
    materials: ['Authorized repository with staged, unstaged, and relevant untracked changes', 'Base commit', 'Tests and configuration', 'Read-only file/search tools'],
    references: ['research-codebase.md', 'research-workflow.md', 'execution.md'],
    manualChecks: [
      'Fixes both diff endpoints and actual dirty content identities with accurate file/symbol locators.',
      'Uses bounded text navigation and traces definitions, callers, cancellation, retry state, cleanup, and a plausible counterexample.',
      'Cross-checks tests and configuration while distinguishing source implications from observed execution.',
      'Does not run repository scripts, install navigation tools, or claim unread branches and unexecuted tests passed.',
      'Updates questions and contradictions, delivers remaining gaps and a defensible stopping reason.',
    ],
  },
  {
    id: 'unread-public-source', skill: 'aha-explain', priority: 'public',
    prompt: 'Make an infographic about this public article, but only its abstract is available and the full text requires access we do not have. Establish what can be supported before creating the image.',
    materials: ['Authorized abstract', 'Title and inaccessible full-text URL', 'No login or extraction capability'],
    references: ['research-public.md', 'research-workflow.md', 'image.md'],
    manualChecks: [
      'Uses the shared research method directly without assuming host dispatch to another skill.',
      'Records abstract-only read extent and failed access; never invents full-text conclusions or page locators.',
      'Narrows the explanation to supported claims or reports a research blocker before authoring.',
      'Does not turn unavailable evidence into a confident visual claim or bypass access controls.',
    ],
  },
  {
    id: 'topic-to-rich-offline-html', skill: 'aha-explain', priority: 'html',
    prompt: 'Starting from this public technical topic, research the important tradeoffs and make a rich offline explanation with long prose, a wide comparison table, a sequence diagram, and useful keyboard-accessible interaction. No simulator is needed.',
    materials: ['Topic and target audience knowledge', 'Primary standards and competing implementation notes', 'Installed local browser and optional Mermaid tool'],
    references: ['research-workflow.md', 'artifact-authoring.md', 'html.md', 'artifact-qa.md'],
    manualChecks: [
      'Performs iterative research and source review, then authors actual topic-specific source and coverage instead of declaring the scaffold authored.',
      'Uses free document structure, optional theme recipes with consistent runtime color roles, readable prose measure, and independent wide-content expansion.',
      'Diagram relationships and interaction help answer the question; no invented causal slider or mandatory quiz.',
      'Opens the delivered HTML offline at desktop and narrow sizes, operates controls with keyboard, and tests reduced motion and font loading.',
      'Uses local resources without CDN fallback and distinguishes browser receipts from actual visual review.',
    ],
  },
  {
    id: 'mixed-version-explanation', skill: 'aha-explain', priority: 'codebase',
    prompt: 'Explain this local implementation against the latest public specification in HTML. The supplied research predates the dirty change; supplement only the affected questions, preserve the old snapshot, and show the remaining mismatch.',
    materials: ['Existing Dossier', 'Authorized dirty source change', 'New public specification revision'],
    references: ['research-codebase.md', 'research-public.md', 'research-contract.md', 'artifact-authoring.md'],
    manualChecks: [
      'Checks freshness and coverage, records exact local and public versions, and investigates the affected path.',
      'Does not use the public specification as proof of implemented behavior or silently mutate the prior snapshot.',
      'Rebuilds research at a new destination and binds authored coverage to the new research identity.',
      'The explanation distinguishes actual source evidence, specification requirements, and unresolved observations.',
    ],
  },
  {
    id: 'full-size-image-infographic', skill: 'aha-explain', priority: 'image',
    prompt: 'Turn this reviewed research into a tall shareable infographic with a connected visual argument, several necessary subclaims, readable Chinese labels, units, and source notes. Preserve editable source and do not screenshot the whole article.',
    materials: ['Reviewed Dossier', 'Local licensed font/assets', 'Explicit size and resource budget'],
    references: ['artifact-authoring.md', 'image.md', 'artifact-qa.md'],
    manualChecks: [
      'Designs a medium-specific layout and complete image root rather than a fixed card or scaled article.',
      'Reviews authored page code before approved local rendering; no remote font or dependency download occurs.',
      'Checks the full PNG and realistic reading-size crops for all edges, connectors, glyphs, source notes, and legibility.',
      'Reports capture-size limits without silent cropping and fact-checks labels, relationships, and numerical comparisons.',
    ],
  },
  {
    id: 'native-detailed-pptx', skill: 'aha-explain', priority: 'pptx',
    prompt: 'Create a detailed native editable PPTX from this research for a technically knowledgeable team. Cover mechanisms, comparisons, evidence, failure boundaries, and an appendix; use as many pages as the agreed budget requires, not a twelve-slide cap.',
    materials: ['Reviewed Dossier', 'Coverage needs requiring more than twelve slides', 'Local assets and presentation application'],
    references: ['artifact-authoring.md', 'pptx.md', 'execution.md', 'artifact-qa.md'],
    manualChecks: [
      'Plans complete coverage and varied layouts within the agreed budget instead of truncating content or shrinking text.',
      'Authors native text, shapes, tables, and charts via the supplied PptxGenJS instance; discloses noneditable inserted graphics.',
      'Reviews and explicitly approves the Node source before execution with timeout; does not call the runtime sandboxed.',
      'Checks OOXML/text coverage and notes separately from actual slide rendering and representative native editing.',
      'Inspects every actual slide and continuity in a presentation application; unavailable application means visual QA blocked, not passed.',
    ],
  },
  {
    id: 'approved-dynamic-video', skill: 'aha-explain', priority: 'video',
    prompt: 'Produce a dynamic narrated video from this private test research, beginning with a 20–30 second mechanism pilot. Before any Edge TTS upload show the complete narration, provider, voice, rate, and disclosure scope. No external speech call is authorized yet.',
    materials: ['Private synthetic Dossier without real sensitive data', 'Local browser and FFmpeg', 'Optional user-provided audio'],
    references: ['artifact-authoring.md', 'video.md', 'video-contract.md', 'execution.md', 'artifact-qa.md'],
    manualChecks: [
      'Writes topic-specific scene source and complete segment narration; pilot includes within-scene state/relationship changes, not just page fades.',
      'Shows the entire current plan narration and voice configuration before asking approval bound to the current planHash.',
      'Separates narration consent, external network permission, and reviewed local code execution; does not transmit the whole Dossier.',
      'A changed narration/voice plan requires fresh approval; imported audio is explicitly labelled provided-audio, never a fake Edge success.',
      'Uses measured audio timing and deterministic browser-captured frames with FFmpeg, not a nonexistent Remotion command.',
      'Actually watches/listens to pilot and final output, checks subtitle safe area and timing, and reports any blocked playback or missing dependency.',
    ],
  },
  {
    id: 'unspecified-visual-format', skill: 'aha-explain', priority: 'html',
    prompt: 'Use this reviewed research to explain the mechanism visually for a general reader. I have not chosen a file format; avoid unnecessary questions and do not create extra deliverables.',
    materials: ['Reviewed Dossier', 'No requested format or decisive delivery context'],
    references: ['format-selection.md', 'visual-design.md', 'design-themes.md', 'html.md'],
    manualChecks: [
      'Defaults to HTML and briefly explains the choice without asking a routine format question.',
      'Does not make PNG, PPTX, video, or speech merely because the skill supports them.',
      'Selects an appropriate visual direction and content-specific reading path rather than uniform cards.',
      'Still reviews authored code and obtains execution permission independently of format selection.',
    ],
  },
  {
    id: 'explicit-multiple-formats-with-brand', skill: 'aha-explain', priority: 'pptx',
    prompt: 'Create HTML and an editable PPT from the same research, no video or image. Follow our supplied editorial brand guide rather than the scaffold theme; vary the layouts for mechanisms and comparisons.',
    materials: ['Reviewed Dossier', 'Authorized brand guide with local fonts', 'Two requested deliverables'],
    references: ['format-selection.md', 'visual-design.md', 'design-themes.md', 'artifact-qa.md'],
    manualChecks: [
      'Creates exactly two separate projects bound to the same reviewed Dossier, without using an all-format CLI flag.',
      'Follows the supplied brand instead of forcing Clawpilot or an optional recipe onto the work.',
      'Adapts HTML and native slides independently, preserving material limitations and source facts.',
      'Records actual medium-specific inspection and any missing application rather than declaring both visually approved.',
    ],
  },
  {
    id: 'source-only-presentation-revision', skill: 'aha-explain', priority: 'html',
    prompt: 'Revise this approved explanation’s layout and diagram to improve narrow-screen reading, keeping its research facts unchanged. Preserve the old output; do not ask for new research approval or execute revised code without reviewing it.',
    materials: ['Authored project and original output', 'Unchanged Dossier', 'User presentation-only revision request'],
    references: ['artifact-authoring.md', 'execution.md', 'artifact-qa.md'],
    manualChecks: [
      'Edits the authoritative source and updates coverage if block locations change; does not patch only the final output.',
      'Preserves the original output and research identity without fabricating new facts or mandatory reapproval of unchanged research.',
      'Reviews changed executable behavior and obtains any needed local execution permission; presentation authorization is not TTS consent.',
      'Rebuilds a new file and actually checks narrow-screen interaction; does not invent human feedback.',
    ],
  },
];

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

test('format references describe free authoring and truthful media capabilities', async () => {
  const html = await reference('html.md');
  for (const concept of [/Mermaid/, /SVG/, /keyboard/i, /reduced.motion/i, /narrow.screen/i, /offline/i]) assert.match(html, concept);
  const image = await reference('image.md');
  for (const concept of [/independent.*composition/i, /reading.size/i, /crop/i, /editable source/i]) assert.match(image, concept);
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
