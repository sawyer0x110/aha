import assert from 'node:assert/strict';
import test from 'node:test';
import { createDraft, createExample } from '../src/core/examples.js';
import { buildPack } from '../src/core/pack.js';
import type { Teaching } from '../src/core/schema.js';
import { renderCardHtml, renderSceneHtml } from '../src/renderers/card.js';
import { renderHtml, type RenderAssets } from '../src/renderers/html.js';
import { teachingSceneMarkup, teachingStateMarkup } from '../src/renderers/teaching-html.js';
import { createTeachingDraft } from './helpers/teaching.js';

const assets: RenderAssets = { labJs: '', slidesJs: '', revealJs: '', revealCss: '' };
const visible = (html: string) => html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, ' ');

function syntheticTeaching(): Teaching {
  return {
    title: '副本会跟着原稿变吗？', objective: '区分一次复制和持续同步。', misconception: '复制意味着持续同步。',
    basis: { kind: 'source-example', note: '原创示意，不是真实软件运行记录。', evidenceIds: ['source-a'] },
    entities: [{ id: 'draft', label: '原稿', description: '可以继续编辑。' }, { id: 'copy', label: '副本', description: '上次复制留下的内容。' }],
    states: [
      { id: 'initial', label: '复制之前', values: [{ entityId: 'draft', label: '第一版', content: '标题\n内容 A' }, { entityId: 'copy', label: '尚未复制', content: '' }] },
      { id: 'copied', label: '第一次复制后', values: [{ entityId: 'draft', label: '第一版', content: '标题\n内容 A' }, { entityId: 'copy', label: '第一版', content: '标题\n内容 A' }] },
      { id: 'edited', label: '只编辑原稿后', values: [{ entityId: 'draft', label: '第二版', content: '标题\n内容 B' }, { entityId: 'copy', label: '冻结在第一版', content: '标题\n内容 A' }] },
    ],
    transitions: [
      { id: 'copy-once', from: 'initial', to: 'copied', targetEntityId: 'copy', copyFromEntityId: 'draft', action: '复制一次', command: 'copy draft', explanation: '这次复制读取当时的原稿，原稿不变。', predictionId: 'predict-copy', claimIds: ['claim-a'] },
      { id: 'edit-only', from: 'copied', to: 'edited', targetEntityId: 'draft', action: '只编辑原稿', explanation: '没有再复制，所以副本保持第一版。', predictionId: 'predict-edit', claimIds: ['claim-a'] },
    ],
    checks: [
      { id: 'predict-copy', kind: 'prediction', question: '复制一次会改变哪里？', choices: [{ id: 'right', text: '副本变为 A', feedback: '原稿的 A 被写入副本。' }, { id: 'wrong', text: '原稿被清空', feedback: '复制不是移动，原稿仍在。' }], correctChoiceId: 'right', claimIds: ['claim-a'] },
      { id: 'predict-edit', kind: 'prediction', question: '只编辑原稿后，副本呢？', choices: [{ id: 'right', text: '仍为 A', feedback: '还没有第二次复制。' }, { id: 'wrong', text: '同步变 B', feedback: '一次复制没有建立同步关系。' }], correctChoiceId: 'right', claimIds: ['claim-a'] },
      { id: 'transfer', kind: 'transfer', question: '复制 A，改 B，再复制，再改 C，副本是什么？', choices: [{ id: 'right', text: 'B', feedback: '最近一次复制发生在 B。' }, { id: 'wrong', text: 'C', feedback: '后来的 C 没有被复制。' }], correctChoiceId: 'right', claimIds: ['claim-a'] },
    ],
    card: { headline: '一次复制，不是持续同步', summary: '看清谁变了，谁保持原样。', transitionIds: ['copy-once', 'edit-only'], takeaway: '副本保留最近一次复制的内容。', claimIds: ['claim-a'] },
  };
}

