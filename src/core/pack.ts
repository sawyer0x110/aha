import { check } from './check.js';
import { runScenario } from './engine.js';
import { fail } from './errors.js';
import { canonicalize, hashValue } from './identity.js';
import { DraftSchema, PackSchema, type Draft, type Pack } from './schema.js';
import { validateResearch } from './research.js';
import { validateTeaching } from './teaching.js';

function uniqueIds(items: ReadonlyArray<{ id: string }>, path: string): Set<string> {
  const ids = new Set<string>();
  items.forEach((item, index) => {
    if (ids.has(item.id)) fail('DUPLICATE_ID', `Duplicate ID ${item.id}.`, `${path}/${index}/id`);
    ids.add(item.id);
  });
  return ids;
}

export function validateReferences(pack: Pack): void {
  const evidenceIds = uniqueIds(pack.evidence, '/evidence');
  const claimIds = uniqueIds(pack.claims, '/claims');
  const scenarioIds = uniqueIds(pack.scenarios, '/scenarios');
  uniqueIds(pack.narrative.slides, '/narrative/slides');
  const requireRefs = (refs: string[], known: Set<string>, path: string): void => {
    refs.forEach((id, index) => {
      if (!known.has(id)) fail('REFERENCE_UNKNOWN', `Unknown reference ${id}.`, `${path}/${index}`);
    });
  };
  if (pack.modelSpec.evidenceIds.length === 0) {
    fail('EVIDENCE_MISSING', 'The model or evidence route requires an explicit basis.', '/modelSpec/evidenceIds');
  }
  requireRefs(pack.modelSpec.evidenceIds, evidenceIds, '/modelSpec/evidenceIds');
  if (pack.brief.explanation?.visual) {
    requireRefs(pack.brief.explanation.visual.claimIds, claimIds, '/brief/explanation/visual/claimIds');
  }
  pack.claims.forEach((claim, index) => {
    if (claim.type !== 'unresolved' && claim.evidenceIds.length === 0) {
      fail('EVIDENCE_MISSING', 'A resolved claim must reference its basis.', `/claims/${index}/evidenceIds`);
    }
    if (claim.type === 'observation') {
      fail('MODE_UNSUPPORTED', 'Imported real observations are not supported in this release.', `/claims/${index}/type`);
    }
    if (claim.type === 'model-result' && pack.modelSpec.engine === 'evidence') {
      fail('CLAIM_MODE', 'Evidence browsing cannot establish a computed model result.', `/claims/${index}/type`);
    }
    requireRefs(claim.evidenceIds, evidenceIds, `/claims/${index}/evidenceIds`);
  });
  pack.evidence.forEach((evidence, index) => {
    if (evidence.kind === 'code' && !evidence.contentHash) {
      fail('SOURCE_IDENTITY', 'Code evidence requires a relevant-content SHA-256 in addition to its version.', `/evidence/${index}/contentHash`);
    }
    if (evidence.url) {
      if (!URL.canParse(evidence.url)) fail('SOURCE_URL', 'Invalid evidence URL.', `/evidence/${index}/url`);
      const url = new URL(evidence.url);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
        fail('SOURCE_URL', 'Evidence links must be HTTP(S) without embedded credentials.', `/evidence/${index}/url`);
      }
    }
  });
  pack.scenarios.forEach((scenario, index) => {
    requireRefs(scenario.claimIds, claimIds, `/scenarios/${index}/claimIds`);
    if ('evidenceIds' in scenario.input) {
      requireRefs(scenario.input.evidenceIds, evidenceIds, `/scenarios/${index}/input/evidenceIds`);
    }
  });
  if (pack.traces.length !== pack.scenarios.length) {
    fail('TRACE_COUNT', 'Every scenario needs exactly one trace.', '/traces');
  }
  const traced = new Set<string>();
  pack.traces.forEach((trace, index) => {
    if (traced.has(trace.scenarioId) || !scenarioIds.has(trace.scenarioId)) {
      fail('TRACE_REFERENCE', 'Unknown or duplicate trace scenario.', `/traces/${index}/scenarioId`);
    }
    traced.add(trace.scenarioId);
  });
  pack.narrative.slides.forEach((slide, index) => {
    requireRefs(slide.claimIds, claimIds, `/narrative/slides/${index}/claimIds`);
    if (slide.visual) requireRefs(slide.visual.claimIds, claimIds, `/narrative/slides/${index}/visual/claimIds`);
    if (slide.eventStep !== undefined && slide.scenarioId === undefined) {
      fail('NARRATIVE_REFERENCE', 'An event step requires a scenario.', `/narrative/slides/${index}/eventStep`);
    }
    if (slide.scenarioId !== undefined) {
      if (!scenarioIds.has(slide.scenarioId)) {
        fail('REFERENCE_UNKNOWN', `Unknown scenario ${slide.scenarioId}.`, `/narrative/slides/${index}/scenarioId`);
      }
      const trace = pack.traces.find(item => item.scenarioId === slide.scenarioId);
      if (!trace || (slide.eventStep !== undefined && slide.eventStep > trace.events.length)) {
        fail('NARRATIVE_REFERENCE', 'Event step is outside the referenced scenario.', `/narrative/slides/${index}/eventStep`);
      }
    }
  });
  if (pack.manifest.revision > 1 && !pack.manifest.parentHash) {
    fail('PARENT_REQUIRED', 'A revised pack must identify its parent snapshot.', '/manifest/parentHash');
  }
  if (pack.research) validateResearch(pack.research, pack.claims, pack.evidence);
  validateTeaching(pack);
}

export async function packHash(pack: Pack): Promise<string> {
  const { contentHash: _contentHash, ...manifest } = pack.manifest;
  return hashValue({ ...pack, manifest });
}

export async function sealPack(pack: Pack): Promise<Pack> {
  const sealed = structuredClone(pack);
  sealed.manifest.contentHash = await packHash(sealed);
  return validatePack(sealed);
}

export async function validatePack(data: unknown): Promise<Pack> {
  const pack = check(PackSchema, data);
  validateReferences(pack);
  if (pack.manifest.contentHash !== await packHash(pack)) {
    fail('PACK_HASH_MISMATCH', 'Pack contents differ from their recorded identity; rebuild a new revision.', '/manifest/contentHash');
  }
  pack.scenarios.forEach((scenario, index) => {
    const actual = pack.traces.find(trace => trace.scenarioId === scenario.id);
    const expected = runScenario(pack.modelSpec, scenario);
    if (canonicalize(actual) !== canonicalize(expected)) {
      fail('TRACE_MISMATCH', 'Trace does not match the registered model and inputs.', `/scenarios/${index}`);
    }
  });
  return pack;
}

export async function buildPack(data: unknown): Promise<Pack> {
  const draft: Draft = check(DraftSchema, data);
  return sealPack({
    manifest: {
      schemaVersion: draft.schemaVersion, packId: draft.packId, revision: 1,
      visibility: draft.visibility, contentHash: '0'.repeat(64),
    },
    brief: structuredClone(draft.brief), claims: structuredClone(draft.claims),
    evidence: structuredClone(draft.evidence), modelSpec: structuredClone(draft.modelSpec),
    scenarios: structuredClone(draft.scenarios),
    traces: draft.scenarios.map(scenario => runScenario(draft.modelSpec, scenario)),
    narrative: structuredClone(draft.narrative),
    ...(draft.research ? { research: structuredClone(draft.research) } : {}),
    ...(draft.teaching ? { teaching: structuredClone(draft.teaching) } : {}),
  });
}
