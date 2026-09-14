import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { createDraft } from '../src/core/examples.js';
import { AhaError } from '../src/core/errors.js';
import { buildPack } from '../src/core/pack.js';
import type { Draft, Teaching } from '../src/core/schema.js';
import { renderPptx } from '../src/renderers/pptx.js';
import { createTeachingDraft } from './helpers/teaching.js';

function draft(): Draft {
  const value = createDraft('evidence');
  value.evidence[0]!.title = '最小复制实验';
  value.evidence[0]!.url = 'https://example.org/copy';
  value.evidence[1]!.title = '无关背景材料';
  value.brief.explanation!.conditions = ['本例只比较两个独立文本。'];
  const teaching: Teaching = {
    title: '一次复制不是持续连接', objective: '预测独立文本的变化', misconception: '内部误解标记',
    basis: { kind: 'source-example', note: '依据保留材料的教学示例。', evidenceIds: ['source-a'] },
    entities: [
      { id: 'draft', label: '草稿', description: '可以直接编辑的文本' },
      { id: 'copy', label: '副本', description: '上次复制保留的文本' },
    ],
    states: [
      { id: 'initial', label: '开始', values: [
        { entityId: 'draft', label: '初稿', content: 'name=oak\nsize=1' },
        { entityId: 'copy', label: '初稿', content: 'name=oak\nsize=1' },
      ] },
      { id: 'edited', label: '编辑后', values: [
        { entityId: 'draft', label: '新稿', content: 'name=oak\nsize=2' },
        { entityId: 'copy', label: '初稿', content: 'name=oak\nsize=1' },
      ] },
      { id: 'copied', label: '复制后', values: [
        { entityId: 'draft', label: '新稿', content: 'name=oak\nsize=2' },
        { entityId: 'copy', label: '新稿', content: 'name=oak\nsize=2' },
      ] },
    ],
    transitions: [
      { id: 'edit', from: 'initial', to: 'edited', targetEntityId: 'draft', action: '编辑草稿',
        command: 'size=2', explanation: '只有草稿改变，副本保留原来的内容。',
        predictionId: 'predict-edit', claimIds: ['claim-a'] },
      { id: 'copy-now', from: 'edited', to: 'copied', targetEntityId: 'copy', copyFromEntityId: 'draft',
        action: '复制当前草稿', command: 'copy draft', explanation: '复制取当前内容，之后修改草稿不会自动改副本。',
        predictionId: 'predict-copy', claimIds: ['claim-a'] },
    ],
    checks: [
      { id: 'predict-edit', kind: 'prediction', question: '改草稿之后，副本会跟着变吗？',
        choices: [
          { id: 'no', text: '副本保持原样', feedback: '独立文本不会自动改变。' },
          { id: 'yes', text: '副本自动变化', feedback: '这不是持续连接。' },
        ], correctChoiceId: 'no', claimIds: ['claim-a'] },
      { id: 'predict-copy', kind: 'prediction', question: '现在复制，副本得到哪个内容？',
        choices: [
          { id: 'new', text: '新稿', feedback: '取这一刻的草稿内容。' },
          { id: 'old', text: '初稿', feedback: '不是取历史内容。' },
        ], correctChoiceId: 'new', claimIds: ['claim-a'] },
      { id: 'transfer', kind: 'transfer', question: '复制后删掉草稿一行，副本呢？',
        choices: [
          { id: 'same', text: '保留完整文本', feedback: '副本没有收到新的复制操作。' },
          { id: 'delete', text: '也少一行', feedback: '后续编辑只作用于草稿。' },
        ], correctChoiceId: 'same', claimIds: ['claim-a'] },
    ],
    card: { headline: '先找操作，再找改变的对象', summary: '相同内容不代表两个对象持续连接。',
      transitionIds: ['edit', 'copy-now'], takeaway: '追踪每次操作的目标，不要猜自动联动。', claimIds: ['claim-a'] },
    outcome: { fromStateId: 'edited', sourceEntityId: 'copy', action: '生成结果', label: '规则结果',
      explanation: '按规则读取副本的内容；这里没有执行新操作。', basis: 'rule-application', claimIds: ['claim-a'] },
  };
  value.teaching = teaching;
  value.narrative.slides = [
    { id: 'puzzle', title: '为什么两个文本不一样？', body: '草稿已修改，副本会跟着变吗？', scene: { kind: 'hook', transitionId: 'edit', statePhase: 'after' } },
    { id: 'change', title: '只变一个对象', body: '逐行比较操作前后。', scene: { kind: 'transition', transitionId: 'edit' } },
    { id: 'mechanism', title: '复制只取这一刻', body: '箭头指向本次操作真正写入的目标。', scene: { kind: 'mechanism', transitionId: 'copy-now' } },
    { id: 'apply', title: '换个操作，再判断一次', body: '自己判断新的情况。', scene: { kind: 'transfer', checkId: 'transfer' } },
    { id: 'rule', title: '用一条线回顾', body: '两次操作，分别作用于不同对象。', scene: { kind: 'takeaway' } },
    { id: 'answer', title: '副本为什么保留完整文本？', body: '比较每个选项的理由。', scene: { kind: 'answer', checkId: 'transfer' } },
    { id: 'outcome', title: '规则会选择哪个文本？', body: '取副本，不是取最新草稿。', scene: { kind: 'outcome' } },
  ].map(page => ({ ...page, notes: '仅供作者的原始记录。', claimIds: ['claim-a'] })) as Draft['narrative']['slides'];
  value.narrative.slides[1]!.conditions = ['这里没有新的复制操作。'];
  return value;
}

