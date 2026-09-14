import { fail } from './errors.js';
import type { Claim, Evidence, Research } from './schema.js';

export function validateResearch(research: Research, claims: Claim[], evidence: Evidence[]): void {
  const seen = new Set<string>();
  for (const [index, finding] of research.findings.entries()) {
    const location = `/research/findings/${index}`;
    const claim = claims.find(item => item.id === finding.claimId);
    if (!claim || seen.has(finding.claimId)) {
      fail('RESEARCH_CLAIM', 'Research findings require unique existing Claim IDs.', `${location}/claimId`);
    }
    seen.add(finding.claimId);
    if (claim.type === 'unresolved' && finding.assessment === 'supported') {
      fail('RESEARCH_ASSESSMENT', 'An unresolved claim cannot be labeled supported.', `${location}/assessment`);
    }
    if (finding.assessment === 'supported' && finding.evidenceIds.length === 0) {
      fail('RESEARCH_EVIDENCE', 'Support requires cited material, not a model assertion.', `${location}/evidenceIds`);
    }
    for (const id of finding.evidenceIds) {
      if (!claim.evidenceIds.includes(id) || !evidence.some(item => item.id === id)) {
        fail('RESEARCH_REFERENCE', `Evidence ${id} is not attached to this Claim.`, `${location}/evidenceIds`);
      }
    }
    if (claim.evidenceIds.some(id => !finding.evidenceIds.includes(id))) {
      fail('RESEARCH_REFERENCE', 'Finding must retain every Claim evidence reference, including counterevidence.', `${location}/evidenceIds`);
    }
    if (finding.assessment === 'contested' && (claim.limitations.length === 0 || finding.evidenceIds.length < 2)) {
      fail('RESEARCH_CONFLICT', 'Contested findings need multiple cited materials and a visible claim limitation.', location);
    }
  }
  for (const claim of claims) {
    if (!seen.has(claim.id)) fail('RESEARCH_COVERAGE', `Research ledger is missing Claim ${claim.id}.`, '/research/findings');
  }
  if (research.kind === 'public' || research.kind === 'mixed') {
    for (const [index, source] of evidence.entries()) {
      if (source.kind !== 'web') continue;
      if (!source.url || !source.retrievedAt || !Number.isFinite(Date.parse(source.retrievedAt))) {
        fail('RESEARCH_WEB_LOCATOR', 'Web evidence requires an actual URL and valid retrieval timestamp.', `/evidence/${index}`);
      }
    }
  }
}
