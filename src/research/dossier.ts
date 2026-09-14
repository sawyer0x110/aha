import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { check } from '../core/check.js';
import { fail } from '../core/errors.js';
import { canonicalize, hashValue } from '../core/identity.js';
import { DossierSchema, ResearchDraftSchema, type Dossier, type ResearchDraft, type ResearchKind } from './schema.js';
import { boundedRead, checkSize, ioError, parseJson, safeDirectory, safePath } from './io.js';

/** Checks structure, declared coverage and snapshot identity, not truth or semantic support. */
export const VALIDATION_SCOPE = 'Structural references and content identity only; logs and support metadata are author declarations, not proof.';

export function createResearchDraft(question: string, kind: ResearchKind = 'provided'): ResearchDraft {
  return check(ResearchDraftSchema, {
    schemaVersion: '1.0.0',
    id: `research-${randomUUID()}`,
    title: question,
    question,
    kind,
    language: 'en',
    status: 'draft',
    report: '',
    claims: [],
    evidence: [],
    subquestions: [{ id: 'q1', question, status: 'unresolved', claimIds: [], gapIds: [] }],
    researchLog: [],
    gaps: [],
    stopReason: '',
  });
}

function supported(input: unknown, dossier: boolean): void {
  if (typeof input !== 'object' || input === null) return;
  const record = input as Record<string, unknown>;
  const version = dossier && typeof record.manifest === 'object' && record.manifest !== null
    ? (record.manifest as Record<string, unknown>).schemaVersion : record.schemaVersion;
  if ((version !== undefined && version !== '1.0.0')
    || ['modelSpec', 'scenarios', 'traces', 'narrative', 'brief', 'teaching'].some(key => key in record)) {
    fail('UNSUPPORTED_SCHEMA', 'Legacy Packs and older schemas are unsupported. Author a new 1.0.0 research draft; keep the original unchanged.');
  }
}

function date(value: string, location: string): void {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))
    || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59
    || new Date(`${match[1]}T00:00:00Z`).toISOString().slice(0, 10) !== match[1]) {
    fail('SOURCE_DATE', 'Expected a real RFC 3339 date and time with timezone.', location);
  }
}