async function teachingPack() {
  const draft = createDraft('evidence');
  draft.teaching = syntheticTeaching();
  draft.narrative.slides = [
    { id: 'hook', title: '先看内容', body: '预测下一步。', notes: '先不要给出答案。', claimIds: ['claim-a'], scene: { kind: 'hook', transitionId: 'copy-once', statePhase: 'before' } },
    { id: 'operation', title: '发生了什么', body: '对比两边。', notes: '副本接收内容。', claimIds: ['claim-a'], scene: { kind: 'transition', transitionId: 'copy-once' } },
    { id: 'mechanism', title: '一次读取，一次写入', body: '箭头只代表当前操作。', notes: '没有持续同步。', claimIds: ['claim-a'], scene: { kind: 'mechanism', transitionId: 'copy-once' } },
    { id: 'transfer', title: '换一个序列', body: '独立判断。', notes: '解释最近一次复制。', claimIds: ['claim-a'], scene: { kind: 'transfer', checkId: 'transfer' } },
    { id: 'takeaway', title: '带走一个规则', body: '回顾。', notes: '寻找最后一次复制。', claimIds: ['claim-a'], scene: { kind: 'takeaway' } },
  ];
  return buildPack(draft);
}

test('teaching Lab presents initial content before prediction and preserves a complete no-JS record', async () => {
  const pack = await teachingPack();
  const html = renderHtml(pack, 'lab', assets);
  assert.ok(html.indexOf('data-teaching-state="initial"') < html.indexOf('data-check-id="predict-copy"'));
  assert.ok(html.indexOf('data-check-id="predict-copy"') < html.indexOf('<div data-teaching-result>'));
  assert.match(html, /data-teaching-answer><summary>阅读答案与原因/);
  assert.match(html, /data-teaching-feedback role="status" aria-live="polite"/);
  assert.match(html, /data-teaching-transfer/);
  assert.match(html, /data-teaching-restart disabled/);
  assert.match(html, /只回放保存状态，不执行命令或修改文件/);
  assert.doesNotMatch(html, /id="lesson-selector"|id="overview"/);
  assert.doesNotMatch(visible(html), new RegExp(pack.teaching!.misconception));
  for (const id of ['reading-sources', 'evidence-selector', 'evidence-note', 'evidence-export']) assert.match(html, new RegExp(`id="${id}"`));
  assert.doesNotMatch(visible(html), new RegExp(pack.manifest.contentHash));
  assert.doesNotMatch(visible(html), new RegExp(pack.brief.audience));
});

test('entity order stays stable and diffs highlight only changed lines, with frozen content intact', () => {
  const teaching = syntheticTeaching();
  const html = teachingStateMarkup(teaching, teaching.states[2]!, 'edit-only');
  assert.ok(html.indexOf('data-entity-id="draft"') < html.indexOf('data-entity-id="copy"'));
  assert.match(html, /data-entity-id="draft" data-changed="true"/);
  assert.match(html, /data-entity-id="copy" data-changed="false"/);
  assert.equal((html.match(/data-changed-line/g) ?? []).length, 1);
  assert.match(html, /保持原样/);
  assert.match(html, /冻结在第一版/);
  assert.match(html, /内容 A/);
  assert.match(html, /内容 B/);
});

test('teaching image is a connected content argument, not a question/answer or glossary dump', async () => {
  const pack = await teachingPack();
  const html = renderCardHtml(pack);
  assert.match(html, /id="aha-card" class="teaching-card"/);
  assert.match(html, /class="teaching-timeline"/);
  assert.match(html, /class="entity-connector"/);
  assert.match(html, /copy draft/);
  assert.match(html, /内容 B/);
  assert.match(html, /冻结在第一版/);
  assert.doesNotMatch(visible(html), /复制一次会改变哪里|复制 A，改 B|因果|成人初学者/);
  assert.match(html, /data-copy-from="draft" data-copy-to="copy"/);
});

test('story scene kinds have distinct visual structures with an independent transfer check', async () => {
  const pack = await teachingPack();
  const html = renderHtml(pack, 'slides', assets);
  for (const kind of ['hook', 'transition', 'mechanism', 'transfer', 'takeaway']) {
    assert.match(html, new RegExp(`data-scene-kind="${kind}"`));
    assert.match(html, new RegExp(`class="scene-${kind}"`));
    assert.match(renderSceneHtml(pack, kind === 'transition' ? 'operation' : kind, '当前讲解'), /id="aha-scene"/);
  }
  assert.match(html, /class="mechanism-flow"/);
  assert.match(html, /data-teaching="check"/);
  assert.match(html, /后来的 C 没有被复制/);
});