async function xml(zip: JSZip, page: number, notes = false): Promise<string> {
  return zip.file(notes ? `ppt/notesSlides/notesSlide${page}.xml` : `ppt/slides/slide${page}.xml`)!.async('string');
}
function text(value: string): string {
  return [...value.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(match => match[1]!).join('\n');
}
function namedShape(value: string, name: string): string {
  const shape = [...value.matchAll(/<p:(?:sp|cxnSp)>[\s\S]*?<\/p:(?:sp|cxnSp)>/g)]
    .map(match => match[0]).find(shape => shape.includes(`name="Aha teaching ${name}"`));
  assert.ok(shape, `Missing native object ${name}`);
  return shape;
}
function namedBox(value: string, name: string) {
  const shape = namedShape(value, name);
  const off = shape.match(/<a:off x="(\d+)" y="(\d+)"\s*\/>/)!;
  const ext = shape.match(/<a:ext cx="(\d+)" cy="(\d+)"\s*\/>/)!;
  assert.ok(off && ext);
  return { x: +off[1]!, y: +off[2]!, w: +ext[1]!, h: +ext[2]! };
}
function assertGeometry(value: string): void {
  const boxes = [...value.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].flatMap(match => {
    const shape = match[0];
    const off = shape.match(/<a:off x="(-?\d+)" y="(-?\d+)"\s*\/>/);
    const ext = shape.match(/<a:ext cx="(-?\d+)" cy="(-?\d+)"\s*\/>/);
    if (!off || !ext) return [];
    const box = { x: +off[1]!, y: +off[2]!, w: +ext[1]!, h: +ext[2]!, text: text(shape) };
    assert.ok(box.x >= 0 && box.y >= 0 && box.w >= 0 && box.h >= 0);
    assert.ok(box.x + box.w <= 12192000 + 2);
    assert.ok(box.y + box.h <= 6858000 + 2);
    return box.text ? [box] : [];
  });
  boxes.forEach((a, index) => {
    boxes.slice(index + 1).forEach(b => {
      const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      assert.ok(w <= 2 || h <= 2, `Text overlap: ${a.text} / ${b.text}`);
    });
  });
}

test('native scenes preserve after-state hook, exact snippets, one-time copy, and separate answers', async () => {
  const pack = await buildPack(draft());
  const zip = await JSZip.loadAsync(await renderPptx(pack));
  const pages = await Promise.all([1, 2, 3, 4, 5, 6, 7].map(page => xml(zip, page)));
  pages.forEach(assertGeometry);
  const [hook, change, mechanism, transfer, takeaway, answer, outcome] = pages.map(text);
  assert.match(hook!, /草稿已修改/);
  assert.doesNotMatch(hook!, /改草稿之后|预测|proposed action/);
  assert.match(hook!, /size=1/);
  assert.match(hook!, /size=2/);
  assert.doesNotMatch(hook!, /独立文本不会自动改变|答案/);
  assert.doesNotMatch(pages[0]!, /name="Aha teaching target after/);
  assert.match(change!, /size=1/);
  assert.match(change!, /size=2/);
  assert.match(change!, /不变/);
  assert.match(pages[1]!, /name="Aha teaching diff margin 2"/);
  assert.doesNotMatch(pages[1]!, /name="Aha teaching diff margin 1"/);
  assert.doesNotMatch(pages.join(''), /<a:t>&gt;<\/a:t>|<a:t>›<\/a:t>/);
  assert.match(pages[1]!, /prstDash val="dash"/);
  assert.match(pages[1]!, /type="triangle"/);
  assert.match(pages[1]!, /typeface="Consolas"/);
  assert.match(mechanism!, /复制取当前内容/);
  assert.match(mechanism!, /保持不变/);
  assert.match(pages[2]!, /name="Aha teaching action arrow one time copy"/);
  assert.doesNotMatch(transfer!, /正确答案|理由|备注|副本没有收到/);
  assert.match(answer!, /正确答案：A/);
  for (const choice of pack.teaching!.checks[2]!.choices) {
    assert.ok(answer!.replaceAll('\n', '').includes(choice.feedback));
  }
  assert.match(outcome!, /如果此刻执行/);
  assert.doesNotMatch(outcome!, /规则推演|非执行记录|rule-application/);
  assert.match(outcome!, /size=1/);
  assert.match(outcome!, /size=2/);
  assert.match(takeaway!, /编辑草稿/);
  assert.match(takeaway!, /复制当前草稿/);
  assert.match(pages[4]!, /name="Aha teaching action arrow timeline 1"/);
  assert.doesNotMatch(pages.join(''), /<p:pic>|内部误解标记|仅供作者/);
  assert.match(await xml(zip, 3, true), /内部误解标记/);
  assert.match(await xml(zip, 3, true), /copyFromEntityId/);
});

test('teaching uses relevant slide sources and concise local conditions, retaining notes and hyperlinks', async () => {
  const zip = await JSZip.loadAsync(await renderPptx(await buildPack(draft())));
  for (let page = 1; page <= 5; page++) {
    const slide = await xml(zip, page);
    const words = text(slide);
    assert.match(words, /最小复制实验/);
    assert.doesNotMatch(words, /无关背景材料/);
    if (page === 1) assert.match(words, /本例只比较两个独立文本/);
    else assert.doesNotMatch(words, /本例只比较两个独立文本/);
    if (page === 2) assert.match(words, /这里没有新的复制操作/);
    const caption = slide.match(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*name="Aha source 1"[\s\S]*?<\/p:sp>/)?.[0];
    assert.ok(caption);
    assert.match(caption, /sz="1400"/);
    assert.match(caption, /<a:hlinkClick/);
    const rel = await zip.file(`ppt/slides/_rels/slide${page}.xml.rels`)!.async('string');
    assert.match(rel, /https:\/\/example.org\/copy/);
    const notes = await xml(zip, page, true);
    assert.match(notes, /无关背景材料/);
    assert.match(notes, /本例只比较两个独立文本/);
  }
});

test('scene count supports one through twelve without generating extra hidden answer slides', async () => {
  for (const count of [1, 12]) {
    const value = draft();
    const transfer = value.narrative.slides[3]!;
    value.narrative.slides = Array.from({ length: count }, (_, index) => ({ ...transfer, id: `check-${index}` }));
    const zip = await JSZip.loadAsync(await renderPptx(await buildPack(value)));
    assert.equal(Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length, count);
    assert.doesNotMatch(text(await xml(zip, count)), /正确答案|备注|副本没有收到/);
  }
});

test('third entity stays frozen and is not falsely connected to a copy operation', async () => {
  const value = draft();
  value.teaching!.entities.push({ id: 'archive', label: '档案', description: '第三个独立文本' });
  value.teaching!.states.forEach(state => {
    state.values.forEach(item => { item.content = item.content.split('\n')[1]!; });
    state.values.push({ entityId: 'archive', label: '旧稿', content: 'size=0' });
  });
  const zip = await JSZip.loadAsync(await renderPptx(await buildPack(value)));
  for (const page of [1, 2, 3]) assertGeometry(await xml(zip, page));
  assert.match(text(await xml(zip, 2)), /档案/);
  assert.match(text(await xml(zip, 2)), /size=0/);
  assert.match(text(await xml(zip, 3)), /保持不变/);
});

test('entity columns stay fixed and copy arrows join roles rather than before/after versions', async () => {
  for (const reverse of [false, true]) {
    const value = draft();
    if (reverse) value.teaching!.entities.reverse();
    const zip = await JSZip.loadAsync(await renderPptx(await buildPack(value)));
    const [hook, edit, copy] = await Promise.all([1, 2, 3].map(page => xml(zip, page)));
    const draftHook = namedBox(hook!, 'entity draft hook panel');
    const copyHook = namedBox(hook!, 'entity copy hook panel');
    const changed = namedBox(edit!, 'entity draft change panel');
    assert.equal(changed.x, draftHook.x);
    assert.equal(namedBox(copy!, 'entity draft copy panel').x, draftHook.x);
    assert.equal(namedBox(edit!, 'entity copy frozen panel').x, copyHook.x);
    assert.equal(namedBox(copy!, 'entity copy copy panel').x, copyHook.x);
    const within = namedBox(edit!, 'action arrow within changed entity');
    assert.ok(within.x > changed.x && within.x < changed.x + changed.w);
    assert.equal(within.w, 0);
    assert.ok(within.h > 0);
    for (const prefix of ['target before', 'target after']) {
      const content = namedBox(edit!, `${prefix} line 1`);
      assert.ok(content.x >= changed.x && content.x + content.w <= changed.x + changed.w);
    }
    const connector = namedBox(copy!, 'action arrow one time copy');
    const left = reverse ? copyHook : draftHook;
    const right = reverse ? draftHook : copyHook;
    assert.ok(connector.x > left.x + left.w && connector.x + connector.w < right.x);
    assert.equal(connector.h, 0);
    const arrow = namedShape(copy!, 'action arrow one time copy');
    assert.match(arrow, reverse ? /<a:headEnd type="triangle"/ : /<a:tailEnd type="triangle"/);
  }
});

test('hook state phase is explicit and outcome content comes from the selected existing entity', async () => {
  const value = draft();
  value.narrative.slides[0]!.scene!.statePhase = 'before';
  const pack = await buildPack(value);
  const zip = await JSZip.loadAsync(await renderPptx(pack));
  const hook = await xml(zip, 1);
  assert.doesNotMatch(text(hook), /size=2/);
  const outcome = await xml(zip, 7);
  const result = [1, 2].map(line => text(namedShape(outcome, `outcome result line ${line}`))).join('\n');
  const source = pack.teaching!.states.find(state => state.id === pack.teaching!.outcome!.fromStateId)!
    .values.find(item => item.entityId === pack.teaching!.outcome!.sourceEntityId)!;
  assert.equal(result, source.content);
  assert.doesNotMatch(result, /size=2/);
  assert.match(text(outcome), /保持不变/);
  assert.match(namedShape(outcome, 'action arrow rule application'), /prstDash val="dash"/);
  assert.match(await xml(zip, 7, true), /rule-application/);
  delete pack.narrative.slides[0]!.scene!.statePhase;
  await assert.rejects(renderPptx(pack), error => error instanceof AhaError && error.code === 'TEACHING_SCENE');
});

test('oversized snippets and feedback fail instead of truncating or shrinking', async () => {
  for (const kind of ['code', 'feedback'] as const) {
    const value = draft();
    if (kind === 'code') {
      value.teaching!.states.forEach(state => state.values.forEach(item => { item.content += `\n${'x'.repeat(120)}`; }));
    } else {
      value.teaching!.checks[2]!.choices[0]!.feedback = '这是需要明确保留的完整理由。'.repeat(15);
    }
    await assert.rejects(renderPptx(await buildPack(value)), error =>
      error instanceof AhaError && error.code === 'PPTX_CONTENT_LIMIT');
  }
});

test('unsupported future scene kinds fail explicitly instead of looking up an undefined transition', async () => {
  const pack = await buildPack(draft());
  Object.assign(pack.narrative.slides[0]!.scene!, { kind: 'future-scene' });
  await assert.rejects(renderPptx(pack), error =>
    error instanceof AhaError && error.code === 'PPTX_SCENE_UNSUPPORTED');
});

test('synthetic four-state teaching fits native slides with full transfer explanations and no fake execution', async () => {
  const value = createTeachingDraft();
  const pack = await buildPack(value);
  const zip = await JSZip.loadAsync(await renderPptx(pack));
  for (let index = 0; index < pack.narrative.slides.length; index++) {
    const slide = await xml(zip, index + 1);
    assertGeometry(slide);
    assert.doesNotMatch(slide, /<p:pic>|<c:chart/);
    assert.doesNotMatch(text(slide), /选定\n配置|编辑\n配置/);
    const page = pack.narrative.slides[index]!;
    if (page.scene?.kind === 'transfer' || page.scene?.kind === 'answer') {
      const words = text(slide).replaceAll('\n', '');
      const check = pack.teaching!.checks.find(check => check.id === page.scene!.checkId)!;
      if (page.scene.kind === 'transfer') {
        assert.doesNotMatch(words, /正确答案|解析|备注/);
        for (const choice of check.choices) assert.ok(!words.includes(choice.feedback));
      } else {
        assert.match(words, /正确答案：B/);
        for (const choice of check.choices) assert.ok(words.includes(choice.feedback));
        assert.doesNotMatch(words, /A · A：|B · B：|C · C：/);
        const card = namedBox(slide, 'answer option 1');
        const feedback = namedBox(slide, 'answer reason 1');
        assert.ok(feedback.w / card.w >= 0.67, 'Feedback should use the available card width');
        assert.equal(text(namedShape(slide, 'answer reason 1')).split('\n').length, 1);
      }
    }
  }
  const edit = await xml(zip, 3);
  for (const [prefix, stateIndex] of [['target before', 1], ['target after', 2]] as const) {
    const expected = pack.teaching!.states[stateIndex]!.values[0]!.content;
    const lines = expected.split('\n').slice(0, -1);
    assert.deepEqual(lines.map((_, index) => text(namedShape(edit, `${prefix} line ${index + 1}`))), lines,
      'Native code lines retain indentation and authored plus signs without manufactured diff prefixes');
  }
  const outcome = await xml(zip, 4);
  const selected = pack.teaching!.states[2]!.values[1]!.content;
  assert.equal([1, 2].map(line => text(namedShape(outcome, `outcome result line ${line}`))).join('\n') + '\n', selected);
  assert.match(namedShape(outcome, 'action arrow rule application'), /prstDash val="dash"/);
});
