import { fail } from '../core/errors.js';
import { openBrowser } from '../media/browser.js';
import { ffmpeg, ffprobe, pythonRuntime, runTool } from '../media/process.js';

const REQUIREMENTS = {
  research: [], html: [], pptx: [],
  browser: ['browser'], image: ['browser'],
  video: ['browser', 'ffmpeg', 'ffprobe'],
  speech: ['ffmpeg', 'ffprobe', 'edgeTts'],
} as const;
export type DoctorTarget = keyof typeof REQUIREMENTS;
export type Probe = 'browser' | 'ffmpeg' | 'ffprobe' | 'edgeTts';

export function doctorRequirements(target?: string, media = false): readonly Probe[] {
  if (target !== undefined && media) fail('USAGE', 'Choose --for or --media, not both.');
  if (media) return ['browser', 'ffmpeg', 'ffprobe', 'edgeTts'];
  if (target === undefined) return [];
  if (!Object.hasOwn(REQUIREMENTS, target)) {
    fail('USAGE', 'Doctor --for accepts research, html, browser, image, pptx, video or speech.');
  }
  return REQUIREMENTS[target as DoctorTarget];
}

export async function probeRequirements(requirements: readonly Probe[], probes: Record<Probe, () => Promise<unknown>>): Promise<Partial<Record<Probe, string>>> {
  const readiness: Partial<Record<Probe, string>> = {};
  await Promise.all(requirements.map(async name => {
    try { await probes[name](); readiness[name] = 'ready'; }
    catch (error) {
      if (!(error instanceof Error)) throw error;
      readiness[name] = `unavailable: ${error.message}`;
    }
  }));
  return readiness;
}

export async function inspectDependencies(requirements: readonly Probe[]) {
  const selectedPython = requirements.includes('edgeTts') ? pythonRuntime() : undefined;
  const readiness = await probeRequirements(requirements, {
    browser: async () => { const browser = await openBrowser(); await browser.close(); },
    ffmpeg: () => runTool(ffmpeg(), ['-version']),
    ffprobe: () => runTool(ffprobe(), ['-version']),
    edgeTts: () => {
      if (!selectedPython) fail('DOCTOR_SCOPE', 'Speech runtime was not selected.');
      return runTool(selectedPython.executable, ['-c', 'import edge_tts; assert edge_tts.__version__ == "7.2.8", "Expected edge-tts==7.2.8"; print(edge_tts.__version__)']);
    },
  });
  return { readiness, selectedPython };
}
