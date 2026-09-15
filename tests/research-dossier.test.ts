import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { AhaError } from '../src/core/errors.js';
import { buildDossier, checkResearchDraft, createResearchDraft, readDossier, validateDossier, writeDossier } from '../src/research/dossier.js';
import { MAX_DOCUMENT_BYTES, checkSize } from '../src/research/io.js';
import type { ResearchDraft } from '../src/research/schema.js';
import { researchFixture } from './helpers/research.js';

function authored(): ResearchDraft {
  return {
    ...createResearchDraft('What does the supplied memo establish?'),
    id: 'memo-study',
    title: 'Memo review',
    status: 'complete',
    report: '# Memo review\n\nThe supplied memo schedules the review for Monday. [c1]\n\nThis is a plan, not proof the review happened.\n',
    claims: [{ id: 'c1', text: 'The memo schedules a Monday review.', evidenceIds: ['e1'], limitations: ['A schedule does not prove completion.'] }],
    evidence: [{ id: 'e1', kind: 'provided', title: 'Supplied memo', locator: 'User message, paragraph 2', summary: 'Review is scheduled for Monday.', sourceVersion: 'User-supplied revision 1' }],
    subquestions: [{ id: 'q1', question: 'When is the review planned?', status: 'answered', claimIds: ['c1'], gapIds: [] }],
    stopReason: 'The supplied material answers the scoped question; no external research was requested.',
  };
}

function errorCode(code: string): (error: unknown) => boolean {
  return error => error instanceof AhaError && error.code === code;
}

