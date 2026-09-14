import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { check } from '../core/check.js';
import { AhaError, fail } from '../core/errors.js';
import { createDraft, createExample } from '../core/examples.js';
import { createExploration, importExploration } from '../core/exploration.js';
import { canonicalize, hashValue } from '../core/identity.js';
import { buildPack } from '../core/pack.js';
import { EngineSchema, type Pack } from '../core/schema.js';
import { renderHtml, type RenderAssets } from '../renderers/html.js';
import { renderCardHtml } from '../renderers/card.js';
import { renderPptx } from '../renderers/pptx.js';
import { captureHtml, openBrowser } from '../media/browser.js';
import { prepareVideoPlan, validateVideoPlan, approvePlan } from '../media/plan.js';
import { importAudio, synthesize } from '../media/audio.js';
import { renderVideo } from '../media/video.js';
import { ffmpeg, ffprobe, pythonRuntime, runTool } from '../media/process.js';
import { assertOutsidePack, limitedJsonText, readJson, readPack, writeNewFile, writePack, writeReceipt } from './files.js';

const VERSION = '0.2.0';
const USAGE = [
  'doctor [--media]',
  'init <retry|compound|evidence> <new-draft.json>',
  'build-pack <draft.json> <new-pack.aha>',
  'example <retry|compound|evidence> <new-pack.aha>',
  'validate <pack.aha>',
  'run <pack.aha> <scenario-id>',
  'render-lab <pack.aha> <new-output.html>',
  'render-slides <pack.aha> <new-output.html>',
  'research-check <draft.json>',
  'render-card <pack.aha> <new-output.html>',
  'render-image <pack.aha> <new-output.png>',
  'render-pptx <pack.aha> <new-output.pptx>',
  'prepare-video <pack.aha> <new-plan.json>',
  'video-plan-check <pack.aha> <plan.json>',
  'synthesize <pack.aha> <plan.json> <new-audio-dir> --approve <planHash> --allow-network',
  'import-audio <pack.aha> <plan.json> <audio-files.json> <new-audio-dir> --approve <planHash>',
  'export-exploration <pack.aha> <new-output.json> [scenario-id ...]',
  'import-exploration <original-pack.aha> <exploration.json> <new-pack.aha>',
  'render-video <pack.aha> <plan.json> <audio-dir> <new-output.mp4> --approve <planHash>',
];

function arity(args: string[], min: number, max = min): void {
  if (args.length < min || args.length > max) {
    fail('USAGE', `Expected ${min === max ? min : `${min}..${max}`} arguments. Run help for syntax.`);
  }
}

function arg(args: string[], index: number): string {
  const value = args[index];
  if (value === undefined || !value.trim()) fail('USAGE', `Missing argument ${index + 1}.`);
  return value;
}

function extension(file: string, expected: string): void {
  if (path.extname(file).toLowerCase() !== expected) fail('OUTPUT_EXTENSION', `Output must use the ${expected} extension.`, file);
}

async function assets(): Promise<RenderAssets> {
  const root = fileURLToPath(new URL('../assets/runtime/', import.meta.url));
  return {
    labJs: await readFile(path.join(root, 'lab.js'), 'utf8'),
    slidesJs: await readFile(path.join(root, 'slides.js'), 'utf8'),
    revealJs: await readFile(path.join(root, 'reveal.js'), 'utf8'),
    revealCss: await readFile(path.join(root, 'reveal.css'), 'utf8'),
  };
}

