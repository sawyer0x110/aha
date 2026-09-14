import type { Evidence, Narrative, Pack, TeachingVisual } from '../core/schema.js';

export type LearningPage = Narrative['slides'][number];

export function teachingVisual(pack: Pack, page?: LearningPage): TeachingVisual | undefined {
  return page ? page.visual : pack.brief.explanation?.visual;
}

export function readerConditions(pack: Pack, page?: LearningPage): string[] {
  const conditions = pack.brief.explanation?.conditions
    ?? (pack.modelSpec.engine === 'evidence' ? [] : pack.modelSpec.assumptions);
  return [...new Set([...conditions, ...(page?.conditions ?? [])])];
}

export function readerSources(pack: Pack, page?: LearningPage): Evidence[] {
  const claims = new Set(page
    ? [...page.claimIds, ...(page.visual?.claimIds ?? [])]
    : [...pack.claims.map(claim => claim.id), ...(pack.brief.explanation?.visual?.claimIds ?? [])]);
  const ids = new Set([
    ...pack.modelSpec.evidenceIds,
    ...pack.claims.filter(claim => claims.has(claim.id)).flatMap(claim => claim.evidenceIds),
  ]);
  if (page?.scenarioId) {
    const scenario = pack.scenarios.find(item => item.id === page.scenarioId);
    if (scenario && 'evidenceIds' in scenario.input) scenario.input.evidenceIds.forEach(id => ids.add(id));
  }
  return pack.evidence.filter(source => ids.has(source.id));
}

export function sourceLabel(source: Evidence): string {
  return source.title;
}