async function workspace(run: (root: string) => Promise<void>): Promise<void> {
  const root = path.join(process.cwd(), `.research-test-${randomUUID()}`);
  await fs.mkdir(root);
  try {
    await run(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

test('shared synthetic provided-material fixture seals without networking or fake research logs', async () => {
  const dossier = await buildDossier(researchFixture());
  assert.equal(dossier.research.kind, 'provided');
  assert.equal(dossier.research.researchLog.length, 0);
  assert.match(dossier.research.report, /fictional test material/i);
  assert.deepEqual(await validateDossier(dossier), dossier);
});

test('model-free authored provided research builds, writes, reads and remains independent of input mutation', async () => {
  await workspace(async root => {
    const draft = authored();
    const building = buildDossier(draft);
    draft.title = 'Mutated after sealing started';
    const dossier = await building;
    assert.equal(dossier.research.title, 'Memo review');
    assert.equal(dossier.research.researchLog.length, 0);
    assert.equal(dossier.manifest.schemaVersion, '1.0.0');
    assert.equal(dossier.manifest.researchId, dossier.research.id);
    assert.match(dossier.manifest.contentHash, /^[a-f0-9]{64}$/);
    assert.equal('modelSpec' in dossier.research, false);
    const output = path.join(root, 'nested', 'memo');
    await writeDossier(output, dossier);
    assert.deepEqual((await fs.readdir(output)).sort(), ['manifest.json', 'report.md', 'research.json']);
    assert.deepEqual(await readDossier(output), dossier);
    assert.equal(await fs.readFile(path.join(output, 'report.md'), 'utf8'), dossier.research.report);
  });
});

test('canonical research hash ignores object key ordering, but not authored content', async () => {
  const draft = authored();
  const reversed = Object.fromEntries(Object.entries(draft).reverse());
  assert.equal((await buildDossier(draft)).manifest.contentHash, (await buildDossier(reversed)).manifest.contentHash);
  const dossier = await buildDossier(draft);
  dossier.research.title = 'Changed title';
  await assert.rejects(validateDossier(dossier), errorCode('CONTENT_HASH'));
});

test('scaffold cannot seal unchanged or with only title/report/status edits', async () => {
  const draft = createResearchDraft('An open question', 'public');
  assert.equal(draft.status, 'draft');
  await assert.rejects(buildDossier(draft), errorCode('RESEARCH_INCOMPLETE'));
  draft.title = 'A polished title';
  draft.report = '# A polished title\n\n## Sources\n\n## Conclusion\n';
  draft.status = 'complete';
  draft.stopReason = 'Report headings written.';
  await assert.rejects(buildDossier(draft), errorCode('RESEARCH_INCOMPLETE'));
});

test('draft structural check accepts a scaffold but never certifies or seals it', async () => {
  const draft = createResearchDraft('An open question', 'public');
  const before = structuredClone(draft);
  const result = checkResearchDraft(draft);
  assert.equal(result.status, 'draft-checked');
  assert.equal(result.ready, false);
  assert.deepEqual(result.pending.map(issue => issue.code), ['RESEARCH_INCOMPLETE', 'COVERAGE_INVALID']);
  assert.equal(result.pending[1]!.location, '/subquestions/q1');
  assert.match(result.verification, /Only normal check\/build/);
  assert.equal('manifest' in result, false);
  assert.equal('contentHash' in result, false);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  assert.deepEqual(draft, before);
  await assert.rejects(buildDossier(draft), errorCode('RESEARCH_INCOMPLETE'));
  const finished = checkResearchDraft(authored());
  assert.deepEqual(finished.pending, []);
  assert.equal(finished.ready, false);
});

test('incremental support, reverse coverage and gaps are pending only while unfilled', async () => {
  const draft = authored();
  draft.claims[0]!.subquestionIds = ['q1'];
  draft.claims[0]!.evidenceIds = [];
  draft.evidence = [];
  draft.subquestions[0]!.claimIds = [];
  let result = checkResearchDraft(draft);
  assert.ok(result.pending.some(issue => issue.code === 'CLAIM_UNSUPPORTED'));
  assert.ok(result.pending.some(issue => issue.code === 'COVERAGE_INVALID'));
  await assert.rejects(buildDossier(draft), errorCode('COVERAGE_INVALID'));
  draft.subquestions[0]!.claimIds = ['c1'];
  await assert.rejects(buildDossier(draft), errorCode('CLAIM_UNSUPPORTED'));
  draft.claims[0]!.kind = 'unresolved';
  draft.claims[0]!.limitations = [];
  draft.subquestions[0]!.status = 'unresolved';
  result = checkResearchDraft(draft);
  assert.ok(result.pending.some(issue => issue.code === 'UNRESOLVED_INVALID'));
  draft.subquestions[0]!.gapIds = ['g1'];
  draft.gaps.push({ id: 'g1', description: 'No original memo.', subquestionIds: [] });
  assert.ok(checkResearchDraft(draft).pending.some(issue => issue.location === '/gaps/g1'));
  draft.gaps[0]!.subquestionIds = ['q1'];
  draft.subquestions[0]!.gapIds = [];
  assert.ok(checkResearchDraft(draft).pending.some(issue => issue.location === '/gaps/g1'));
  draft.subquestions[0]!.gapIds = ['g1'];
  draft.claims[0]!.limitations = ['No original memo.'];
  assert.deepEqual(checkResearchDraft(draft).pending, []);
  await buildDossier(draft);
});

test('draft checks reject contradictory explicit reverse links and unresolved answers', () => {
  const claim = authored();
  claim.claims.push({ ...claim.claims[0]!, id: 'c2', subquestionIds: ['q1'] });
  assert.throws(() => checkResearchDraft(claim), errorCode('COVERAGE_INVALID'));
  const gap = authored();
  gap.subquestions.push({ id: 'q2', question: 'Another question?', status: 'unresolved', claimIds: [], gapIds: [] });
  gap.subquestions[0]!.gapIds = ['g1'];
  gap.gaps.push({ id: 'g1', description: 'Missing detail.', subquestionIds: ['q2'] });
  assert.throws(() => checkResearchDraft(gap), errorCode('COVERAGE_INVALID'));
  gap.gaps[0]!.subquestionIds = ['q1'];
  gap.gaps.push({ id: 'g2', description: 'Another detail.', subquestionIds: ['q1'] });
  assert.throws(() => checkResearchDraft(gap), errorCode('COVERAGE_INVALID'));
  const unresolved = authored();
  unresolved.claims[0]!.kind = 'unresolved';
  assert.throws(() => checkResearchDraft(unresolved), errorCode('UNRESOLVED_INVALID'));
});

test('optional claim reverse links must exactly match primary coverage when supplied', async () => {
  const draft = authored();
  draft.subquestions.push({ id: 'q2', question: 'Another supported question?', status: 'answered', claimIds: ['c1'], gapIds: [] });
  delete draft.claims[0]!.subquestionIds;
  assert.deepEqual(checkResearchDraft(draft).pending, []);
  await buildDossier(draft);
  draft.claims[0]!.subquestionIds = ['q2', 'q1'];
  assert.deepEqual(checkResearchDraft(draft).pending, []);
  await buildDossier(draft);
  for (const reverse of [[], ['q1'], ['q2']]) {
    const incomplete = structuredClone(draft);
    incomplete.claims[0]!.subquestionIds = reverse;
    assert.throws(() => checkResearchDraft(incomplete), errorCode('COVERAGE_INVALID'));
    await assert.rejects(buildDossier(incomplete), errorCode('COVERAGE_INVALID'));
  }
});

test('unfinished drafts still reject unknown references, duplicate IDs and malformed schema', () => {
  const mutations: [string, (draft: ResearchDraft) => void][] = [
    ['REFERENCE_INVALID', draft => { draft.claims[0]!.evidenceIds = ['missing']; }],
    ['REFERENCE_INVALID', draft => { draft.claims[0]!.subquestionIds = ['missing']; }],
    ['REFERENCE_INVALID', draft => { draft.subquestions[0]!.claimIds = ['missing']; }],
    ['REFERENCE_INVALID', draft => { draft.subquestions[0]!.gapIds = ['missing']; }],
    ['REFERENCE_INVALID', draft => { draft.gaps.push({ id: 'g1', description: 'Unknown', subquestionIds: ['missing'] }); }],
    ['REFERENCE_INVALID', draft => { draft.researchLog[0]!.evidenceIds = ['missing']; }],
    ['REFERENCE_INVALID', draft => { draft.researchLog[0]!.subquestionIds = ['missing']; }],
    ['DUPLICATE_ID', draft => { draft.evidence.push({ ...draft.evidence[0]! }); }],
    ['DUPLICATE_ID', draft => { draft.evidence[0]!.id = draft.id; }],
    ['DUPLICATE_ID', draft => { draft.evidence[0]!.id = 'c1'; }],
    ['SCHEMA_INVALID', draft => { draft.claims[0]!.evidenceIds.push('e1'); }],
  ];
  for (const [code, mutate] of mutations) {
    const draft = webDraft();
    draft.status = 'draft';
    draft.report = '';
    draft.stopReason = '';
    mutate(draft);
    assert.throws(() => checkResearchDraft(draft), errorCode(code));
  }
  for (const patch of [{ claims: null }, { status: 'pending' }, { report: 42 }, { evidence: [{}] }, { extra: true }]) {
    assert.throws(() => checkResearchDraft({ ...createResearchDraft('Question'), ...patch }), errorCode('SCHEMA_INVALID'));
  }
  for (const patch of [{ schemaVersion: '0.1.0' }, { modelSpec: {} }]) {
    assert.throws(() => checkResearchDraft({ ...authored(), ...patch }), errorCode('UNSUPPORTED_SCHEMA'));
  }
});

test('drafts distinguish missing reads from malformed asserted logs, metadata and hashes', async () => {
  const draft = webDraft();
  draft.researchLog = [];
  assert.deepEqual(checkResearchDraft(draft).pending.map(issue => issue.code), ['SOURCE_UNREAD']);
  await assert.rejects(buildDossier(draft), errorCode('SOURCE_UNREAD'));
  const mutations: [string, (draft: ResearchDraft) => void][] = [
    ['SOURCE_URL', draft => { draft.evidence[0]!.url = 'file:///memo'; }],
    ['SOURCE_URL', draft => { draft.evidence[0]!.url = 'https://user:password@example.org/memo'; }],
    ['SOURCE_DATE', draft => { draft.evidence[0]!.retrievedAt = '2026-02-30T12:00:00Z'; }],
    ['SOURCE_DATE', draft => { draft.researchLog[0]!.occurredAt = 'yesterday'; }],
    ['SOURCE_METADATA', draft => { delete draft.evidence[0]!.retrievedAt; }],
    ['SOURCE_METADATA', draft => { draft.evidence[0]!.kind = 'code'; }],
    ['SOURCE_HASH', draft => { draft.evidence[0]!.content = 'changed'; draft.evidence[0]!.contentHash = 'a'.repeat(64); }],
    ['SCHEMA_INVALID', draft => { draft.evidence[0]!.contentHash = 'not-a-hash'; }],
    ['LOG_INVALID', draft => { delete draft.researchLog[0]!.readRange; }],
    ['LOG_INVALID', draft => { draft.researchLog[0]!.outcome = 'failure'; }],
    ['LOG_INVALID', draft => { draft.researchLog[0]!.evidenceIds = []; }],
  ];
  for (const [code, mutate] of mutations) {
    const input = webDraft();
    input.status = 'draft';
    mutate(input);
    const before = structuredClone(input);
    assert.throws(() => checkResearchDraft(input), errorCode(code));
    assert.deepEqual(input, before);
  }
  const frozen = webDraft();
  Object.freeze(frozen);
  Object.freeze(frozen.claims[0]!.evidenceIds);
  assert.deepEqual(checkResearchDraft(frozen).pending, []);
});

test('draft checks enforce UTF-8 and serialized document bounds and reject non-JSON snapshots', () => {
  const draft = createResearchDraft('Question');
  draft.report = '研'.repeat(1_500_000);
  assert.throws(() => checkResearchDraft(draft), errorCode('FILE_SIZE'));
  draft.report = '';
  draft.evidence = Array.from({ length: 5 }, (_, index) => ({
    id: `e${index}`, kind: 'provided', title: 'Large source', locator: 'Supplied text',
    summary: 'Large text', sourceVersion: '1', content: 'x'.repeat(900_000),
  }));
  assert.throws(() => checkResearchDraft(draft), errorCode('FILE_SIZE'));
  const cyclic = authored() as ResearchDraft & { cycle?: unknown };
  cyclic.cycle = cyclic;
  assert.throws(() => checkResearchDraft(cyclic), errorCode('JSON_DEPTH'));
});

test('invalid references in claims, questions, gaps and logs are rejected', async () => {
  const mutations: ((draft: ResearchDraft) => void)[] = [
    draft => { draft.claims[0]!.evidenceIds = ['missing']; },
    draft => { draft.claims[0]!.subquestionIds = ['missing']; },
    draft => { draft.subquestions[0]!.claimIds = ['missing']; },
    draft => { draft.subquestions[0]!.gapIds = ['missing']; },
    draft => { draft.gaps.push({ id: 'g1', description: 'Unknown boundary', subquestionIds: ['missing'] }); },
    draft => { draft.researchLog.push({ id: 'l1', action: 'search', outcome: 'success', query: 'memo', occurredAt: '2026-09-14T12:00:00Z', summary: 'Searched provided notes.', evidenceIds: ['missing'], subquestionIds: ['q1'] }); },
    draft => { draft.researchLog.push({ id: 'l1', action: 'search', outcome: 'success', query: 'memo', occurredAt: '2026-09-14T12:00:00Z', summary: 'Searched provided notes.', evidenceIds: [], subquestionIds: ['missing'] }); },
  ];
  for (const mutate of mutations) {
    const draft = authored();
    mutate(draft);
    await assert.rejects(buildDossier(draft), errorCode('REFERENCE_INVALID'));
  }
});

test('duplicate IDs, including cross-collection collisions and duplicate references, fail', async () => {
  const draft = authored();
  draft.evidence.push({ ...draft.evidence[0]! });
  await assert.rejects(buildDossier(draft), errorCode('DUPLICATE_ID'));
  const collision = authored();
  collision.evidence[0]!.id = 'c1';
  await assert.rejects(buildDossier(collision), errorCode('DUPLICATE_ID'));
  const duplicateRef = authored();
  duplicateRef.claims[0]!.evidenceIds.push('e1');
  await assert.rejects(buildDossier(duplicateRef), errorCode('SCHEMA_INVALID'));
});

test('unresolved exemption requires limitations, coverage and explicit gaps', async () => {
  const draft = authored();
  draft.evidence = [];
  draft.claims[0]!.evidenceIds = [];
  await assert.rejects(buildDossier(draft), errorCode('CLAIM_UNSUPPORTED'));
  draft.claims[0]!.kind = 'unresolved';
  await assert.rejects(buildDossier(draft), errorCode('UNRESOLVED_INVALID'));
  draft.subquestions[0]!.status = 'unresolved';
  draft.subquestions[0]!.gapIds = ['g1'];
  draft.gaps = [{ id: 'g1', description: 'The original memo cannot be accessed.', subquestionIds: ['q1'] }];
  draft.claims[0]!.text = 'The scheduled date cannot be established.';
  draft.claims[0]!.limitations = ['No accessible original memo.'];
  draft.report = 'The date remains unknown because the original memo cannot be accessed.';
  draft.stopReason = 'Stopped at the access boundary; obtain the original memo before answering.';
  await buildDossier(draft);
  draft.claims[0]!.limitations = [];
  await assert.rejects(buildDossier(draft), errorCode('UNRESOLVED_INVALID'));
});

test('independent subquestions must each declare support or an explicit gap', async () => {
  const draft = authored();
  draft.subquestions.push({ id: 'q2', question: 'Did the review happen?', status: 'unresolved', claimIds: [], gapIds: [] });
  await assert.rejects(buildDossier(draft), errorCode('COVERAGE_INVALID'));
  draft.subquestions[1]!.gapIds = ['g1'];
  draft.gaps.push({ id: 'g1', description: 'No completion record supplied.', subquestionIds: ['q2'] });
  await buildDossier(draft);
  draft.subquestions[1]!.status = 'answered';
  await assert.rejects(buildDossier(draft), errorCode('COVERAGE_INVALID'));
});

function webDraft(): ResearchDraft {
  const draft = authored();
  draft.kind = 'public';
  draft.evidence[0] = {
    ...draft.evidence[0]!, kind: 'web', url: 'https://example.org/memo', retrievedAt: '2026-09-14T12:00:00Z',
  };
  draft.researchLog = [{
    id: 'l1', action: 'read', outcome: 'success', occurredAt: '2026-09-14T12:00:00Z',
    locator: 'https://example.org/memo', readRange: 'Paragraph 2', summary: 'Read the scheduling paragraph.',
    evidenceIds: ['e1'], subquestionIds: ['q1'],
  }];
  return draft;
}

test('web evidence needs safe URL, actual retrieval date and successful reading, not just search logs', async () => {
  await buildDossier(webDraft());
  for (const invalid of ['javascript:alert(1)', 'file:///memo', 'https://user:password@example.org/memo', 'relative']) {
    const draft = webDraft();
    draft.evidence[0]!.url = invalid;
    await assert.rejects(buildDossier(draft), errorCode('SOURCE_URL'));
  }
  for (const invalid of ['2026-02-30T12:00:00Z', 'yesterday', '2026-09-14', '2026-09-14T24:00:00Z']) {
    const draft = webDraft();
    draft.evidence[0]!.retrievedAt = invalid;
    await assert.rejects(buildDossier(draft), errorCode('SOURCE_DATE'));
  }
  const missing = webDraft();
  delete missing.evidence[0]!.retrievedAt;
  await assert.rejects(buildDossier(missing), errorCode('SOURCE_METADATA'));
  const searchOnly = webDraft();
  searchOnly.researchLog[0]!.action = 'search';
  searchOnly.researchLog[0]!.query = 'memo review date';
  await assert.rejects(buildDossier(searchOnly), errorCode('SOURCE_UNREAD'));
});

test('failed operations never establish evidence; logs require real query/read-range fields', async () => {
  const draft = webDraft();
  draft.researchLog[0]!.outcome = 'failure';
  await assert.rejects(buildDossier(draft), errorCode('LOG_INVALID'));
  draft.researchLog[0]!.evidenceIds = [];
  await assert.rejects(buildDossier(draft), errorCode('SOURCE_UNREAD'));
  const noRange = webDraft();
  delete noRange.researchLog[0]!.readRange;
  await assert.rejects(buildDossier(noRange), errorCode('LOG_INVALID'));
  const provided = authored();
  provided.researchLog.push({
    id: 'l1', action: 'failure', outcome: 'failure', locator: 'Requested attachment not accessible',
    occurredAt: '2026-09-14T12:00:00Z', summary: 'The attachment could not be opened.',
    evidenceIds: [], subquestionIds: ['q1'],
  });
  await buildDossier(provided);
});

test('code evidence validates real captured bytes and fixed version without reading or executing locator', async () => {
  const draft = webDraft();
  draft.kind = 'codebase';
  const content = 'throw new Error("never execute research evidence");\n';
  const hash = createHash('sha256').update(content).digest('hex');
  draft.evidence[0] = {
    id: 'e1', kind: 'code', title: 'Read-only code', locator: 'src\\example.ts:1',
    summary: 'The code throws when run.', sourceVersion: 'a'.repeat(40), content, contentHash: hash,
  };
  await buildDossier(draft);
  draft.evidence[0]!.content = `${content}\n`;
  await assert.rejects(buildDossier(draft), errorCode('SOURCE_HASH'));
  draft.evidence[0]!.content = content;
  draft.evidence[0]!.sourceVersion = 'main';
  await assert.rejects(buildDossier(draft), errorCode('SOURCE_METADATA'));
  draft.evidence[0]!.sourceVersion = `dirty:${hash}`;
  delete draft.evidence[0]!.content;
  await assert.rejects(buildDossier(draft), errorCode('SOURCE_METADATA'));
});

test('legacy schemas and Pack directories are actionable unsupported errors and remain untouched', async () => {
  await assert.rejects(buildDossier({ ...authored(), schemaVersion: '0.1.0' }), errorCode('UNSUPPORTED_SCHEMA'));
  await assert.rejects(buildDossier({ ...authored(), modelSpec: {} }), errorCode('UNSUPPORTED_SCHEMA'));
  await assert.rejects(validateDossier({ manifest: { schemaVersion: '0.1.0' } }), errorCode('UNSUPPORTED_SCHEMA'));
  await workspace(async root => {
    const legacy = path.join(root, 'legacy');
    await fs.mkdir(legacy);
    await fs.writeFile(path.join(legacy, 'model-spec.json'), '{"legacy":true}');
    await assert.rejects(readDossier(legacy), error => errorCode('UNSUPPORTED_SCHEMA')(error) && /new 1.0.0/.test((error as Error).message));
    assert.equal(await fs.readFile(path.join(legacy, 'model-spec.json'), 'utf8'), '{"legacy":true}');
    const manifestOnly = path.join(root, 'manifest-only');
    await fs.mkdir(manifestOnly);
    await fs.writeFile(path.join(manifestOnly, 'manifest.json'), '{"schemaVersion":"0.1.0"}');
    await assert.rejects(readDossier(manifestOnly), errorCode('UNSUPPORTED_SCHEMA'));
  });
});

test('research, manifest identity and report tampering are rejected on read', async () => {
  await workspace(async root => {
    const dossier = await buildDossier(authored());
    const output = path.join(root, 'dossier');
    await writeDossier(output, dossier);
    const researchPath = path.join(output, 'research.json');
    const original = await fs.readFile(researchPath, 'utf8');
    await fs.writeFile(researchPath, original.replace('Memo review', 'Memo changed'));
    await assert.rejects(readDossier(output), errorCode('CONTENT_HASH'));
    await fs.writeFile(researchPath, original);
    const reportPath = path.join(output, 'report.md');
    await fs.appendFile(reportPath, '\n');
    await assert.rejects(readDossier(output), errorCode('REPORT_MISMATCH'));
    await fs.writeFile(reportPath, dossier.research.report);
    await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({ ...dossier.manifest, researchId: 'other' }));
    await assert.rejects(readDossier(output), errorCode('RESEARCH_ID'));
  });
});

test('writes do not overwrite existing destinations, including empty directories or concurrent writers', async () => {
  await workspace(async root => {
    const dossier = await buildDossier(authored());
    const output = path.join(root, 'dossier');
    const results = await Promise.allSettled([writeDossier(output, dossier), writeDossier(output, dossier)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.deepEqual(await readDossier(output), dossier);
    await assert.rejects(writeDossier(output, dossier), errorCode('OUTPUT_EXISTS'));
    const empty = path.join(root, 'empty');
    await fs.mkdir(empty);
    await assert.rejects(writeDossier(empty, dossier), errorCode('OUTPUT_EXISTS'));
    assert.deepEqual(await fs.readdir(empty), []);
  });
});

test('parent traversal, unexpected resources and missing files are rejected', async () => {
  await workspace(async root => {
    const dossier = await buildDossier(authored());
    const traversal = `${root}${path.sep}child${path.sep}..${path.sep}outside`;
    await assert.rejects(writeDossier(traversal, dossier), errorCode('PATH_INVALID'));
    await assert.rejects(readDossier(traversal), errorCode('PATH_INVALID'));
    const output = path.join(root, 'dossier');
    await writeDossier(output, dossier);
    await fs.writeFile(path.join(output, 'extra.js'), 'throw new Error("not executed")');
    await assert.rejects(readDossier(output), errorCode('DOSSIER_RESOURCE'));
    await fs.unlink(path.join(output, 'extra.js'));
    await fs.unlink(path.join(output, 'report.md'));
    await assert.rejects(readDossier(output), errorCode('FILE_MISSING'));
  });
});

test('directory links and linked ancestors are rejected for reads and writes', async () => {
  await workspace(async root => {
    const dossier = await buildDossier(authored());
    const real = path.join(root, 'real');
    const link = path.join(root, 'link');
    await fs.mkdir(real);
    await fs.symlink(real, link, process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(writeDossier(path.join(link, 'new'), dossier), errorCode('DIRECTORY_TYPE'));
    await writeDossier(path.join(real, 'dossier'), dossier);
    await assert.rejects(readDossier(path.join(link, 'dossier')), errorCode('DIRECTORY_TYPE'));
    await assert.rejects(readDossier(link), errorCode('DIRECTORY_TYPE'));
    assert.deepEqual(await fs.readdir(real), ['dossier']);
  });
});

test('linked file resources are rejected without following them', async t => {
  await workspace(async root => {
    const dossier = await buildDossier(authored());
    const output = path.join(root, 'dossier');
    await writeDossier(output, dossier);
    const external = path.join(root, 'external.md');
    await fs.writeFile(external, dossier.research.report);
    await fs.unlink(path.join(output, 'report.md'));
    try {
      await fs.symlink(external, path.join(output, 'report.md'), 'file');
    } catch (error) {
      if (process.platform === 'win32' && (error as NodeJS.ErrnoException).code === 'EPERM') {
        t.skip('Windows file symlinks require Developer Mode or symlink privilege; junction ancestor checks still run.');
        return;
      }
      throw error;
    }
    await assert.rejects(readDossier(output), errorCode('DOSSIER_RESOURCE'));
  });
});

test('bounded reads and writes reject oversized UTF-8 documents and total payloads', async () => {
  const oversized = authored();
  oversized.report = '研'.repeat(1_500_000);
  await assert.rejects(buildDossier(oversized), errorCode('FILE_SIZE'));
  assert.throws(() => checkSize(['x'.repeat(MAX_DOCUMENT_BYTES), 'x'.repeat(MAX_DOCUMENT_BYTES), 'x'.repeat(MAX_DOCUMENT_BYTES)], '/'), errorCode('DOSSIER_SIZE'));
  await workspace(async root => {
    const output = path.join(root, 'dossier');
    await writeDossier(output, await buildDossier(authored()));
    await fs.writeFile(path.join(output, 'report.md'), 'x'.repeat(MAX_DOCUMENT_BYTES + 1));
    await assert.rejects(readDossier(output), errorCode('FILE_SIZE'));
  });
});

test('invalid JSON, invalid UTF-8 and non-JSON inputs yield explicit Aha errors', async () => {
  const draft = authored() as ResearchDraft & { cycle?: unknown };
  draft.cycle = draft;
  await assert.rejects(buildDossier(draft), errorCode('JSON_DEPTH'));
  await workspace(async root => {
    const output = path.join(root, 'dossier');
    await writeDossier(output, await buildDossier(authored()));
    await fs.writeFile(path.join(output, 'research.json'), '{not json');
    await assert.rejects(readDossier(output), errorCode('JSON_SYNTAX'));
    await fs.writeFile(path.join(output, 'research.json'), Buffer.from([0xff]));
    await assert.rejects(readDossier(output), errorCode('FILE_ENCODING'));
  });
});
