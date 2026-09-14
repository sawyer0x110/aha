import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { AhaError } from '../src/core/errors.js';
import { buildDossier, createResearchDraft, readDossier, validateDossier, writeDossier } from '../src/research/dossier.js';
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