function validateHtml(html: string, pack: Pack): void {
  if (!/^<!doctype html>/i.test(html.trimStart()) || !html.includes('</html>')) {
    fail('HTML_INVALID', 'Renderer did not produce a complete HTML document.');
  }
  if (Buffer.byteLength(html, 'utf8') > 5 * 1024 * 1024) fail('HTML_SIZE', 'Offline HTML exceeds the 5 MiB release limit.');
  if (/<(?:script|img|iframe)\b[^>]*\bsrc\s*=\s*["']\s*(?:https?:)?\/\//i.test(html)
    || /<link\b[^>]*\bhref\s*=\s*["']\s*(?:https?:)?\/\//i.test(html)) {
    fail('HTML_EXTERNAL_RESOURCE', 'Rendered HTML must not load remote dependencies.');
  }
  const data = /<script\b[^>]*\bid=["']aha-pack["'][^>]*>([\s\S]*?)<\/script>/i.exec(html)?.[1];
  if (!data) fail('HTML_PACK_MISSING', 'Rendered HTML must embed its Pack identity.');
  if (canonicalize(JSON.parse(data)) !== canonicalize(pack)) {
    fail('HTML_PACK_MISMATCH', 'Renderer changed the embedded Pack.');
  }
}

function bindStaticPack(html: string, pack: Pack): string {
  if (/<script\b[^>]*\bid=["']aha-pack["']/i.test(html)) return html;
  const data = JSON.stringify(pack).replace(/[<>&\u2028\u2029]/gu, character =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
  if (!html.includes('</body>')) fail('HTML_INVALID', 'Static renderer must produce a complete body.');
  return html.replace('</body>', `<script id="aha-pack" type="application/json">${data}</script></body>`);
}

async function execute(command: string, args: string[]): Promise<object> {
  switch (command) {
    case 'help':
    case '--help':
    case '-h':
      arity(args, 0);
      return { status: 'ok', version: VERSION, commands: USAGE };
    case 'doctor': {
      arity(args, 0, 1);
      if (args[0] && args[0] !== '--media') fail('USAGE', 'Only --media is supported by doctor.');
      const major = Number(process.versions.node.split('.')[0]);
      if (major < 22) fail('NODE_VERSION', 'Node 22 or newer is required.');
      const runtime = await assets();
      const readiness: Record<string, string> = {};
      const selectedPython = args[0] === '--media' ? pythonRuntime() : undefined;
      if (selectedPython) {
        const probes: Array<[string, () => Promise<unknown>]> = [
          ['ffmpeg', () => runTool(ffmpeg(), ['-version'])],
          ['ffprobe', () => runTool(ffprobe(), ['-version'])],
          ['edgeTts', () => runTool(selectedPython.executable, ['-c', 'import edge_tts; assert edge_tts.__version__ == "7.2.8", "Expected edge-tts==7.2.8"; print(edge_tts.__version__)'])],
          ['browser', async () => { const browser = await openBrowser(); await browser.close(); }],
        ];
        await Promise.all(probes.map(async ([name, probe]) => {
          try { await probe(); readiness[name] = 'ready'; }
          catch (error) {
            if (!(error instanceof Error)) throw error;
            readiness[name] = `unavailable: ${error.message}`;
          }
        }));
      }
      return {
        status: Object.values(readiness).some(value => value !== 'ready') ? 'degraded' : 'ok',
        version: VERSION, node: process.versions.node,
        capabilities: {
          lab: runtime.labJs.length > 0, slides: runtime.slidesJs.length > 0,
          video: true, image: true, pptx: true, researchLedger: true,
          sourcedStateTeaching: true, predictionFeedback: true,
          realExecution: false, networkRequiredForHtml: false, networkRequiredForEdgeTts: true,
        },
        mediaReadiness: args[0] ? readiness : 'not-probed; run doctor --media (local checks only)',
        ...(selectedPython ? { pythonRuntime: selectedPython } : {}),
        ...(readiness.edgeTts?.startsWith('unavailable') ? {
          mediaSetup: 'Use an approved Python environment with edge-tts==7.2.8. AHA_PYTHON overrides the active virtualenv, then the current project .venv-media, then PATH. No dependencies were installed.',
        } : {}),
        mediaRequirements: ['installed Edge/Chrome', 'ffmpeg + ffprobe', 'Python + edge-tts==7.2.8 only for online synthesis'],
      };
    }
    case 'init': {
      arity(args, 2);
      const engine = check(EngineSchema, arg(args, 0));
      const output = arg(args, 1);
      extension(output, '.json');
      await writeNewFile(output, limitedJsonText(createDraft(engine), output));
      return { status: 'draft', output: path.resolve(output), syntheticTemplate: true };
    }
    case 'build-pack':
    case 'example': {
      arity(args, 2);
      const output = arg(args, 1);
      extension(output, '.aha');
      const pack = command === 'example'
        ? await createExample(check(EngineSchema, arg(args, 0)))
        : await buildPack(await readJson(arg(args, 0)));
      await writePack(output, pack);
      return { status: 'validated', output: path.resolve(output), packHash: pack.manifest.contentHash, syntheticTemplate: command === 'example' };
    }
    case 'validate': {
      arity(args, 1);
      const pack = await readPack(arg(args, 0));
      return { status: 'validated', packHash: pack.manifest.contentHash, scenarios: pack.scenarios.length, semanticScope: 'registered-model-and-references-only' };
    }
    case 'research-check': {
      arity(args, 1);
      const pack = await buildPack(await readJson(arg(args, 0)));
      if (!pack.research) fail('RESEARCH_MISSING', 'A research ledger is required for this command.', '/research');
      return {
        status: 'validated', claims: pack.claims.length, findings: pack.research.findings.length,
        semanticScope: 'schema-and-claim-evidence-coverage-only',
        externalTruthVerified: false, sourceRetrievalPerformed: false, gaps: pack.research.gaps,
      };
    }
    case 'prepare-video':
    case 'video-plan-check': {
      arity(args, 2);
      const pack = await readPack(arg(args, 0));
      const plan = command === 'prepare-video'
        ? prepareVideoPlan(pack) : validateVideoPlan(pack, await readJson(arg(args, 1)));
      if (command === 'prepare-video') {
        extension(arg(args, 1), '.json');
        await assertOutsidePack(arg(args, 0), arg(args, 1));
        await writeNewFile(arg(args, 1), limitedJsonText(plan, arg(args, 1)));
      }
      return {
        status: 'awaiting-narration-review', planHash: await hashValue(plan),
        provider: 'edge-tts (community client for Microsoft online speech, not offline or Azure)',
        networkRequestPerformed: false, approvalRequiredFor: 'exact narration, voice, rate and timing policy',
        plan, truthReview: 'Host/user must verify sentences against linked Claims; this checker does not certify wording.',
      };
    }
    case 'synthesize': {
      arity(args, 6);
      if (args[3] !== '--approve' || args[5] !== '--allow-network') fail('TTS_NETWORK_PERMISSION', 'Expected --approve <current-plan-hash> --allow-network after explicit narration review.');
      const pack = await readPack(arg(args, 0));
      const plan = await approvePlan(pack, await readJson(arg(args, 1)), arg(args, 4));
      await assertOutsidePack(arg(args, 0), arg(args, 2));
      const audio = await synthesize(plan, arg(args, 2), true, fileURLToPath(new URL('../assets/media/edge_speech.py', import.meta.url)));
      return { status: 'audio-ready', output: path.resolve(arg(args, 2)), ...audio, durationSeconds: audio.segments.reduce((sum, item) => sum + item.frames, 0) / 30 };
    }
    case 'import-audio': {
      arity(args, 6);
      if (args[4] !== '--approve') fail('NARRATION_APPROVAL_REQUIRED', 'Expected --approve <current-plan-hash>.');
      const pack = await readPack(arg(args, 0));
      const plan = await approvePlan(pack, await readJson(arg(args, 1)), arg(args, 5));
      await assertOutsidePack(arg(args, 0), arg(args, 3));
      const audio = await importAudio(plan, await readJson(arg(args, 2)), path.dirname(path.resolve(arg(args, 2))), arg(args, 3));
      return { status: 'audio-ready', output: path.resolve(arg(args, 3)), ...audio, narrationContentVerified: false };
    }
    case 'render-card':
    case 'render-image':
    case 'render-pptx': {
      arity(args, 2);
      const root = arg(args, 0);
      const output = arg(args, 1);
      extension(output, command === 'render-card' ? '.html' : command === 'render-image' ? '.png' : '.pptx');
      const pack = await readPack(root);
      await assertOutsidePack(root, output);
      let content: string | Uint8Array;
      if (command === 'render-pptx') content = await renderPptx(pack);
      else {
        const html = bindStaticPack(renderCardHtml(pack), pack);
        validateHtml(html, pack);
        if (command === 'render-card') content = html;
        else {
          const browser = await openBrowser();
          try { content = await captureHtml(html, '#aha-card', browser); }
          finally { await browser.close(); }
        }
      }
      const artifactHash = createHash('sha256').update(content).digest('hex');
      await writeNewFile(output, content);
      const receipt = await writeReceipt(root, {
        status: 'delivered', kind: command.slice(7), rendererVersion: VERSION,
        packHash: pack.manifest.contentHash, output: path.resolve(output), artifactHash,
        visualReview: 'not-performed-by-this-command',
      });
      return { status: 'delivered', output: path.resolve(output), packHash: pack.manifest.contentHash, artifactHash, receipt };
    }
    case 'run': {
      arity(args, 2);
      const pack = await readPack(arg(args, 0));
      const trace = pack.traces.find(item => item.scenarioId === arg(args, 1));
      if (!trace) fail('SCENARIO_UNKNOWN', 'Scenario does not exist.', '/scenarioId');
      return { status: 'ok', trace };
    }
    case 'render-lab':
    case 'render-slides': {
      arity(args, 2);
      const root = arg(args, 0);
      const output = arg(args, 1);
      extension(output, '.html');
      const pack = await readPack(root);
      await assertOutsidePack(root, output);
      const kind = command === 'render-lab' ? 'lab' : 'slides';
      const html = renderHtml(pack, kind, await assets());
      validateHtml(html, pack);
      const artifactHash = createHash('sha256').update(html, 'utf8').digest('hex');
      await writeNewFile(output, html);
      const receipt = await writeReceipt(root, {
        status: 'delivered', kind, rendererVersion: VERSION,
        packHash: pack.manifest.contentHash, narrativeVersion: pack.narrative.version,
        output: path.resolve(output), artifactHash,
        checks: ['pack-schema', 'references', 'registered-model-replay', 'embedded-pack', 'html-size', 'no-remote-dependency-tags'],
        visualReview: 'not-performed-by-this-command',
      });
      return { status: 'delivered', output: path.resolve(output), packHash: pack.manifest.contentHash, artifactHash, receipt };
    }
    case 'export-exploration': {
      arity(args, 2, 12);
      const pack = await readPack(arg(args, 0));
      const output = arg(args, 1);
      extension(output, '.json');
      await assertOutsidePack(arg(args, 0), output);
      const ids = args.length > 2 ? args.slice(2) : pack.scenarios.map(scenario => scenario.id);
      if (ids.length > 10 || new Set(ids).size !== ids.length) {
        fail('EXPLORATION_SELECTION', 'Select 1 to 10 unique scenario IDs.');
      }
      const cases = ids.map(id => {
        const scenario = pack.scenarios.find(item => item.id === id);
        const trace = pack.traces.find(item => item.scenarioId === id);
        if (!scenario || !trace) fail('SCENARIO_UNKNOWN', `Unknown scenario ${id}.`);
        return { scenario, trace, note: '' };
      });
      const exploration = await createExploration(pack, cases);
      await writeNewFile(output, limitedJsonText(exploration, output));
      return { status: 'delivered', output: path.resolve(output), packHash: exploration.packHash, cases: ids };
    }
    case 'import-exploration': {
      arity(args, 3);
      const original = await readPack(arg(args, 0));
      const exploration = await readJson(arg(args, 1));
      const output = arg(args, 2);
      extension(output, '.aha');
      await assertOutsidePack(arg(args, 0), output);
      const next = await importExploration(original, exploration);
      await writePack(output, next, exploration);
      return { status: 'validated', output: path.resolve(output), parentHash: original.manifest.contentHash, packHash: next.manifest.contentHash, revision: next.manifest.revision };
    }
    case 'render-video': {
      arity(args, 6);
      if (args[4] !== '--approve') fail('NARRATION_APPROVAL_REQUIRED', 'Expected --approve <current-plan-hash>.');
      extension(arg(args, 3), '.mp4');
      const pack = await readPack(arg(args, 0));
      const plan = await approvePlan(pack, await readJson(arg(args, 1)), arg(args, 5));
      await assertOutsidePack(arg(args, 0), arg(args, 3));
      return renderVideo(pack, plan, arg(args, 2), arg(args, 3));
    }
    default:
      return fail('COMMAND_UNKNOWN', `Unknown command ${command}. Run help for syntax.`);
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
