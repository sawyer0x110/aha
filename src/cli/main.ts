import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { check } from '../core/check.js';
import { AhaError, fail } from '../core/errors.js';
import { hashValue } from '../core/identity.js';
import { ResearchKindSchema } from '../research/schema.js';
import { createResearchDraft, checkResearchDraft, buildDossier, readDossier, writeDossier } from '../research/dossier.js';
import { FORMATS, LANGUAGES, type Format, type ArtifactLanguage, initArtifact, checkArtifact } from '../artifacts/project.js';
import { renderHtml, renderImage, renderPptx, checkBrowser, runPptxWorker } from '../artifacts/render.js';
import { prepareVideoPlan, validateVideoPlan, type VideoPlan } from '../media/plan.js';
import { importAudio, synthesize } from '../media/audio.js';
import { renderVideo } from '../media/video.js';
import { doctorRequirements, inspectDependencies } from './doctor.js';
import { assertOutsideSource, limitedJsonText, readJson, writeNewFile } from './files.js';

const VERSION = '0.3.0';
const USAGE = [
  'doctor [--for research|html|browser|image|pptx|video|speech | --media]',
  'research-init <question> <new-draft.json> [--kind public|codebase|mixed|provided]',
  'research-check <draft.json> [--draft]',
  'research-build <draft.json> <new-research-directory>',
  'research-validate <research-directory>',
  'explain-init <research-directory> <html|image|pptx|video> <new-project-directory> [--language en|zh|bilingual]',
  'explain-check <project-directory>',
  'render-html <project-directory> <new-output.html>',
  'render-image <project-directory> <new-output.png> --allow-code',
  'render-pptx <project-directory> <new-output.pptx> --allow-code',
  'browser-check <project-directory> --allow-code',
  'prepare-video <project-directory> <new-plan.json>',
  'video-plan-check <project-directory> <plan.json>',
  'synthesize <project-directory> <plan.json> <new-audio-directory> --approve <planHash> --allow-network',
  'import-audio <project-directory> <plan.json> <audio-list.json> <new-audio-directory> --approve <planHash>',
  'render-video <project-directory> <plan.json> <audio-directory> <new-output.mp4> --approve <planHash> --allow-code',
];

function parse(args: string[], count: number, valueFlags: string[] = [], switches: string[] = []) {
  const positional: string[] = [];
  const values: Record<string, string> = {};
  const enabled = new Set<string>();
  for (let index = 0; index < args.length; index++) {
    const token = args[index]!;
    if (!token.trim()) fail('USAGE', 'Empty arguments are not supported.');
    if (!token.startsWith('--')) { positional.push(token); continue; }
    if (enabled.has(token) || token in values) fail('USAGE', `Duplicate option: ${token}.`);
    if (switches.includes(token)) enabled.add(token);
    else if (valueFlags.includes(token)) {
      const value = args[++index];
      if (!value || value.startsWith('--')) fail('USAGE', `Expected a value after ${token}.`);
      values[token] = value;
    } else fail('USAGE', `Unknown option ${token}. Run help for syntax.`);
  }
  if (positional.length !== count) fail('USAGE', `Expected ${count} positional arguments. Run help for syntax.`);
  const at = (index: number): string => positional[index]!;
  return { at, values, enabled };
}

function extension(file: string, expected: string): void {
  if (path.extname(file).toLowerCase() !== expected) fail('OUTPUT_EXTENSION', `Output must use ${expected}.`, file);
}

async function approvedPlan(project: string, file: string, approval?: string): Promise<VideoPlan> {
  const plan = await validateVideoPlan(project, await readJson(file));
  const planHash = await hashValue(plan);
  if (!approval || approval !== planHash) {
    fail('NARRATION_APPROVAL_REQUIRED', 'Review the complete current plan and pass its exact hash using --approve.');
  }
  return plan;
}

