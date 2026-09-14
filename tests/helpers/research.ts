import { createResearchDraft } from '../../src/research/dossier.js';
import type { ResearchDraft } from '../../src/research/schema.js';

export function researchFixture(): ResearchDraft {
  return {
    ...createResearchDraft('When does the synthetic memo schedule its fictional review?', 'provided'),
    id: 'synthetic-memo-research',
    title: 'Synthetic provided-material research fixture',
    status: 'complete',
    report: '# Synthetic memo review\n\nThis is fictional test material, not a real event.\n\nThe synthetic memo schedules its fictional review for Monday. [c1]\n\nSource: provided synthetic memo, paragraph 1 [e1]. A schedule does not establish that a review happened.\n',
    claims: [{
      id: 'c1',
      text: 'In this synthetic example, the memo schedules the fictional review for Monday.',
      evidenceIds: ['e1'],
      limitations: ['Fictional test material only; a schedule does not establish completion.'],
    }],
    evidence: [{
      id: 'e1',
      kind: 'provided',
      title: 'Synthetic memo supplied by the test fixture',
      locator: 'Embedded synthetic memo, paragraph 1',
      summary: 'The fictional review is scheduled for Monday.',
      sourceVersion: 'Synthetic fixture revision 1',
      content: 'Synthetic test memo: the fictional review is scheduled for Monday.',
    }],
    subquestions: [{
      id: 'q1',
      question: 'When is the fictional review scheduled?',
      status: 'answered',
      claimIds: ['c1'],
      gapIds: [],
    }],
    stopReason: 'The provided fictional memo answers the scoped test question. No external research or execution was performed.',
  };
}