test('all authored teaching strings remain inert across HTML, card and capture scene', async () => {
  const pack = await teachingPack();
  const hostile = '</script><img src=x onerror="globalThis.pwned=1"><svg onload=alert(1)>';
  const teaching = pack.teaching!;
  teaching.title = hostile;
  teaching.card.headline = hostile;
  teaching.entities[0]!.label = hostile;
  teaching.states[0]!.values[0]!.content = hostile;
  teaching.transitions[0]!.command = hostile;
  teaching.checks[0]!.choices[0]!.feedback = hostile;
  for (const html of [renderHtml(pack, 'lab', assets), renderHtml(pack, 'slides', assets), renderCardHtml(pack), renderSceneHtml(pack, 'hook', hostile)]) {
    assert.doesNotMatch(html, /<img src=x|<svg onload|<script>globalThis/);
    assert.match(html, /&lt;img src=x/);
    assert.doesNotMatch(html, /<script[^>]* src=|<link[^>]* href=/);
  }
});

test('legacy numerical and evidence paths still render without teaching controls', async () => {
  for (const engine of ['retry', 'compound', 'evidence'] as const) {
    const pack = await createExample(engine);
    const html = renderHtml(pack, 'lab', assets);
    assert.doesNotMatch(html, /data-teaching="lab"/);
    assert.match(html, engine === 'evidence' ? /id="lesson-selector"/ : /id="a-run"/);
    assert.match(html, /id="pack-context"/);
    assert.match(renderCardHtml(pack), /id="aha-card"/);
  }
});

test('teaching card rejects excess content rows instead of clipping a plausible-looking image', async () => {
  const pack = await teachingPack();
  pack.teaching!.states[0]!.values[0]!.content = 'row\n'.repeat(50);
  assert.throws(() => renderCardHtml(pack), { code: 'CARD_CONTENT_LIMIT' });
});

test('the concise scope appears once per medium, not on every teaching scene', async () => {
  const pack = await teachingPack();
  pack.brief.explanation!.conditions = ['仅讨论完整复制，不讨论同步服务。'];
  for (const html of [renderHtml(pack, 'lab', assets), renderHtml(pack, 'slides', assets), renderCardHtml(pack)]) {
    assert.equal((visible(html).match(/仅讨论完整复制，不讨论同步服务。/g) ?? []).length, 1);
  }
  for (const slide of pack.narrative.slides) {
    const html = renderSceneHtml(pack, slide.id, '当前讲解');
    assert.equal((visible(html).match(/仅讨论完整复制，不讨论同步服务。/g) ?? []).length, slide.scene?.kind === 'takeaway' ? 1 : 0);
  }
});

test('neutral three-entity content is preserved in HTML and rejected explicitly when over the image budget', async () => {
  const pack = await teachingPack();
  const teaching = pack.teaching!;
  const content = '123456789\n'.repeat(30);
  assert.equal(content.length, 300);
  teaching.entities.push({ id: 'archive', label: '独立存档', description: '这两步都不修改存档。' });
  for (const state of teaching.states) state.values.push({ entityId: 'archive', label: '原有记录', content });
  const html = renderHtml(pack, 'lab', assets);
  assert.match(html, /data-entity-count="3"/);
  assert.match(html, /data-entity-id="archive" data-changed="false"/);
  assert.doesNotMatch(visible(html), /git add|Git|暂存区/);
  const embedded = html.match(/<script id="aha-pack" type="application\/json">([\s\S]*?)<\/script>/)![1]!;
  assert.equal(JSON.parse(embedded).teaching.states[0].values[2].content, content);
  assert.equal((teachingStateMarkup(teaching, teaching.states[0]!).match(/123456789/g) ?? []).length, 30);
  assert.throws(() => renderCardHtml(pack), { code: 'CARD_CONTENT_LIMIT' });
});