async function execute(command: string, args: string[]): Promise<object> {
  switch (command) {
    case 'help':
    case '--help':
    case '-h':
      parse(args, 0);
      return { status: 'ok', version: VERSION, skills: ['aha-research', 'aha-explain'], commands: USAGE };
    case 'doctor': {
      const { enabled, values } = parse(args, 0, ['--for'], ['--media']);
      const requirements = doctorRequirements(values['--for'], enabled.has('--media'));
      if (Number(process.versions.node.split('.')[0]) < 22) fail('NODE_VERSION', 'Node 22 or newer is required.');
      const runtime = await readFile(fileURLToPath(new URL('../assets/runtime/mermaid.js', import.meta.url)), 'utf8');
      if (!runtime.length) fail('RUNTIME_MISSING', 'Local diagram runtime is missing; rebuild the complete Skill.');
      const { readiness, selectedPython } = await inspectDependencies(requirements);
      return {
        status: Object.values(readiness).some(value => value !== 'ready') ? 'degraded' : 'ok',
        version: VERSION, node: process.versions.node, skills: ['aha-research', 'aha-explain'],
        capabilities: {
          research: true, modelFreeDossier: true, freeHtml: true, mermaid: true,
          image: true, pptx: true, video: true, realExecution: false,
          videoEngine: 'authored-browser-frames', networkRequiredForHtml: false,
          networkRequiredForEdgeTts: true,
        },
        execution: 'Authored browser/Node code requires --allow-code after review; not an OS sandbox.',
        dependencyScope: enabled.has('--media') ? 'all-media-diagnostics' : values['--for'] ?? 'basic',
        requiredProbes: requirements,
        mediaReadiness: requirements.length ? readiness : 'not-probed; not-required-for-this-step; use doctor --for for optional tools',
        ...(selectedPython ? { pythonRuntime: selectedPython } : {}),
        mediaRequirements: ['installed Edge/Chrome', 'ffmpeg + ffprobe', 'Python + edge-tts==7.2.8 only for online synthesis'],
        scopeNote: 'Missing tools block only the corresponding step. No network synthesis or presentation-application visual review was performed.',
        semanticReview: 'Neither doctor nor structural checks certify facts, visual quality or host routing.',
      };
    }
    case 'research-init': {
      const { at, values } = parse(args, 2, ['--kind']);
      extension(at(1), '.json');
      const kind = values['--kind'] === undefined ? undefined : check(ResearchKindSchema, values['--kind']);
      await writeNewFile(at(1), limitedJsonText(createResearchDraft(at(0), kind), at(1)));
      return { status: 'draft', output: path.resolve(at(1)), researchPerformed: false };
    }
    case 'research-check':
    case 'research-build': {
      const { at, enabled } = parse(args, command === 'research-check' ? 1 : 2, [], command === 'research-check' ? ['--draft'] : []);
      const input = await readJson(at(0));
      if (enabled.has('--draft')) return checkResearchDraft(input);
      const dossier = await buildDossier(input);
      if (command === 'research-build') await writeDossier(at(1), dossier);
      return {
        status: 'validated', researchHash: dossier.manifest.contentHash,
        claims: dossier.research.claims.length, evidence: dossier.research.evidence.length,
        ...(command === 'research-build' ? { output: path.resolve(at(1)) } : {}),
        semanticScope: 'structure-reference-coverage-and-content-identity',
        sourceRetrievalPerformed: false, externalTruthVerified: false,
      };
    }
    case 'research-validate': {
      const { at } = parse(args, 1);
      const dossier = await readDossier(at(0));
      return { status: 'validated', researchHash: dossier.manifest.contentHash, externalTruthVerified: false };
    }
    case 'explain-init': {
      const { at, values } = parse(args, 3, ['--language']);
      const format = at(1);
      if (!FORMATS.includes(format as Format)) fail('ARTIFACT_FORMAT', 'Choose html, image, pptx or video.');
      const language = values['--language'];
      if (language !== undefined && !LANGUAGES.includes(language as ArtifactLanguage)) {
        fail('ARTIFACT_LANGUAGE', 'Choose en, zh or bilingual (HTML only).');
      }
      return initArtifact(at(0), format as Format, at(2), language as ArtifactLanguage | undefined);
    }
    case 'explain-check': {
      const { at } = parse(args, 1);
      const result = await checkArtifact(at(0));
      if ('ready' in result && result.ready === false) process.exitCode = 1;
      return result;
    }
    case 'render-html': {
      const { at } = parse(args, 2);
      extension(at(1), '.html');
      return renderHtml(at(0), at(1));
    }
    case 'render-image':
    case 'render-pptx': {
      const { at, enabled } = parse(args, 2, [], ['--allow-code']);
      extension(at(1), command === 'render-image' ? '.png' : '.pptx');
      return command === 'render-image'
        ? renderImage(at(0), at(1), enabled.has('--allow-code'))
        : renderPptx(at(0), at(1), enabled.has('--allow-code'));
    }
    case '_pptx-worker': {
      const { at, enabled } = parse(args, 2, [], ['--allow-code']);
      if (!enabled.has('--allow-code')) fail('CODE_PERMISSION', 'PPTX author code needs explicit --allow-code.');
      await runPptxWorker(at(0), at(1));
      return { status: 'rendered' };
    }
    case 'browser-check': {
      const { at, enabled } = parse(args, 1, [], ['--allow-code']);
      return checkBrowser(at(0), enabled.has('--allow-code'));
    }
    case 'prepare-video':
    case 'video-plan-check': {
      const { at } = parse(args, 2);
      const plan = command === 'prepare-video'
        ? await prepareVideoPlan(at(0))
        : await validateVideoPlan(at(0), await readJson(at(1)));
      const planHash = await hashValue(plan);
      if (command === 'prepare-video') {
        extension(at(1), '.json');
        await assertOutsideSource(at(0), at(1));
        await writeNewFile(at(1), limitedJsonText(plan, at(1)));
      }
      return { status: 'awaiting-review', planHash, provider: plan.provider, plan, approvalRecorded: false };
    }
    case 'synthesize': {
      const { at, values, enabled } = parse(args, 3, ['--approve'], ['--allow-network']);
      const plan = await approvedPlan(at(0), at(1), values['--approve']);
      await assertOutsideSource(at(0), at(2));
      const script = fileURLToPath(new URL('../assets/media/edge_speech.py', import.meta.url));
      const audio = await synthesize(plan, at(2), enabled.has('--allow-network'), script);
      return { status: 'generated', output: path.resolve(at(2)), audio, listeningReview: 'not-performed' };
    }
    case 'import-audio': {
      const { at, values } = parse(args, 4, ['--approve']);
      const plan = await approvedPlan(at(0), at(1), values['--approve']);
      await assertOutsideSource(at(0), at(3));
      const audio = await importAudio(plan, await readJson(at(2)), path.dirname(path.resolve(at(2))), at(3));
      return { status: 'generated', output: path.resolve(at(3)), audio, listeningReview: 'not-performed' };
    }
    case 'render-video': {
      const { at, values, enabled } = parse(args, 4, ['--approve'], ['--allow-code']);
      extension(at(3), '.mp4');
      const plan = await approvedPlan(at(0), at(1), values['--approve']);
      await assertOutsideSource(at(0), at(3));
      return renderVideo(at(0), plan, at(2), at(3), enabled.has('--allow-code'));
    }
    default:
      return fail('COMMAND_UNKNOWN', `Unknown command ${command}. Only research/explain workflows are supported; run help.`);
  }
}

try {
  const [command = 'help', ...args] = process.argv.slice(2);
  console.log(JSON.stringify(await execute(command, args)));
} catch (error) {
  if (error instanceof AhaError) {
    console.log(JSON.stringify({ status: 'failed', error: { code: error.code, message: error.message, path: error.path } }));
  } else if (error instanceof Error) {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : 'INTERNAL_ERROR';
    const message = code === 'EEXIST'
      ? 'Output already exists. Choose a new versioned path; existing artifacts were not replaced.'
      : error.message;
    console.log(JSON.stringify({ status: 'failed', error: { code, message } }));
  } else {
    console.log(JSON.stringify({ status: 'failed', error: { code: 'INTERNAL_ERROR', message: 'Unknown failure.' } }));
  }
  process.exitCode = 1;
}
