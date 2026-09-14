import assert from 'node:assert/strict';
import test from 'node:test';
import { createExample } from '../src/core/examples.js';
import { stateAt } from '../src/core/engine.js';
import { renderHtml, serializeInertJson, type RenderAssets } from '../src/renderers/html.js';
import { renderCardHtml, renderSceneHtml } from '../src/renderers/card.js';
import { escapeHtml, safeSourceUrl, selectedStateMarkup } from '../src/renderers/presentation.js';
import { readerConditions } from '../src/renderers/learning.js';

const readerText = (html: string): string => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ');

const assets: RenderAssets = {
  labJs: '/* 内嵌探索运行时 */',
  slidesJs: '/* 内嵌幻灯片运行时 */',
  revealJs: '/* 内嵌 Reveal 5.2.1 */',
  revealCss: '.reveal { position: relative; }',
};

test('renderers safely embed hostile source text as inert JSON and escaped markup', async () => {
  const pack = await createExample('retry');
  const hostile = '</script><script>globalThis.hacked=true</script><img src=x onerror=alert(1)>&\u2028\u2029';
  pack.brief.topic = hostile;
  pack.evidence[0]!.summary = hostile;
  pack.narrative.slides[0]!.notes = hostile;
  for (const kind of ['lab', 'slides'] as const) {
    const html = renderHtml(pack, kind, assets);
    assert.ok(!html.includes('<script>globalThis.hacked'));
    assert.ok(!html.includes('<img src=x'));
    assert.ok(html.includes(escapeHtml(hostile)));
    const json = html.match(/<script id="aha-pack" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
    assert.ok(json);
    assert.doesNotMatch(json, /[<>&\u2028\u2029]/);
    assert.deepEqual(JSON.parse(json), pack);
    assert.match(html, /connect-src 'none'/);
  }
  assert.equal(JSON.parse(serializeInertJson({ text: hostile })).text, hostile);
});

test('single-file pages have no remote dependency tags and preserve safe source links', async () => {
  const pack = await createExample('evidence');
  pack.evidence[0]!.url = 'https://example.com/?a=1&b=%22';
  for (const kind of ['lab', 'slides'] as const) {
    const html = renderHtml(pack, kind, assets);
    assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=/i);
    assert.doesNotMatch(html, /<link\b|<iframe\b|<object\b|<embed\b|@import\b/i);
    assert.match(html, /href="https:\/\/example\.com\/\?a=1&amp;b=%22"/);
    assert.match(html, /rel="noreferrer noopener"/);
    assert.match(html, /私密/);
    assert.match(html, new RegExp(pack.manifest.contentHash));
  }
  pack.evidence[0]!.url = 'javascript:alert(1)';
  assert.doesNotMatch(renderHtml(pack, 'lab', assets), /href="javascript:/i);
  assert.equal(safeSourceUrl('data:text/html,bad'), undefined);
  assert.equal(safeSourceUrl('file:///private'), undefined);
});

test('slides preserve narrative cases, actual inputs, selected state and exact final values', async () => {
  for (const engine of ['retry', 'compound'] as const) {
    const pack = await createExample(engine);
    const caseSlide = pack.narrative.slides.find(slide => slide.scenarioId)!;
    caseSlide.eventStep = 1;
    const html = renderHtml(pack, 'slides', assets);
    assert.equal((html.match(/data-slide-index="/g) ?? []).length, pack.narrative.slides.length);
    for (const trace of pack.traces) {
      assert.ok(html.includes(`data-scenario-id="${trace.scenarioId}"`));
      for (const value of Object.values(trace.result)) assert.ok(html.includes(escapeHtml(value)));
    }
    const trace = pack.traces.find(item => item.scenarioId === caseSlide.scenarioId)!;
    for (const value of Object.values(stateAt(trace, 1))) assert.ok(html.includes(escapeHtml(value)));
    assert.ok(html.includes(`1 / ${trace.events.length}`));
    assert.match(html, /图表的逐步数值表/);
    assert.match(html, /<caption>.*文字等价数据<\/caption>/);
    assert.match(html, /aria-label="讲解备注" hidden/);
  }
});

test('Lab markup is semantic, labeled and honest about model and evidence modes', async () => {
  const model = renderHtml(await createExample('retry'), 'lab', assets);
  assert.match(model, /<html lang="zh-CN">/);
  assert.match(model, /<noscript>/);
  assert.match(model, /<main id="main">/);
  assert.match(model, /role="alert"/);
  assert.match(model, /for="a-maxRetries"/);
  assert.match(model, /id="a-maxRetries"[^>]*min="0" max="20"/);
  assert.match(model, /id="a-export" checked/);
  assert.match(model, /id="b-export" checked/);
  assert.match(model, /id="a-note"/);
  assert.match(model, /id="b-note"/);
  assert.match(model, /按所选条件计算/);
  assert.match(model, /累计计划等待（ms）/);
  assert.match(model, /不会实际等待或执行请求/);
  assert.match(model, /prefers-reduced-motion/);
  assert.match(model, /--cp-accent: #b11f4b/);
  assert.match(model, /param === "light" \|\| param === "dark"/);
  const evidence = renderHtml(await createExample('evidence'), 'lab', assets);
  assert.match(evidence, /id="evidence-selector"/);
  assert.match(evidence, /id="lesson-selector"/);
  assert.doesNotMatch(readerText(evidence), /来源阅读 · 非因果模拟|所选材料数|为谁讲解/);
  assert.doesNotMatch(evidence, /type="number"|id="[ab]-(?:run|play|pause|next)"|id="export-exploration"/);
});

test('retry scheduling distinguishes logical scheduling time from cumulative planned wait', async () => {
  const trace = (await createExample('retry')).traces[0]!;
  const scheduled = trace.events.find(event => event.kind === 'retry-scheduled')!;
  const markup = selectedStateMarkup(trace, scheduled.step);
  assert.match(markup, /累计计划等待已包含新安排的等待/);
  assert.match(markup, /不是实测耗时，不会实际等待或执行请求/);
  assert.ok(markup.includes(`逻辑时刻：${scheduled.logicalTimeMs} 毫秒`));
  assert.ok(markup.includes(`data-state-key="totalDelayMs">${scheduled.stateAfter.totalDelayMs}`));
});

test('Lab promotes the original takeaway and committed results before any form without rewriting facts', async () => {
  const pack = await createExample('compound');
  const before = JSON.stringify(pack);
  const html = renderHtml(pack, 'lab', assets);
  assert.ok(html.indexOf('data-takeaway') < html.indexOf('id="a-form"'));
  assert.ok(html.indexOf('id="a-summary"') < html.indexOf('id="a-form"'));
  assert.ok(html.includes(escapeHtml(pack.brief.explanation!.takeaway)));
  assert.ok(html.includes(escapeHtml(pack.brief.explanation!.analogy!.limitations)));
  assert.ok(html.includes(escapeHtml(pack.brief.explanation!.checkQuestion)));
  assert.doesNotMatch(readerText(html), /原解释包的讲解要点|释义帮助阅读|为谁讲解/);
  assert.match(html, /aria-label="本页章节"/);
  assert.match(html, /href="#predict".*01 · 预测/);
  assert.match(html, /href="#observe".*02 · 观察/);
  assert.match(html, /href="#explain".*03 · 解释/);
  assert.equal(JSON.stringify(pack), before);
  delete pack.brief.explanation;
  const legacy = renderHtml(pack, 'lab', assets);
  assert.ok(legacy.includes(`<p class="takeaway" data-takeaway>${escapeHtml(pack.brief.question)}</p>`));
  assert.doesNotMatch(legacy, /类比到此为止/);
});

test('image cards show explanations and numeric states with concise sources, not authoring metadata', async () => {
  for (const engine of ['retry', 'compound', 'evidence'] as const) {
    const pack = await createExample(engine);
    const before = JSON.stringify(pack);
    const html = renderCardHtml(pack);
    assert.match(html, /id="aha-card"/);
    assert.match(html, /width: 1080px; max-height: 2400px/);
    assert.doesNotMatch(readerText(html), /为谁讲解|原解释包|完整台账|所选材料|Pack SHA-256|非因果模拟/);
    assert.ok(!readerText(html).includes(pack.brief.audience));
    assert.ok(!readerText(html).includes(pack.manifest.contentHash));
    if (engine !== 'evidence') {
      for (const scenario of pack.scenarios) assert.ok(html.includes(`data-scenario-id="${scenario.id}"`));
    }
    for (const evidence of pack.evidence) {
      assert.ok(html.includes(escapeHtml(evidence.title)));
    }
    for (const trace of engine === 'evidence' ? [] : pack.traces) {
      const key = engine === 'compound' ? 'balance' : 'attempt';
      assert.ok(html.includes(`data-summary-key="${key}">${escapeHtml(stateAt(trace, trace.events.length)[key])}`));
    }
    for (const caveat of readerConditions(pack)) assert.ok(html.includes(escapeHtml(caveat)));
    if (engine !== 'evidence') assert.match(html, /<svg[^>]*role="img"/);
    else assert.doesNotMatch(html, /data-summary-key=|来源材料<\/text>/);
    assert.doesNotMatch(html, /<script[^>]*src=|<link\b|<img\b|@import|<form\b|<button\b/);
    assert.equal(JSON.stringify(pack), before);
  }
});

test('scene state is selected solely by slide reference and changing captions never changes that state', async () => {
  const pack = await createExample('compound');
  const slide = pack.narrative.slides.find(item => item.scenarioId)!;
  slide.eventStep = 1;
  const trace = pack.traces.find(item => item.scenarioId === slide.scenarioId)!;
  for (const caption of ['观察第一期的余额。', '现在用自己的话说说发生了什么。']) {
    const html = renderSceneHtml(pack, slide.id, caption);
    assert.ok(html.includes(`data-summary-key="balance">${stateAt(trace, 1).balance}`));
    assert.ok(html.includes(`第 1 / ${trace.events.length} 步`));
    assert.ok(html.includes(caption));
    assert.ok(!readerText(html).includes(pack.manifest.contentHash));
    assert.ok(html.includes(escapeHtml(pack.evidence[0]!.title)));
    assert.match(html, /width: 1280px; height: 720px/);
    assert.doesNotMatch(html, /id="a-form"|<button\b/);
  }
  const noCase = renderSceneHtml(pack, pack.narrative.slides[0]!.id, '先明确问题。');
  assert.doesNotMatch(noCase, /本页未关联案例状态/);
  assert.doesNotMatch(noCase, /data-summary-key=/);
});

test('card and scene escape all external text, reject excess content, and keep legacy fallback factual', async () => {
  const pack = await createExample('retry');
  const hostile = '</script><svg onload="globalThis.hacked=true"></svg>';
  pack.brief.explanation!.takeaway = hostile;
  pack.brief.explanation!.analogy!.limitations = hostile;
  pack.brief.explanation!.glossary[0]!.meaning = hostile;
  pack.evidence[0]!.title = hostile;
  pack.narrative.slides[0]!.body = hostile;
  for (const html of [renderCardHtml(pack), renderSceneHtml(pack, 'question', hostile)]) {
    assert.ok(html.includes(escapeHtml(hostile)));
    assert.doesNotMatch(html, /<svg onload|<script>globalThis/);
    assert.match(html, /connect-src 'none'/);
    assert.match(html, /param === "light" \|\| param === "dark"/);
  }
  delete pack.brief.explanation;
  assert.ok(renderCardHtml(pack).includes(`<p class="takeaway" data-takeaway>${escapeHtml(pack.brief.question)}</p>`));
  pack.brief.topic = '长'.repeat(81);
  assert.throws(() => renderCardHtml(pack), { code: 'CARD_CONTENT_LIMIT', path: '/brief/topic' });
  pack.narrative.slides[0]!.body = '长'.repeat(181);
  assert.throws(() => renderSceneHtml(pack, 'question', '讲解'), { code: 'SCENE_CONTENT_LIMIT', path: '/narrative/slides/question/body' });
  pack.narrative.slides[0]!.body = '简短内容';
  assert.throws(() => renderSceneHtml(pack, 'question', '长'.repeat(121)), { code: 'SCENE_CONTENT_LIMIT', path: '/caption' });
  pack.narrative.slides[0]!.title = '题'.repeat(60);
  pack.narrative.slides[0]!.body = '文'.repeat(140);
  assert.throws(() => renderSceneHtml(pack, 'question', '句'.repeat(60)), { code: 'SCENE_CONTENT_LIMIT', path: '/scene-story' });
  assert.throws(() => renderSceneHtml(pack, 'missing', '讲解'), { code: 'SCENE_SLIDE_MISSING' });
});

test('card typography budget rejects an overflowing combination even when individual fields fit', async () => {
  const pack = await createExample('compound');
  pack.scenarios.forEach(scenario => { scenario.title = '案'.repeat(70); });
  pack.claims[0]!.text = '结'.repeat(240);
  pack.claims[0]!.scope = '界'.repeat(140);
  pack.modelSpec.assumptions = ['限'.repeat(400)];
  pack.brief.explanation!.takeaway = '结'.repeat(240);
  pack.claims[0]!.assumptions = [];
  assert.throws(() => renderCardHtml(pack), { code: 'CARD_CONTENT_LIMIT', path: '/visible-content' });
});

test('claim-bound knowledge visuals and answers render consistently without leaking audit inputs', async () => {
  const pack = await createExample('evidence');
  pack.brief.audience = 'AUDIENCE_ONLY_INTERNAL';
  pack.brief.explanation!.conditions = ['仅限这个比较条件。'];
  pack.brief.explanation!.answer = '应比较其他条件是否相同。';
  const visual = {
    layout: 'steps' as const, title: '两种可能的解释',
    items: [{ label: '车辆增加', body: '等待时间变化' }, { label: '乘客减少', body: '另一个可能的因素' }],
    claimIds: [pack.claims[0]!.id, pack.claims[1]!.id],
  };
  pack.brief.explanation!.visual = visual;
  pack.narrative.slides[0]!.visual = visual;
  pack.narrative.slides[0]!.conditions = ['不能由此断定因果。'];
  const before = JSON.stringify(pack);
  for (const html of [renderHtml(pack, 'lab', assets), renderHtml(pack, 'slides', assets), renderCardHtml(pack), renderSceneHtml(pack, 'question', '先看这两个因素。')]) {
    const text = readerText(html);
    assert.ok(text.includes('两种可能的解释'));
    assert.ok(text.includes('车辆增加'));
    assert.ok(text.includes('仅限这个比较条件。'));
    assert.doesNotMatch(text, /AUDIENCE_ONLY_INTERNAL|材料内容哈希|原解释包|所选材料|来源阅读 ·|来源标签/);
    assert.ok(!text.includes(pack.manifest.contentHash));
  }
  assert.ok(renderHtml(pack, 'lab', assets).includes('查看答案'));
  assert.ok(renderCardHtml(pack).includes(pack.brief.explanation!.answer));
  assert.equal(JSON.stringify(pack), before);
});