test('after-state hooks, rule outcomes and answer scenes use their explicit references', async () => {
  const pack = await teachingPack();
  const teaching = pack.teaching!;
  const hook = { ...pack.narrative.slides[0]!, scene: { kind: 'hook' as const, transitionId: 'edit-only', statePhase: 'after' as const } };
  const hookHtml = teachingSceneMarkup(pack, hook);
  assert.match(hookHtml, /data-teaching-state="edited"/);
  assert.match(hookHtml, /内容 B/);
  assert.doesNotMatch(hookHtml, /接下来：只编辑原稿/);
  const beforeHook = teachingSceneMarkup(pack, { ...hook, scene: { ...hook.scene, statePhase: 'before' } });
  assert.match(beforeHook, /data-teaching-state="copied"/);
  assert.doesNotMatch(beforeHook, /data-teaching-state="edited"|内容 B/);
  assert.match(beforeHook, /接下来：只编辑原稿/);
  teaching.outcome = {
    fromStateId: 'edited', sourceEntityId: 'copy', action: '发布副本', label: '读者收到的内容',
    explanation: '发布读取副本，而不是正在编辑的原稿。', basis: 'rule-application', claimIds: ['claim-a'],
  };
  const outcome = teachingSceneMarkup(pack, { ...hook, scene: { kind: 'outcome' } });
  assert.match(outcome, /读者收到的内容/);
  assert.match(outcome, /内容 A/);
  const output = outcome.match(/class="outcome-copy">([\s\S]*?)<\/article>/)![1]!;
  assert.doesNotMatch(output, /内容 B/);
  assert.match(outcome, /如果此刻执行/);
  assert.match(outcome, /hypothetical-arrow/);
  assert.doesNotMatch(outcome, /依据规则推演|不是新执行记录|rule-application/);
  const answer = teachingSceneMarkup(pack, { ...hook, scene: { kind: 'answer', checkId: 'transfer' } });
  assert.match(answer, /最近一次复制发生在 B/);
  assert.match(answer, /后来的 C 没有被复制/);
  assert.doesNotMatch(answer, /data-choice-id|data-teaching="check"/);
});

test('Lab, card and scene snippets preserve authored text without manufactured diff prefixes', async () => {
  const pack = await teachingPack();
  for (const state of pack.teaching!.states) {
    for (const value of state.values) {
      if (value.content) value.content = value.content.includes('内容 B')
        ? 'title\n  revised\n+authored plus\n'
        : 'title\n  original\n+authored plus\n';
    }
  }
  const contents = new Set(pack.teaching!.states.flatMap(state => state.values.map(value => value.content)));
  for (const html of [
    renderHtml(pack, 'lab', assets), renderCardHtml(pack),
    ...pack.narrative.slides.map(slide => renderSceneHtml(pack, slide.id, '当前讲解')),
  ]) {
    for (const match of html.matchAll(/<pre class="teaching-code"><code>([\s\S]*?)<\/code><\/pre>/g)) {
      const text = match[1]!.replace(/<\/?span\b[^>]*>/g, '');
      assert.ok(contents.has(text), `Snippet text differs from its authored content: ${JSON.stringify(text)}`);
    }
    assert.doesNotMatch(html, /class="line-mark"/);
  }
});

test('shared synthetic sequence renders identical complete content in Lab, card and every story scene', async () => {
  const pack = await buildPack(createTeachingDraft());
  const contents = new Set(pack.teaching!.states.flatMap(state => state.values.map(value => value.content)));
  for (const html of [
    renderHtml(pack, 'lab', assets), renderCardHtml(pack),
    ...pack.narrative.slides.map(slide => renderSceneHtml(pack, slide.id, slide.body)),
  ]) {
    const snippets = [...html.matchAll(/<pre class="teaching-code"><code>([\s\S]*?)<\/code><\/pre>/g)];
    for (const snippet of snippets) {
      assert.ok(contents.has(snippet[1]!.replace(/<\/?span\b[^>]*>/g, '')));
    }
    assert.doesNotMatch(html, /class="line-mark"/);
  }
  const markup = teachingStateMarkup(pack.teaching!, pack.teaching!.states[2]!, 'edit');
  assert.match(markup, /data-entity-id="editable-config" data-changed="true"/);
  assert.match(markup, /data-entity-id="selected-config" data-changed="false"/);
  assert.equal((markup.match(/data-changed-line/g) ?? []).length, 2);
});