function validateResearch(research: ResearchDraft): void {
  if (research.status !== 'complete' || !research.report.trim() || !research.stopReason.trim() || research.claims.length === 0) {
    fail('RESEARCH_INCOMPLETE', 'Author a report, claims, evidence/explicit unknowns, coverage and stop reason, then set status to complete.');
  }
  const globalIds = new Set<string>([research.id]);
  for (const [name, records] of [
    ['claims', research.claims], ['evidence', research.evidence], ['subquestions', research.subquestions],
    ['researchLog', research.researchLog], ['gaps', research.gaps],
  ] as const) {
    for (const record of records) {
      if (globalIds.has(record.id)) fail('DUPLICATE_ID', `Duplicate ID: ${record.id}.`, `/${name}`);
      globalIds.add(record.id);
    }
  }
  const evidence = new Map(research.evidence.map(item => [item.id, item]));
  const claims = new Map(research.claims.map(item => [item.id, item]));
  const questions = new Map(research.subquestions.map(item => [item.id, item]));
  const gaps = new Map(research.gaps.map(item => [item.id, item]));
  function refs(values: string[], target: ReadonlyMap<string, unknown>, location: string): void {
    for (const value of values) if (!target.has(value)) fail('REFERENCE_INVALID', `Unknown reference: ${value}.`, location);
  }
  for (const question of research.subquestions) {
    refs(question.claimIds, claims, `/subquestions/${question.id}/claimIds`);
    refs(question.gapIds, gaps, `/subquestions/${question.id}/gapIds`);
  }
  for (const gap of research.gaps) refs(gap.subquestionIds, questions, `/gaps/${gap.id}/subquestionIds`);
  for (const claim of research.claims) {
    refs(claim.evidenceIds, evidence, `/claims/${claim.id}/evidenceIds`);
    refs(claim.subquestionIds ?? [], questions, `/claims/${claim.id}/subquestionIds`);
    const coverage = research.subquestions.filter(question => question.claimIds.includes(claim.id));
    if (coverage.length === 0) fail('COVERAGE_INVALID', 'Every claim must belong to a subquestion.', `/claims/${claim.id}`);
    if (claim.subquestionIds?.some(id => !questions.get(id)?.claimIds.includes(claim.id))) {
      fail('COVERAGE_INVALID', 'Claim/subquestion references must agree.', `/claims/${claim.id}`);
    }
    if (claim.kind === 'unresolved') {
      if (!claim.limitations.length || coverage.some(question => question.status === 'answered' || !question.gapIds.length)) {
        fail('UNRESOLVED_INVALID', 'Unresolved claims need limitations and explicit gaps; they cannot answer a subquestion.', `/claims/${claim.id}`);
      }
    } else if (claim.evidenceIds.length === 0) {
      fail('CLAIM_UNSUPPORTED', 'A claim needs evidence, or must explicitly be unresolved with limitations and a gap.', `/claims/${claim.id}`);
    }
  }
  for (const question of research.subquestions) {
    if (question.status === 'answered' || question.status === 'partial') {
      if (!question.claimIds.some(id => claims.get(id)?.kind !== 'unresolved')) {
        fail('COVERAGE_INVALID', 'Answered or partial questions require supported claims.', `/subquestions/${question.id}`);
      }
    }
    if (question.status !== 'answered' && question.gapIds.length === 0) {
      fail('COVERAGE_INVALID', 'Unanswered, partial and out-of-scope questions require an explicit gap.', `/subquestions/${question.id}`);
    }
    if (question.gapIds.some(id => !gaps.get(id)?.subquestionIds.includes(question.id))) {
      fail('COVERAGE_INVALID', 'Gap/subquestion references must agree.', `/subquestions/${question.id}`);
    }
  }
  for (const gap of research.gaps) {
    if (!gap.subquestionIds.length || gap.subquestionIds.some(id => !questions.get(id)?.gapIds.includes(gap.id))) {
      fail('COVERAGE_INVALID', 'Every gap must be linked from its subquestions.', `/gaps/${gap.id}`);
    }
  }
  for (const log of research.researchLog) {
    refs(log.evidenceIds, evidence, `/researchLog/${log.id}/evidenceIds`);
    refs(log.subquestionIds, questions, `/researchLog/${log.id}/subquestionIds`);
    date(log.occurredAt, `/researchLog/${log.id}/occurredAt`);
    if (!log.subquestionIds.length || (log.action === 'search' && !log.query)
      || (log.action === 'read' && (!log.locator || !log.readRange))
      || (log.action === 'failure' && (log.outcome !== 'failure' || (!log.query && !log.locator)))
      || (log.action === 'read' && log.outcome === 'success' && !log.evidenceIds.length)
      || (log.outcome === 'failure' && log.evidenceIds.length > 0)) {
      fail('LOG_INVALID', 'Record actual query/read range or failed access; failed operations cannot establish evidence.', `/researchLog/${log.id}`);
    }
  }
  for (const source of research.evidence) {
    const location = `/evidence/${source.id}`;
    if (source.url !== undefined) {
      try {
        const url = new URL(source.url);
        if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error();
      } catch {
        fail('SOURCE_URL', 'Source URL must be an absolute HTTP(S) URL without credentials.', location);
      }
    }
    if (source.retrievedAt !== undefined) date(source.retrievedAt, location);
    if (source.kind === 'web' && (!source.url || !source.retrievedAt)) {
      fail('SOURCE_METADATA', 'Web evidence requires its source URL and actual retrieval date.', location);
    }
    if (source.kind === 'code' && (source.content === undefined || !source.contentHash
      || !/^(?:(?:commit:)?(?:[a-f0-9]{40}|[a-f0-9]{64})|dirty:[a-f0-9]{64}|diff:[a-f0-9]{40}\.\.[a-f0-9]{40})$/.test(source.sourceVersion))) {
      fail('SOURCE_METADATA', 'Code evidence requires inert content, its SHA-256, and a commit hash, dirty:<sha256>, or diff:<base>..<head> version.', location);
    }
    if (source.contentHash && source.content !== undefined
      && createHash('sha256').update(source.content, 'utf8').digest('hex') !== source.contentHash) {
      fail('SOURCE_HASH', 'Source content does not match its declared SHA-256.', location);
    }
    if (source.kind !== 'provided' && !research.researchLog.some(log =>
      log.action === 'read' && log.outcome === 'success' && log.evidenceIds.includes(source.id))) {
      fail('SOURCE_UNREAD', 'Web/code evidence needs an actual successful read record; search results alone do not establish reading.', location);
    }
  }
}

