import { check } from './check.js';
import { runScenario } from './engine.js';
import { fail } from './errors.js';
import { canonicalize, hashValue } from './identity.js';
import { sealPack, validatePack } from './pack.js';
import { ExplorationSchema, type Pack, type Exploration, type Scenario, type Trace } from './schema.js';

function summary(items: string[], empty: string, label: string): string {
  const text = items.join('；');
  if (!text) return empty;
  if (text.length <= 4000) return text;
  return `${label}未全部展开；解读结果时，仍需满足所有适用条件，不能将未展开的条件当作不存在。`;
}

export async function createExploration(
  pack: Pack,
  cases: Array<{ scenario: Scenario; trace: Trace; note: string }>,
): Promise<Exploration> {
  await validatePack(pack);
  const exploration = check(ExplorationSchema, {
    schemaVersion: '0.1.0', packId: pack.manifest.packId,
    packHash: pack.manifest.contentHash, engineVersion: pack.modelSpec.version,
    cases: await Promise.all(cases.map(async item => ({
      ...structuredClone(item), traceHash: await hashValue(item.trace),
    }))),
  });
  await validateExploration(pack, exploration);
  return exploration;
}

export async function validateExploration(pack: Pack, data: unknown): Promise<Exploration> {
  const exploration = check(ExplorationSchema, data);
  if (exploration.packId !== pack.manifest.packId || exploration.packHash !== pack.manifest.contentHash) {
    fail('EXPLORATION_PACK_MISMATCH', 'Load the exact original Pack revision before importing.', '/packHash');
  }
  if (exploration.engineVersion !== pack.modelSpec.version) {
    fail('ENGINE_VERSION', 'Exploration engine version does not match.', '/engineVersion');
  }
  const ids = new Set<string>();
  for (const [index, item] of exploration.cases.entries()) {
    if (ids.has(item.scenario.id)) fail('DUPLICATE_ID', 'Exploration case IDs must be unique.', `/cases/${index}/scenario/id`);
    ids.add(item.scenario.id);
    const expected = runScenario(pack.modelSpec, item.scenario);
    if (canonicalize(item.trace) !== canonicalize(expected)
      || item.traceHash !== await hashValue(item.trace)) {
      fail('EXPLORATION_TRACE_MISMATCH', 'Exploration trace differs from its inputs or identity.', `/cases/${index}/trace`);
    }
    for (const id of item.scenario.claimIds) {
      if (!pack.claims.some(claim => claim.id === id)) {
        fail('REFERENCE_UNKNOWN', `Unknown claim ${id}.`, `/cases/${index}/scenario/claimIds`);
      }
    }
    if ('evidenceIds' in item.scenario.input) {
      for (const id of item.scenario.input.evidenceIds) {
        if (!pack.evidence.some(evidence => evidence.id === id)) {
          fail('REFERENCE_UNKNOWN', `Unknown evidence ${id}.`, `/cases/${index}/scenario/input/evidenceIds`);
        }
      }
    }
  }
  return exploration;
}

export async function importExploration(pack: Pack, data: unknown): Promise<Pack> {
  await validatePack(pack);
  const exploration = await validateExploration(pack, data);
  if (pack.modelSpec.engine !== 'evidence' && exploration.cases.length > 4) {
    fail('STORY_CASE_LIMIT', 'This 5-8 slide template supports up to four selected cases. Export a smaller selection; no cases were silently omitted.', '/cases');
  }
  const next = structuredClone(pack);
  next.manifest.parentHash = pack.manifest.contentHash;
  next.manifest.revision++;
  const imported: Scenario[] = [];
  exploration.cases.forEach((item, index) => {
    let id = `exploration-${next.manifest.revision}-${index + 1}`;
    let suffix = 1;
    while (next.scenarios.some(scenario => scenario.id === id)) {
      id = `exploration-${next.manifest.revision}-${index + 1}-${suffix++}`;
    }
    const scenario = { ...structuredClone(item.scenario), id };
    next.scenarios.push(scenario);
    next.traces.push({ ...structuredClone(item.trace), scenarioId: id });
    imported.push(scenario);
  });
  if (next.scenarios.length > 20) {
    fail('SCENARIO_LIMIT', 'Import would exceed 20 scenarios; start a focused Pack instead.', '/scenarios');
  }
  if (pack.modelSpec.engine === 'evidence') {
    next.narrative.version++;
    return sealPack(next);
  }
  const caseSlides = imported.map((scenario, index) => ({
    id: `case-${index + 1}`, title: scenario.title,
    body: '比较输入条件，再看结果如何变化。',
    notes: '', claimIds: scenario.claimIds, scenarioId: scenario.id,
  }));
  // Notes stay in the retained exploration file, never become factual narration.
  next.narrative = {
    version: pack.narrative.version + 1,
    slides: [
      { id: 'question', title: next.brief.question, body: summary(next.brief.scope, '本次围绕这个聚焦问题展开。', '适用范围'), notes: '', claimIds: [] },
      { id: 'model', title: '适用规则与假设', body: summary(next.modelSpec.assumptions, '当前未额外列出假设；仍须遵守内置引擎的输入域。', '规则与假设'), notes: '', claimIds: [] },
      ...caseSlides,
      { id: 'limits', title: '边界与未解决问题', body: summary(next.brief.exclusions, '仅在明确的输入域和假设内解释。', '排除项'), notes: '', claimIds: next.claims.filter(claim => claim.type === 'unresolved').map(claim => claim.id) },
      { id: 'sources', title: '想一想', body: next.brief.explanation?.checkQuestion ?? next.brief.question, notes: '', claimIds: next.claims.map(claim => claim.id) },
    ],
  };
  return sealPack(next);
}
