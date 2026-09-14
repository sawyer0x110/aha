import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createDraft } from '../src/core/examples.js';
import { buildPack, validatePack } from '../src/core/pack.js';
import { AhaError } from '../src/core/errors.js';
import { readPack, writePack } from '../src/cli/files.js';

const code = (expected: string) => (error: unknown): boolean => error instanceof AhaError && error.code === expected;
function researchDraft() {
  const draft = createDraft('compound');
  draft.brief.explanation = {
    takeaway: '现金流参与后，同一组收益率的先后顺序可能改变期末余额。',
    glossary: [{ term: '现金流', meaning: '某一期额外投入或取出的金额。' }],
    analogy: { text: '先加水再搅拌与先搅拌再加水。', limitations: '只是顺序提示，不代表金融风险或真实物理模型。' },
    checkQuestion: '没有中途现金流时，交换收益率顺序还会改变期末余额吗？',
  };
  draft.research = {
    question: draft.brief.question, kind: 'provided',
    queries: [{ query: 'Inspect the synthetic model rule and deterministic examples.', purpose: 'Check model-derived claims, not external financial advice.' }],
    findings: draft.claims.map(claim => ({
      claimId: claim.id, evidenceIds: [...claim.evidenceIds],
      assessment: claim.type === 'unresolved' ? 'unresolved' : 'supported',
      rationale: 'Synthetic test ledger; does not represent a web search.',
    })),
    gaps: ['No external sources were retrieved.'], stopReason: 'Bounded fixture coverage complete.',
  };
  return { ...draft, research: draft.research };
}

test('optional research and explanation roundtrip with hash identity; old packs remain valid', async () => {
  const legacy = createDraft('compound');
  delete legacy.brief.explanation;
  const old = await buildPack(legacy);
  assert.equal((await validatePack(old)).manifest.contentHash, old.manifest.contentHash);
  const pack = await buildPack(researchDraft());
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aha-research-'));
  try {
    const output = path.join(dir, 'research.aha');
    await writePack(output, pack);
    assert.deepEqual(await readPack(output), pack);
    assert.ok((await fs.readdir(output)).includes('research.json'));
    const changed = structuredClone(pack);
    changed.research!.stopReason = 'different investigation';
    await assert.rejects(validatePack(changed), code('PACK_HASH_MISMATCH'));
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('research requires unique full claim coverage and preserves counterevidence', async () => {
  const draft = researchDraft();
  draft.research.findings.pop();
  await assert.rejects(buildPack(draft), code('RESEARCH_COVERAGE'));
  const duplicate = researchDraft();
  duplicate.research.findings.push(duplicate.research.findings[0]!);
  await assert.rejects(buildPack(duplicate), code('RESEARCH_CLAIM'));
  const missing = researchDraft();
  missing.research.findings[0]!.evidenceIds = [];
  await assert.rejects(buildPack(missing), code('RESEARCH_EVIDENCE'));
  const unknown = researchDraft();
  unknown.research.findings[0]!.evidenceIds.push('not-a-source');
  await assert.rejects(buildPack(unknown), code('RESEARCH_REFERENCE'));
});

test('contested statements need visible limits and multiple sources; public URLs need retrieval time', async () => {
  const contested = researchDraft();
  contested.research.findings[0]!.assessment = 'contested';
  await assert.rejects(buildPack(contested), code('RESEARCH_CONFLICT'));
  const web = researchDraft();
  web.research.kind = 'public';
  web.evidence[0]!.kind = 'web';
  web.evidence[0]!.url = 'https://example.com/source';
  await assert.rejects(buildPack(web), code('RESEARCH_WEB_LOCATOR'));
  web.evidence[0]!.retrievedAt = 'not-a-date';
  await assert.rejects(buildPack(web), code('RESEARCH_WEB_LOCATOR'));
  web.evidence[0]!.retrievedAt = '2026-09-11T00:00:00Z';
  assert.ok((await buildPack(web)).research);
});