function documents(dossier: Dossier): Map<string, string> {
  const result = new Map([
    ['research.json', `${JSON.stringify(dossier.research, null, 2)}\n`],
    ['report.md', dossier.research.report],
    ['manifest.json', `${JSON.stringify(dossier.manifest, null, 2)}\n`],
  ]);
  checkSize(result.values(), '/');
  return result;
}

export async function buildDossier(input: unknown): Promise<Dossier> {
  supported(input, false);
  // Snapshot before awaiting hashing so callers cannot change the content being sealed.
  const research = check(ResearchDraftSchema, JSON.parse(canonicalize(input)));
  validateResearch(research);
  const dossier: Dossier = {
    manifest: { schemaVersion: '1.0.0', researchId: research.id, contentHash: await hashValue(research) },
    research,
  };
  documents(dossier);
  return dossier;
}

export async function validateDossier(input: unknown): Promise<Dossier> {
  supported(input, true);
  if (typeof input === 'object' && input !== null && 'research' in input) supported(input.research, false);
  const dossier = check(DossierSchema, JSON.parse(canonicalize(input)));
  validateResearch(dossier.research);
  if (dossier.manifest.researchId !== dossier.research.id) fail('RESEARCH_ID', 'Manifest and research IDs do not match.');
  if (dossier.manifest.contentHash !== await hashValue(dossier.research)) fail('CONTENT_HASH', 'Research content does not match the manifest hash.');
  documents(dossier);
  return dossier;
}

export async function readDossier(directory: string): Promise<Dossier> {
  const root = safePath(directory);
  try {
    await safeDirectory(root);
    const entries = await fs.readdir(root, { withFileTypes: true });
    const legacy = new Set(['brief.json', 'claims.json', 'evidence.json', 'model-spec.json', 'scenarios.json', 'narrative.json', 'traces', 'receipts', 'teaching.json']);
    if (entries.some(entry => legacy.has(entry.name))) {
      fail('UNSUPPORTED_SCHEMA', 'Legacy Pack directories are unsupported. Keep this directory unchanged and author a new 1.0.0 research dossier.', root);
    }
    const allowed = new Set(['research.json', 'report.md', 'manifest.json']);
    for (const entry of entries) {
      if (!allowed.has(entry.name) || !entry.isFile() || entry.isSymbolicLink()) {
        fail('DOSSIER_RESOURCE', `Unsupported dossier resource: ${entry.name}; only three regular dossier files are allowed.`, root);
      }
    }
    const manifestText = await boundedRead(path.join(root, 'manifest.json'));
    const manifest = parseJson(manifestText, 'manifest.json');
    supported({ manifest }, true);
    const researchText = await boundedRead(path.join(root, 'research.json'));
    const report = await boundedRead(path.join(root, 'report.md'));
    checkSize([manifestText, researchText, report], root);
    const dossier = await validateDossier({ manifest, research: parseJson(researchText, 'research.json') });
    if (report !== dossier.research.report) fail('REPORT_MISMATCH', 'report.md must exactly equal research.json report, including whitespace.', root);
    return dossier;
  } catch (error) {
    return ioError(error, root);
  }
}

export async function writeDossier(destination: string, input: Dossier): Promise<void> {
  const root = safePath(destination);
  const dossier = await validateDossier(input);
  const content = documents(dossier);
  try {
    await safeDirectory(path.dirname(root), true);
    await fs.mkdir(root);
    // Reserve the exact destination; never replace an existing directory or any file.
    for (const [name, text] of content) {
      await safeDirectory(root);
      await fs.writeFile(path.join(root, name), text, { flag: 'wx', encoding: 'utf8' });
    }
  } catch (error) {
    // Leave interrupted output visibly incomplete rather than risk deleting concurrent data.
    ioError(error, root);
  }
}
