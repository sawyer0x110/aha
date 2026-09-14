import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { AhaError } from '../src/core/errors.js';
import { createDraft, createExample } from '../src/core/examples.js';
import { stateAt } from '../src/core/engine.js';
import { buildPack } from '../src/core/pack.js';
import type { Draft, TeachingVisual } from '../src/core/schema.js';
import { readerConditions, readerSources } from '../src/renderers/learning.js';
import { renderPptx } from '../src/renderers/pptx.js';
import { valueLabel } from '../src/renderers/presentation.js';
import { createLongReaderDraft } from './helpers/teaching.js';

function decodeXml(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|apos);/g, entity => ({
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
  })[entity]!);
}

function plainText(xml: string): string {
  return [...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map(match => decodeXml(match[1]!).replace(/\r\n/g, '\n')).join('\n');
}

function containsWrappedText(actual: string, expected: string): boolean {
  return actual.replaceAll('\n', '').includes(expected.replaceAll('\n', ''));
}

async function part(zip: JSZip, name: string): Promise<string> {
  const file = zip.file(name);
  assert.ok(file, `Missing PPTX part ${name}`);
  return file.async('string');
}

function parts(zip: JSZip, pattern: RegExp): string[] {
  return Object.keys(zip.files).filter(name => pattern.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function valueAxis(xml: string): { min: number; max: number; majorUnit: number } {
  const axis = xml.match(/<c:valAx>([\s\S]*?)<\/c:valAx>/)?.[1];
  assert.ok(axis, 'Native chart requires a value axis');
  const min = axis.match(/<c:min val="([^"]+)"\s*\/>/)?.[1];
  const max = axis.match(/<c:max val="([^"]+)"\s*\/>/)?.[1];
  const majorUnit = axis.match(/<c:majorUnit val="([^"]+)"\s*\/>/)?.[1];
  assert.ok(min !== undefined && max !== undefined && majorUnit !== undefined, 'Value axis bounds and tick interval must be explicit');
  return { min: Number(min), max: Number(max), majorUnit: Number(majorUnit) };
}

function assertBounds(xml: string, width: number, height: number): void {
  for (const match of xml.matchAll(/<(?:a|p):xfrm\b[^>]*>([\s\S]*?)<\/(?:a|p):xfrm>/g)) {
    const off = match[1]!.match(/<a:off x="(-?\d+)" y="(-?\d+)"\s*\/>/);
    const ext = match[1]!.match(/<a:ext cx="(-?\d+)" cy="(-?\d+)"\s*\/>/);
    if (!off || !ext) continue;
    const x = Number(off[1]), y = Number(off[2]), w = Number(ext[1]), h = Number(ext[2]);
    assert.ok(x >= 0 && y >= 0 && w >= 0 && h >= 0, 'Object geometry must be nonnegative');
    assert.ok(x + w <= width + 2, `Object exceeds slide width: ${x} + ${w} > ${width}`);
    assert.ok(y + h <= height + 2, `Object exceeds slide height: ${y} + ${h} > ${height}`);
  }
}

function assertTextSeparation(xml: string): void {
  const boxes = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].flatMap(match => {
    if (!match[0].includes('<a:t>')) return [];
    const off = match[0].match(/<a:off x="(\d+)" y="(\d+)"\s*\/>/);
    const ext = match[0].match(/<a:ext cx="(\d+)" cy="(\d+)"\s*\/>/);
    assert.ok(off && ext);
    return [{ x: Number(off[1]), y: Number(off[2]), w: Number(ext[1]), h: Number(ext[2]), text: plainText(match[0]) }];
  });
  for (let index = 0; index < boxes.length; index++) {
    const a = boxes[index]!;
    for (const b of boxes.slice(index + 1)) {
      const horizontal = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const vertical = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      assert.ok(horizontal <= 2 || vertical <= 2, `Text boxes overlap: ${a.text} / ${b.text}`);
    }
  }
}

function visual(layout: TeachingVisual['layout'], count: number): TeachingVisual {
  return {
    layout, title: layout === 'steps' ? '分开比较两个可能的原因' : '候车时间受到哪些因素影响',
    items: [
      { label: '车辆增加', body: '同样的乘客数量下，更多车辆可能缩短排队时间。' },
      { label: '乘客减少', body: '车辆不变时，更少的乘客也可能缩短排队时间。' },
      { label: '同时变化', body: '两件事同时发生，还不能判断各自的作用。' },
      { label: '保持其他条件不变', body: '只改变一个因素，才更容易分清它的作用。' },
    ].slice(0, count),
    claimIds: ['claim-a', 'claim-b', 'unknown'],
  };
}

function readerDraft(): Draft {
  const draft = createDraft('evidence');
  draft.visibility = 'public';
  draft.brief.audience = '仅供内部编写者选择语言的受众说明';
  draft.brief.scope = ['公开使用须先替换模板，再提交作者核验。'];
  draft.brief.explanation!.conditions = ['这是合成例子，不能据此判定真实车站的因果关系。'];
  draft.brief.explanation!.visual = { ...visual('cards', 2), title: '仅供互动概览使用的总图' };
  draft.modelSpec.assumptions = ['source-based · 来源阅读 · 非因果模拟', '来源材料 -> 核验 -> 未解决问题'];
  draft.narrative.slides.forEach((slide, index) => {
    slide.title = `候车时间为何变化：${index + 1}`;
    slide.body = '候车时间缩短时，车辆更多和乘客更少可能同时发生。';
    slide.notes = '作者核验记录；原始材料与限制不应混进课堂讲解。';
    delete slide.visual;
    delete slide.conditions;
  });
  draft.narrative.slides[0]!.visual = visual('cards', 3);
  draft.narrative.slides[1]!.visual = visual('steps', 3);
  draft.narrative.slides[2]!.visual = visual('cards', 2);
  draft.narrative.slides[3]!.visual = visual('cards', 4);
  draft.narrative.slides[4]!.visual = visual('steps', 4);
  draft.narrative.slides[2]!.conditions = ['这个比较没有控制天气。'];
  return draft;
}

  test('synthetic Chinese draft serializes every teaching fact, condition and citation without clipping', async () => {
    const draft = createLongReaderDraft();
    const original = structuredClone(draft);
    const pack = await buildPack(draft);
    const snapshot = structuredClone(pack);
    const zip = await JSZip.loadAsync(await renderPptx(pack));
    const slides = parts(zip, /^ppt\/slides\/slide\d+\.xml$/);
    assert.equal(slides.length, pack.narrative.slides.length);
    assert.equal(parts(zip, /^ppt\/charts\/chart\d+\.xml$/).length, 0);
    assert.equal(parts(zip, /^ppt\/media\/.+/).length, 0);
    for (const [index, name] of slides.entries()) {
      const xml = await part(zip, name);
      const visible = plainText(xml);
      const page = pack.narrative.slides[index]!;
      const notes = plainText(await part(zip, `ppt/notesSlides/notesSlide${index + 1}.xml`));
      assert.ok(visible.includes(page.title));
      assert.ok(visible.includes(page.body), 'All authored lines, including commands, must remain intact');
      assert.ok(page.visual);
      assert.ok(visible.includes(page.visual.title));
      for (const item of page.visual.items) {
        assert.ok(visible.includes(item.label));
        assert.ok(visible.includes(item.body));
      }
      for (const condition of readerConditions(pack, page)) assert.ok(containsWrappedText(visible, condition));
      const links = decodeXml(await part(zip, `ppt/slides/_rels/slide${index + 1}.xml.rels`));
      for (const source of readerSources(pack, page)) {
        assert.ok(containsWrappedText(visible, source.title));
        if (source.url) assert.ok(links.includes(source.url));
        assert.ok(notes.includes(source.title));
        assert.ok(notes.includes(source.locator));
        if (source.contentHash) {
          assert.ok(notes.includes(source.contentHash));
          assert.ok(!visible.includes(source.contentHash));
        }
      }
      assert.ok(notes.includes(JSON.stringify(page, null, 2)));
      assert.ok(notes.includes(JSON.stringify(pack.brief, null, 2)));
      assert.ok(notes.includes(pack.manifest.contentHash));
      assert.ok(!visible.includes(pack.brief.audience));
      assert.ok(!visible.includes(pack.manifest.contentHash));
      for (const id of page.claimIds) assert.ok(!visible.includes(`[${id}]`));
      assert.doesNotMatch(visible, /source-based|来源阅读|非因果模拟|私密|公开使用|Claim IDs|PackHash|PackId|所选材料数/);
      assert.doesNotMatch(xml, /<p:pic>|<a:normAutofit/);
      assertBounds(xml, 12192000, 6858000);
      assertTextSeparation(xml);
      for (const shape of xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)) {
        if (/name="Aha source \d+"/.test(shape[0])) {
          const width = Number(shape[0].match(/<a:ext cx="(\d+)"/)![1]) / 914400;
          assert.ok(width >= 5.9 || plainText(shape[0]).split('\n').length === 1,
            'Multiline reader citations get wide columns; only single-line labels may share narrower columns');
        }
        if (/name="Aha reader conditions"/.test(shape[0])) {
          const lines = plainText(shape[0]).split('\n');
          for (const [lineIndex, line] of lines.entries()) {
            assert.doesNotMatch(line.trimStart(), /^[、。，？！：；）》」』】]/u);
            assert.doesNotMatch(line.trimEnd(), /[（《「『【]$/u);
            if (lineIndex > 0) {
              assert.ok(!(lines[lineIndex - 1]!.endsWith('这') && line.startsWith('里')),
                'Builtin word segmentation keeps 这里 together in a long qualifier');
            }
          }
        }
        for (const font of shape[0].matchAll(/<a:rPr\b[^>]*\bsz="(\d+)"/g)) {
          assert.ok(Number(font[1]) >= (/name="Aha source \d+"/.test(shape[0]) ? 1400 : 1800));
        }
      }
    }
      const comparisonYs = await Promise.all(slides.slice(0, 4).map(async name => {
        const xml = await part(zip, name);
        return [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)]
          .filter(match => /name="Aha teaching (?:title|label \d+|body \d+)"/.test(match[0]))
          .map(match => Number(match[0].match(/<a:off x="\d+" y="(\d+)"/)![1]));
      }));
      for (const positions of comparisonYs) assert.deepEqual(positions, comparisonYs[0],
        'Matching comparison panels share one teaching baseline despite different introduction lengths');
      assert.equal(pack.narrative.slides[3]!.body.split('\n').length, 3, 'Regression fixture keeps the modest three-line command explanation');
      for (const index of [4]) {
        const xml = await part(zip, slides[index]!);
        const labels = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)]
          .filter(match => /name="Aha teaching label \d+"/.test(match[0]))
          .map(match => Number(match[0].match(/<a:off x="(\d+)"/)![1]));
        assert.equal(new Set(labels).size, 3, 'Crowded multiline steps should reflow into three editable horizontal lanes');
        assert.deepEqual(labels, [...labels].sort((a, b) => a - b), 'The authored step order remains left to right');
      }
    assert.deepEqual(pack, snapshot);
    assert.deepEqual(draft, original, 'Building and rendering do not rewrite the input ledger or narrative');
  });

test('long Chinese qualifiers use explicit native paragraphs and citations cannot collapse into inline-link stacks', async () => {
  const pack = await buildPack(createLongReaderDraft());
  const zip = await JSZip.loadAsync(await renderPptx(pack));
  for (const index of [2, 3]) {
    const xml = await part(zip, `ppt/slides/slide${index + 1}.xml`);
    const shapes = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match => match[0]);
    const conditionShape = shapes.find(shape => /name="Aha reader conditions"/.test(shape));
    assert.ok(conditionShape);
    const conditionLines = [...conditionShape.matchAll(/<a:p>[\s\S]*?<\/a:p>/g)].map(match => plainText(match[0]));
    const expected = readerConditions(pack, pack.narrative.slides[index]!)
      .filter(condition => !pack.narrative.slides[index]!.body.includes(condition)).join(' ');
    assert.equal(conditionLines.join(''), expected, 'Explicit wrapping must preserve every character of the synthetic qualifiers');
    assert.ok(conditionLines.length >= 2, 'CJK condition text must be explicitly split, not left to a canvas viewer to wrap');
    assert.match(conditionShape, /<a:bodyPr\b[^>]*wrap="none"/);
    assert.doesNotMatch(conditionShape, /<a:normAutofit|<a:spAutoFit/);
    const width = Number(conditionShape.match(/<a:ext cx="(\d+)"/)![1]) / 914400;
    const height = Number(conditionShape.match(/<a:ext cx="\d+" cy="(\d+)"/)![1]) / 914400;
    for (const line of conditionLines) {
      const units = [...line].reduce((sum, char) => sum + (/[\u0020-\u007e]/.test(char) ? 0.62 : 1), 0);
      assert.ok(units <= width * 72 / 18 * 0.85 + 0.01, `A condition paragraph still exceeds its readable line width: ${line}`);
    }
    assert.equal((conditionShape.match(/<a:spcPts val="2340"\s*\/>/g) ?? []).length, conditionLines.length,
      'Each explicit 18pt line has fixed 23.4pt leading');
    assert.ok(height * 72 >= conditionLines.length * 23.4);
    const sourceShapes = shapes.filter(shape => /name="Aha source \d+"/.test(shape));
    assert.equal(sourceShapes.length, readerSources(pack, pack.narrative.slides[index]!).length);
    for (const shape of sourceShapes) {
      const sourceLines = [...shape.matchAll(/<a:p>[\s\S]*?<\/a:p>/g)].map(match => plainText(match[0]));
      assert.equal(sourceLines.length, 1, 'These concise source titles fit in one deliberately encoded line');
      assert.match(shape, /<a:bodyPr\b[^>]*wrap="none"/);
      assert.match(shape, /<p:cNvPr\b[^>]*><a:hlinkClick\b/);
      for (const run of shape.matchAll(/<a:rPr\b[\s\S]*?<\/a:rPr>/g)) {
        assert.doesNotMatch(run[0], /<a:hlinkClick\b/, 'Native shape-level links must not create narrow inline anchors in canvas viewers');
      }
      const off = shape.match(/<a:off x="(\d+)" y="(\d+)"/)!;
      const ext = shape.match(/<a:ext cx="(\d+)" cy="(\d+)"/)!;
      assert.ok(Number(ext[1]) / 914400 >= 5.5, 'The two reader citations get generous columns');
      assert.ok(Number(off[2]) + Number(ext[2]) <= (7.5 - 0.7) * 914400 + 2, 'Citations retain at least a 0.7-inch bottom margin');
    }
    assertTextSeparation(xml);
    assertBounds(xml, 12192000, 6858000);
  }
});

test('automatic qualifier wraps respect punctuation, words and exact mixed-script text', async () => {
  for (const qualifier of [
    `${'甲'.repeat(40)}、这里保留全部限定。`,
    `${'甲'.repeat(39)}（这里保留全部限定）与“引文”。`,
    `${'甲'.repeat(39)}这里不是另一个词。`,
    `${'甲'.repeat(34)}set-mode --flag=0.01；不是0.1。`,
    `${'甲'.repeat(38)}e\u0301与👩‍💻。\r\n第二段：保留  两个空格。\r第三段。`,
    `${'甲'.repeat(39)}《这里的“引文”》、其余条件。`,
  ]) {
    const draft = readerDraft();
    draft.brief.explanation!.conditions = [];
    draft.narrative.slides[0]!.conditions = [qualifier];
    const pack = await buildPack(draft);
    const zip = await JSZip.loadAsync(await renderPptx(pack));
    const xml = await part(zip, 'ppt/slides/slide1.xml');
    const shape = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)]
      .find(match => /name="Aha reader conditions"/.test(match[0]))![0];
    const lines = plainText(shape).split('\n');
    assert.ok(lines.length > 1);
    assert.equal(lines.join(''), qualifier.replace(/\r\n|\r|\n/g, ''), 'Only line separators may be normalized');
    for (const line of lines) {
      assert.doesNotMatch(line.trimStart(), /^[、。，？！：；）》」』】’”!?%,.:;\])}]/u);
      assert.doesNotMatch(line.trimEnd(), /[（《「『【‘“([{]$/u);
      const units = [...line].reduce((sum, char) => sum + (/[\u0020-\u007e]/.test(char) ? 0.62 : 1), 0);
      assert.ok(units <= 11.83 * 72 / 18 * 0.85 + 0.01, `No hanging punctuation outside the reserved width: ${line}`);
    }
    for (const word of ['这里', 'set-mode', '--flag=0.01', '0.1', 'e\u0301', '👩‍💻']) {
      if (qualifier.includes(word)) assert.ok(lines.some(line => line.includes(word)), `Do not split ${word}`);
    }
    assert.match(shape, /<a:bodyPr\b[^>]*wrap="none"/);
    assert.doesNotMatch(shape, /<a:normAutofit|<a:spAutoFit/);
    assertTextSeparation(xml);
  }
});

test('comparison baselines follow matching labels rather than titles and leave longer bodies intact', async () => {
  const draft = createLongReaderDraft();
  draft.brief.explanation!.conditions = [];
  draft.narrative.slides.slice(0, 4).forEach((page, index) => {
    page.visual!.title = `状态 ${index + 1}：对照两个版本`;
  });
  draft.narrative.slides[0]!.body = '完整介绍第一行。\n第二行仍需保留。\n第三行仍需保留。\n第四行不能截断。';
  const pack = await buildPack(draft);
  const zip = await JSZip.loadAsync(await renderPptx(pack));
  const positions: number[] = [];
  for (let index = 0; index < 4; index++) {
    const xml = await part(zip, `ppt/slides/slide${index + 1}.xml`);
    const shape = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)]
      .find(match => /name="Aha teaching label 1"/.test(match[0]))![0];
    positions.push(Number(shape.match(/<a:off x="\d+" y="(\d+)"/)![1]));
    assert.ok(plainText(xml).includes(draft.narrative.slides[index]!.body));
    assert.ok(plainText(xml).includes(draft.narrative.slides[index]!.visual!.title));
    assertTextSeparation(xml);
    assertBounds(xml, 12192000, 6858000);
  }
  assert.equal(positions[1], positions[2]);
  assert.equal(positions[2], positions[3], 'State-specific headings still share a baseline');
  assert.ok(positions[0]! > positions[1]!, 'A longer introduction expands naturally without shifting all the shorter cases');
});

test('long synthetic source headings remain meaningful linked captions with full titles in notes and tooltips', async () => {
  const pack = await buildPack(createLongReaderDraft());
  const titles = [
    'Synthetic Transit Reading Group — Comparing waiting times: definitions, observation windows and uncontrolled variables in an original example',
    'Synthetic Passenger Notes — Interpreting concurrent changes: passenger counts, comparison limits and alternative explanations',
  ];
  pack.evidence.forEach((source, index) => { source.title = titles[index]!; });
  const snapshot = structuredClone(pack);
  const zip = await JSZip.loadAsync(await renderPptx(pack));
  for (const [index, page] of pack.narrative.slides.entries()) {
    const xml = await part(zip, `ppt/slides/slide${index + 1}.xml`);
    const visible = plainText(xml);
    const notes = plainText(await part(zip, `ppt/notesSlides/notesSlide${index + 1}.xml`));
    const links = decodeXml(await part(zip, `ppt/slides/_rels/slide${index + 1}.xml.rels`));
    for (const source of readerSources(pack, page)) {
      assert.ok(containsWrappedText(visible, source.title.split(' — ')[0]!));
      assert.ok(notes.includes(source.title), 'The full bibliographic title is not discarded');
      assert.ok(decodeXml(xml).includes(`tooltip="${source.title}"`));
      assert.ok(links.includes(source.url!));
    }
    assert.ok(visible.includes(page.body));
    for (const item of page.visual!.items) assert.ok(visible.includes(item.body));
    for (const condition of readerConditions(pack, page)) assert.ok(containsWrappedText(visible, condition));
    assertBounds(xml, 12192000, 6858000);
    assertTextSeparation(xml);
  }
  assert.deepEqual(pack, snapshot, 'Caption choice must not rewrite evidence identity');
});

for (const engine of ['retry', 'compound', 'evidence'] as const) {
  test(`native ${engine} deck preserves narrative, source notes, editable objects and bounds`, async () => {
    const pack = await createExample(engine);
    const original = structuredClone(pack);
    const bytes = await renderPptx(pack);
    assert.ok(bytes instanceof Uint8Array);
    assert.deepEqual(pack, original, 'Renderer must not mutate its Pack');
    const zip = await JSZip.loadAsync(bytes);
    const slides = parts(zip, /^ppt\/slides\/slide\d+\.xml$/);
    const notes = parts(zip, /^ppt\/notesSlides\/notesSlide\d+\.xml$/);
    const charts = parts(zip, /^ppt\/charts\/chart\d+\.xml$/);
    assert.equal(slides.length, pack.narrative.slides.length);
    assert.ok(slides.length >= 5 && slides.length <= 8);
    assert.equal(notes.length, slides.length);
    assert.equal(charts.length, engine === 'evidence' ? 0 : 2);
    assert.equal(parts(zip, /^ppt\/media\/.+/).length, 0, 'No whole-page images or external media');
    assert.ok(parts(zip, /^ppt\/slideMasters\/slideMaster\d+\.xml$/).length > 0);
    const core = await part(zip, 'docProps/core.xml');
    assert.ok(decodeXml(core).includes(pack.brief.topic));
    assert.ok(core.includes(`<dc:subject>PackHash: ${pack.manifest.contentHash}</dc:subject>`));
    assert.match(core, /<dc:language>zh-CN<\/dc:language>/);
    const presentation = await part(zip, 'ppt/presentation.xml');
    const size = presentation.match(/<p:sldSz cx="(\d+)" cy="(\d+)"/);
    assert.ok(size);
    const width = Number(size[1]), height = Number(size[2]);
    assert.ok(Math.abs(width / height - 16 / 9) < 0.00001);
    for (let index = 0; index < slides.length; index++) {
      const xml = await part(zip, slides[index]!);
      const noteText = plainText(await part(zip, notes[index]!));
      const visible = plainText(xml);
      const narrative = pack.narrative.slides[index]!;
      assert.ok(visible.includes(narrative.title));
      assert.ok(visible.includes(narrative.body));
      assert.match(visible, /私密/);
      assert.doesNotMatch(visible, /source-based|derived-model|来源阅读|非因果模拟|面向：|来源主张 \[|模型结论 \[|PackHash:|PackId:/);
      assert.ok(!visible.includes(pack.brief.audience), 'Audience selection must remain internal');
      assert.ok(!visible.includes(pack.manifest.contentHash), 'Raw hashes belong in metadata and notes');
      assert.match(xml, /<p:sp>/);
      assert.doesNotMatch(xml, /<p:pic>/);
      assert.match(xml, /name="Aha title"/);
      assert.match(xml, /sz="3200"/);
      assert.match(xml, /lang="zh-CN"/);
      for (const shape of xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)) {
        for (const font of shape[0].matchAll(/<a:rPr\b[^>]*\bsz="(\d+)"/g)) {
          assert.ok(Number(font[1]) >= (/name="Aha source \d+"/.test(shape[0]) ? 1400 : 1800),
            'Explanations and conditions stay at least 18pt; linked source labels stay at least 14pt');
        }
      }
      assertBounds(xml, width, height);
      assertTextSeparation(xml);
      assert.ok(noteText.includes(pack.manifest.contentHash));
      assert.ok(noteText.includes(narrative.notes));
      assert.ok(noteText.includes(JSON.stringify(pack.brief, null, 2)));
      assert.ok(noteText.includes(JSON.stringify(pack.modelSpec, null, 2)));
      for (const id of narrative.claimIds) {
        const claim = pack.claims.find(item => item.id === id)!;
        assert.ok(noteText.includes(JSON.stringify(claim, null, 2).split('\n').map(line => `  ${line}`).join('\n').trim()));
      }
      if (narrative.scenarioId) {
        const trace = pack.traces.find(item => item.scenarioId === narrative.scenarioId)!;
        const scenario = pack.scenarios.find(item => item.id === narrative.scenarioId)!;
        assert.ok(noteText.includes(JSON.stringify(trace, null, 2)));
        assert.ok(noteText.includes(JSON.stringify(scenario, null, 2)));
        if (engine !== 'evidence') {
          assert.match(xml, /<c:chart /);
          assert.match(xml, /<a:tbl>/);
          for (const value of Object.values(stateAt(trace, narrative.eventStep ?? trace.events.length))) {
            assert.ok(visible.includes(valueLabel(value)), `Missing selected value ${value}`);
          }
          assert.match(visible, engine === 'compound' ? /余额（金额单位/ : /累计计划等待（ms/);
        } else {
          assert.doesNotMatch(xml, /<c:chart /);
          assert.doesNotMatch(visible, /所选材料数|所选材料 · 份|不进行数值或因果模拟/);
        }
      }
      for (const condition of readerConditions(pack, narrative)) assert.ok(containsWrappedText(visible, condition));
      for (const claim of pack.claims) assert.ok(!visible.includes(`[${claim.id}]`));
      const usedSources = readerSources(pack, narrative);
      for (const source of usedSources) {
        assert.ok(containsWrappedText(visible, source.title));
        assert.ok(!visible.includes(`[${source.id}]`));
        assert.ok(noteText.includes(source.locator));
        assert.ok(noteText.includes(source.sourceVersion));
        assert.ok(noteText.includes(source.summary));
      }
    }
    for (const master of parts(zip, /^ppt\/slideMasters\/slideMaster\d+\.xml$/)) {
      assertBounds(await part(zip, master), width, height);
    }
    for (let index = 0; index < charts.length; index++) {
      const xml = await part(zip, charts[index]!);
      assert.match(xml, /<c:lineChart>/);
      assert.match(xml, /<c:externalData /, 'Chart must retain its editable workbook');
      assert.match(xml, /<a:t>步骤<\/a:t>/);
      const trace = pack.traces[index]!;
      const states = [trace.initialState, ...trace.events.map(event => event.stateAfter)];
      const numericCache = xml.match(/<c:numCache>([\s\S]*?)<\/c:numCache>/)?.[1];
      assert.ok(numericCache);
      const values = [...numericCache.matchAll(/<c:v>(.*?)<\/c:v>/g)].map(match => Number(match[1]));
      assert.deepEqual(values, states.map(state => Number(engine === 'compound' ? state.balance : state.totalDelayMs)));
      assert.match(xml, engine === 'compound' ? /余额（金额单位）/ : /累计计划等待（ms）/);
    }
    for (const workbook of parts(zip, /^ppt\/embeddings\/.+\.xlsx$/)) {
      const data = await zip.file(workbook)!.async('uint8array');
      const embedded = await JSZip.loadAsync(data);
      assert.ok(embedded.file('xl/worksheets/sheet1.xml'), 'Editable chart data must be packaged');
    }
  });
}

test('authored knowledge visuals use editable native shapes, direct prose, and readable material conditions', async () => {
  const pack = await buildPack(readerDraft());
  const original = structuredClone(pack);
  const zip = await JSZip.loadAsync(await renderPptx(pack));
  const slides = parts(zip, /^ppt\/slides\/slide\d+\.xml$/);
  const allVisible: string[] = [];
  for (let index = 0; index < slides.length; index++) {
    const xml = await part(zip, slides[index]!);
    const visible = plainText(xml);
    allVisible.push(visible);
    const page = pack.narrative.slides[index]!;
    assert.ok(visible.includes(page.body));
    assert.ok(!visible.includes(pack.brief.audience));
    assert.ok(!visible.includes(pack.manifest.contentHash));
    assert.ok(!visible.includes(pack.brief.explanation!.visual!.title), 'An overview visual must not leak onto narrative pages');
    assert.doesNotMatch(visible, /私密|公开|source-based|来源阅读|非因果模拟|derived-model|所选材料|Claim|PackHash|PackId|claim-a|source-a|来源材料 ->|作者核验/);
    assert.doesNotMatch(xml, /<p:pic>|<c:chart |<a:tbl>|<a:normAutofit/);
    assertBounds(xml, 12192000, 6858000);
    assertTextSeparation(xml);
    if (page.visual) {
      assert.match(xml, /name="Aha teaching title"/);
      assert.ok(visible.includes(page.visual.title));
      assert.ok(!visible.includes(pack.evidence[0]!.summary), 'Authored visuals replace raw evidence-summary cards');
      for (const [itemIndex, item] of page.visual.items.entries()) {
        assert.ok(visible.includes(item.label));
        assert.ok(visible.includes(item.body));
        assert.ok(xml.includes(`name="Aha teaching label ${itemIndex + 1}"`));
        assert.ok(xml.includes(`name="Aha teaching body ${itemIndex + 1}"`));
        if (page.visual.layout === 'steps') assert.ok(xml.includes(`name="Aha teaching step ${itemIndex + 1}"`));
      }
      const notes = plainText(await part(zip, `ppt/notesSlides/notesSlide${index + 1}.xml`));
      assert.ok(notes.includes(JSON.stringify(page, null, 2)));
      for (const id of page.visual.claimIds) {
        assert.ok(notes.includes(pack.claims.find(claim => claim.id === id)!.scope));
      }
    }
    for (const condition of readerConditions(pack, page)) assert.ok(containsWrappedText(visible, condition));
  }
  assert.equal(parts(zip, /^ppt\/media\/.+/).length, 0);
  assert.deepEqual(pack, original);
  const notes = plainText(await part(zip, 'ppt/notesSlides/notesSlide1.xml'));
  for (const internal of [pack.brief.audience, pack.brief.scope[0]!, pack.manifest.contentHash, ...pack.modelSpec.assumptions]) {
    assert.ok(notes.includes(internal), `Audit data must remain in notes: ${internal}`);
    assert.ok(!allVisible.join('\n').includes(internal), `Audit data leaked to readers: ${internal}`);
  }
});

test('visual-only claims and more than four references retain every source link and detailed claim in notes', async () => {
  const draft = readerDraft();
  const page = draft.narrative.slides[0]!;
  page.claimIds = [];
  page.visual!.claimIds = [];
  for (let index = 1; index <= 7; index++) {
    const source = {
      id: `audit-source-${index}`, kind: 'document' as const, title: `候车记录 ${index}`,
      locator: `Archive ${index}, section 12`, sourceVersion: `revision-${index}`,
      summary: `Full original material ${index}.`, contentHash: String(index).repeat(64),
      url: `https://example.invalid/study/${index}?edition=2&language=zh`,
    };
    const claim = {
      id: `audit-claim-${index}`, type: 'source-claim' as const, text: `Complete claim ${index}.`,
      scope: `Detailed scope ${index}.`, evidenceIds: [source.id],
      assumptions: [`Claim assumption ${index}.`], limitations: [`Claim limitation ${index}.`],
    };
    draft.evidence.push(source);
    draft.claims.push(claim);
    page.visual!.claimIds.push(claim.id);
    if (index <= 6) page.claimIds.push(claim.id);
  }
  const pack = await buildPack(draft);
  const zip = await JSZip.loadAsync(await renderPptx(pack));
  const xml = await part(zip, 'ppt/slides/slide1.xml');
  const visible = plainText(xml);
  const notes = plainText(await part(zip, 'ppt/notesSlides/notesSlide1.xml'));
  const links = decodeXml(await part(zip, 'ppt/slides/_rels/slide1.xml.rels'));
  for (const source of readerSources(pack, pack.narrative.slides[0]!)) {
    assert.ok(containsWrappedText(visible, source.title));
    if (source.url) assert.ok(links.includes(source.url));
    assert.ok(notes.includes(source.id));
    assert.ok(notes.includes(source.locator));
    assert.ok(notes.includes(source.sourceVersion));
    assert.ok(notes.includes(source.summary));
    if (source.contentHash) {
      assert.ok(notes.includes(source.contentHash));
      assert.ok(!visible.includes(source.contentHash));
    }
  }
  for (const claim of draft.claims.slice(-7)) {
    assert.ok(!visible.includes(claim.id));
    assert.ok(!visible.includes(claim.text), 'References do not create raw claim cards');
    assert.ok(notes.includes(claim.id));
    for (const fact of [claim.text, claim.scope, ...claim.assumptions, ...claim.limitations]) assert.ok(notes.includes(fact));
  }
  assert.equal((xml.match(/name="Aha source \d+"/g) ?? []).length, 9);
  assertTextSeparation(xml);
});

test('legacy evidence slides keep meaningful source explanations without audit scaffolding', async () => {
  const draft = createDraft('evidence');
  delete draft.brief.explanation!.visual;
  delete draft.brief.explanation!.conditions;
  for (const page of draft.narrative.slides) {
    delete page.visual;
    delete page.conditions;
  }
  const pack = await buildPack(draft);
  const zip = await JSZip.loadAsync(await renderPptx(pack));
  for (const index of [2, 3]) {
    const visible = plainText(await part(zip, `ppt/slides/slide${index + 1}.xml`));
    const scenario = pack.scenarios.find(item => item.id === pack.narrative.slides[index]!.scenarioId)!;
    assert.ok('evidenceIds' in scenario.input);
    for (const id of scenario.input.evidenceIds) assert.ok(visible.includes(pack.evidence.find(source => source.id === id)!.summary));
    assert.doesNotMatch(visible, /source-based|来源阅读|非因果模拟|所选材料数|来源主张 \[|尚未解决 \[/);
  }
});

test('explicit numeric conditions replace audit assumptions and merge per-page caveats without duplicates', async () => {
  const draft = createDraft('retry');
  const condition = '等待时间是计划值，不是实测耗时。';
  draft.brief.explanation!.conditions = [condition];
  draft.modelSpec.assumptions.push('内部字段：totalDelayMs、maxRetries；编写者应核验所有 Claim IDs。');
  const page = draft.narrative.slides[2]!;
  delete page.visual;
  page.body = `${condition}重试次数增加时，累计计划等待也可能增加。`;
  page.conditions = [condition, '只有允许重试的错误才会继续尝试。'];
  const pack = await buildPack(draft);
  const zip = await JSZip.loadAsync(await renderPptx(pack));
  const xml = await part(zip, 'ppt/slides/slide3.xml');
  const visible = plainText(xml);
  assert.equal(visible.split(condition).length - 1, 1);
  assert.ok(visible.includes(page.conditions[1]!));
  assert.doesNotMatch(visible, /totalDelayMs|maxRetries|Claim IDs|编写者/);
  assertTextSeparation(xml);
  assert.match(xml, /<c:chart /);
  assert.match(xml, /<a:tbl>/);
  const notes = plainText(await part(zip, 'ppt/notesSlides/notesSlide3.xml'));
  assert.ok(notes.includes(draft.modelSpec.assumptions.at(-1)!));
  assert.ok(notes.includes('"totalDelayMs": 750'));
});

test('readable long source labels are not cut at the old eighty-character card limit', async () => {
  const draft = readerDraft();
  draft.brief.explanation!.conditions = [];
  draft.evidence[0]!.title = `${'A long but useful citation label '.repeat(3)}complete ending`;
  draft.evidence[0]!.url = 'https://example.invalid/full-reference';
  assert.ok(draft.evidence[0]!.title.length > 80);
  const pack = await buildPack(draft);
  const zip = await JSZip.loadAsync(await renderPptx(pack));
  const visible = plainText(await part(zip, 'ppt/slides/slide1.xml'));
  assert.ok(containsWrappedText(visible, draft.evidence[0]!.title));
  assert.match(await part(zip, 'ppt/slides/_rels/slide1.xml.rels'), /https:\/\/example\.invalid\/full-reference/);
});

test('reader conditions and teaching text overflow fail explicitly rather than hiding or shrinking facts', async () => {
  const conditionsDraft = readerDraft();
  conditionsDraft.brief.explanation!.conditions = Array.from({ length: 6 }, (_value, index) => `${index}：${'必要前提'.repeat(40)}`);
  await assert.rejects(renderPptx(await buildPack(conditionsDraft)), error =>
    error instanceof AhaError && error.code === 'PPTX_CONTENT_LIMIT' && /Reader conditions/.test(error.message));
  for (const layout of ['cards', 'steps'] as const) {
    const draft = readerDraft();
    draft.narrative.slides[0]!.visual = {
      layout, title: '必须完整保留的讲解',
      items: [{ label: '完整文字', body: '每一行都需要保留。\n'.repeat(12) }, { label: '另一种情况', body: '不能用省略号代替事实。' }],
      claimIds: ['claim-a'],
    };
    await assert.rejects(renderPptx(await buildPack(draft)), error =>
      error instanceof AhaError && error.code === 'PPTX_CONTENT_LIMIT' && /Teaching/.test(error.message));
  }
});

test('teaching labels, bodies and conditions preserve escaped XML and reject invalid characters', async () => {
  const draft = readerDraft();
  const hostile = '<a:t>不是标记</a:t> & "原文"';
  draft.narrative.slides[0]!.visual!.items[0]!.label = hostile;
  draft.narrative.slides[0]!.visual!.items[0]!.body = hostile;
  draft.narrative.slides[0]!.conditions = [hostile];
  const pack = await buildPack(draft);
  const zip = await JSZip.loadAsync(await renderPptx(pack));
  const xml = await part(zip, 'ppt/slides/slide1.xml');
  assert.ok(plainText(xml).includes(hostile));
  assert.match(xml, /&lt;a:t&gt;不是标记&lt;\/a:t&gt; &amp;/);
  assert.doesNotMatch(xml, /<a:t>不是标记<\/a:t>/);
  const notes = plainText(await part(zip, 'ppt/notesSlides/notesSlide1.xml'));
  assert.ok(notes.includes(JSON.stringify(pack.narrative.slides[0], null, 2)));
  for (const character of ['\u0000', '\ud800', '\ufffe']) {
    const invalid = structuredClone(pack);
    invalid.narrative.slides[0]!.visual!.items[0]!.body += character;
    await assert.rejects(renderPptx(invalid), error => error instanceof AhaError && error.code === 'PPTX_TEXT_INVALID');
  }
});

test('selected event snapshots and fractional balances preserve original exact numbers and actual inputs', async () => {
  const draft = createDraft('compound');
  draft.scenarios[0]!.input = { principal: '0.015', rates: ['0'], cashflows: ['0'], timing: 'end' };
  draft.narrative.slides[2]!.eventStep = 0;
  draft.narrative.slides[2]!.notes = '原始讲解：先看初始状态，再观察。';
  const pack = await buildPack(draft);
  const zip = await JSZip.loadAsync(await renderPptx(pack));
  const slide = plainText(await part(zip, 'ppt/slides/slide3.xml'));
  const notes = plainText(await part(zip, 'ppt/notesSlides/notesSlide3.xml'));
  assert.ok(slide.includes('0.02'));
  assert.ok(slide.includes('3/200'));
  assert.ok(slide.includes('第 0 步，共 1 步'));
  assert.ok(notes.includes('"principal": "0.015"'));
  assert.ok(notes.includes('"cashflows": ['));
  assert.ok(notes.includes('"exactBalance": "3/200"'));
  assert.ok(notes.includes(draft.narrative.slides[2]!.notes));
  assert.ok(notes.includes(pack.manifest.contentHash));
  const retry = createDraft('retry');
  retry.narrative.slides[2]!.eventStep = 2;
  const retryZip = await JSZip.loadAsync(await renderPptx(await buildPack(retry)));
  const retryNotes = plainText(await part(retryZip, 'ppt/notesSlides/notesSlide3.xml'));
  assert.ok(retryNotes.includes('累计计划等待包含新安排的等待，不是实测耗时'));
  assert.ok(retryNotes.includes('"logicalTimeMs": 0'));
  assert.ok(plainText(await part(retryZip, 'ppt/slides/slide3.xml')).includes('250'));
});

test('same-unit scenario comparisons share explicit zero-based value axes across all Pack traces', async () => {
  for (const engine of ['retry', 'compound'] as const) {
    const draft = createDraft(engine);
    draft.narrative.slides[2]!.eventStep = 0;
    if (engine === 'compound') {
      draft.scenarios.push({
        id: 'unshown-peak', title: 'Additional saved case', mode: 'derived-model', claimIds: ['rule'],
        input: { principal: '25000', rates: ['20', '-100'], cashflows: ['0', '0'], timing: 'end' },
      });
    }
    const pack = await buildPack(draft);
    const original = structuredClone(pack);
    const zip = await JSZip.loadAsync(await renderPptx(pack));
    const axes = await Promise.all(parts(zip, /^ppt\/charts\/chart\d+\.xml$/).map(async name => valueAxis(await part(zip, name))));
    assert.equal(axes.length, 2);
    assert.deepEqual(axes[0], axes[1], 'A/B charts must not autoscale independently');
    assert.equal(axes[0]!.min, 0);
    assert.equal(axes[0]!.max, engine === 'compound' ? 50000 : 1000);
    const key = engine === 'compound' ? 'balance' : 'totalDelayMs';
    for (const trace of pack.traces) {
      for (const state of [trace.initialState, ...trace.events.map(event => event.stateAfter)]) {
        assert.ok(Number(state[key]) <= axes[0]!.max, 'Shared maximum must cover every saved state, not only selected/final states');
      }
    }
    assert.deepEqual(pack, original, 'Axis selection must not change Pack identity or narration');
  }
});

test('compound example uses one common explicit scale without changing its exact cached values', async () => {
  const pack = await createExample('compound');
  const zip = await JSZip.loadAsync(await renderPptx(pack));
  const charts = parts(zip, /^ppt\/charts\/chart\d+\.xml$/);
  assert.equal(charts.length, 2);
  for (const name of charts) {
    assert.deepEqual(valueAxis(await part(zip, name)), { min: 0, max: 20000, majorUnit: 4000 });
  }
  assert.match(await part(zip, charts[0]!), /<c:v>10800<\/c:v>/);
  assert.match(await part(zip, charts[1]!), /<c:v>11000<\/c:v>/);
});

test('all-zero and sub-unit models get shared nondegenerate axes with readable tick units', async () => {
  for (const engine of ['retry', 'compound'] as const) {
    const draft = createDraft(engine);
    for (const scenario of draft.scenarios) {
      scenario.input = engine === 'compound'
        ? { principal: '0', rates: ['0'], cashflows: ['0'], timing: 'end' }
        : { maxRetries: 0, baseDelayMs: 0, multiplier: 1, maxDelayMs: 0, outcomes: ['success'], retryableErrors: [] };
    }
    const zip = await JSZip.loadAsync(await renderPptx(await buildPack(draft)));
    for (const name of parts(zip, /^ppt\/charts\/chart\d+\.xml$/)) {
      assert.deepEqual(valueAxis(await part(zip, name)), { min: 0, max: 1, majorUnit: engine === 'retry' ? 1 : 0.2 });
    }
  }
  const fractions = createDraft('compound');
  for (const scenario of fractions.scenarios) {
    scenario.input = { principal: '0.015', rates: ['0'], cashflows: ['0'], timing: 'end' };
  }
  const zip = await JSZip.loadAsync(await renderPptx(await buildPack(fractions)));
  for (const name of parts(zip, /^ppt\/charts\/chart\d+\.xml$/)) {
    assert.deepEqual(valueAxis(await part(zip, name)), { min: 0, max: 0.02, majorUnit: 0.01 });
  }
});

test('source-only scenarios have no invented numeric chart, including an empty material selection', async () => {
  const draft = createDraft('evidence');
  draft.scenarios[0]!.input = { evidenceIds: [] };
  delete draft.narrative.slides[2]!.visual;
  const zip = await JSZip.loadAsync(await renderPptx(await buildPack(draft)));
  assert.equal(parts(zip, /^ppt\/charts\/chart\d+\.xml$/).length, 0);
  const visible = plainText(await part(zip, 'ppt/slides/slide3.xml'));
  assert.ok(visible.includes(draft.narrative.slides[2]!.body));
  assert.doesNotMatch(visible, /当前案例未选择材料|所选材料数|来源阅读|非因果模拟/);
  assert.match(plainText(await part(zip, 'ppt/notesSlides/notesSlide3.xml')), /"evidenceIds": \[\]/);
});

test('older Packs do not require optional explanation or research fields', async () => {
  const draft = createDraft('retry');
  delete draft.brief.explanation;
  delete draft.research;
  draft.narrative.slides.pop();
  const zip = await JSZip.loadAsync(await renderPptx(await buildPack(draft)));
  assert.equal(parts(zip, /^ppt\/slides\/slide\d+\.xml$/).length, 5);
});

test('speaker notes retain full source identity, research gaps and limitations', async () => {
  const draft = createDraft('retry');
  draft.evidence[0]!.retrievedAt = '2026-09-10';
  draft.evidence[0]!.contentHash = 'a'.repeat(64);
  draft.evidence[0]!.url = 'https://example.invalid/model?version=1';
  draft.research = {
    question: draft.brief.question, kind: 'provided',
    queries: [{ query: 'provided model rules', purpose: 'Check the provided basis.' }],
    findings: [{ claimId: 'rule', evidenceIds: ['rules'], assessment: 'supported', rationale: 'Only under the stated model assumptions.' }],
    gaps: ['No real execution evidence.'], stopReason: 'The model-only scope is explicit.',
  };
  const pack = await buildPack(draft);
  const zip = await JSZip.loadAsync(await renderPptx(pack));
  const xml = await part(zip, 'ppt/notesSlides/notesSlide3.xml');
  const notes = plainText(xml);
  assert.match(xml, /lang="zh-CN"/);
  assert.ok(notes.includes('2026-09-10'));
  assert.ok(notes.includes('a'.repeat(64)));
  assert.ok(notes.includes(draft.evidence[0]!.url!));
  assert.ok(notes.includes(JSON.stringify(draft.research, null, 2)));
  for (const limitation of draft.claims[0]!.limitations) assert.ok(notes.includes(limitation));
  for (const assumption of draft.modelSpec.assumptions) assert.ok(notes.includes(assumption));
});

test('eight-slide Packs remain eight slides without table auto-pagination', async () => {
  const draft = createDraft('retry');
  draft.narrative.slides.push(
    { id: 'review-one', title: '核对规则', body: '回到规则。', notes: '', claimIds: ['rule'] },
    { id: 'review-two', title: '核对边界', body: '回到适用范围。', notes: '', claimIds: [] },
  );
  const zip = await JSZip.loadAsync(await renderPptx(await buildPack(draft)));
  assert.equal(parts(zip, /^ppt\/slides\/slide\d+\.xml$/).length, 8);
});

test('hostile text is XML-escaped, source links are HTTP(S)-only, and no assets are fetched', async () => {
  const draft = createDraft('evidence');
  const hostile = '<a:t>注入</a:t> & "quoted"';
  draft.brief.topic = hostile;
  draft.narrative.slides[0]!.title = hostile;
  draft.narrative.slides[0]!.body = hostile;
  draft.narrative.slides[0]!.notes = hostile;
  draft.evidence[0]!.title = hostile;
  draft.evidence[0]!.summary = hostile;
  draft.evidence[0]!.url = 'https://example.invalid/material?x=1&y=%22';
  const pack = await buildPack(draft);
  const zip = await JSZip.loadAsync(await renderPptx(pack));
  for (const name of ['docProps/core.xml', 'ppt/slides/slide1.xml', 'ppt/notesSlides/notesSlide1.xml']) {
    const xml = await part(zip, name);
    assert.doesNotMatch(xml, /<a:t>注入<\/a:t>/);
    assert.ok(xml.includes('&lt;a:t&gt;注入&lt;/a:t&gt;'));
  }
  assert.ok(plainText(await part(zip, 'ppt/slides/slide1.xml')).includes(hostile));
  assert.ok(plainText(await part(zip, 'ppt/notesSlides/notesSlide1.xml')).includes(hostile));
  const rel = await part(zip, 'ppt/slides/_rels/slide1.xml.rels');
  assert.match(rel, /https:\/\/example\.invalid\/material\?x=1&amp;y=%22/);
  assert.doesNotMatch(rel, /relationships\/image/);
  for (const url of ['javascript:alert(1)', 'file:///private', 'https://user:password@example.invalid/']) {
    pack.evidence[0]!.url = url;
    const unsafe = await JSZip.loadAsync(await renderPptx(pack));
    const relationships = await part(unsafe, 'ppt/slides/_rels/slide1.xml.rels');
    assert.doesNotMatch(relationships, /javascript:|file:|user:password/);
  }
});

test('visible overflow is refused without silent truncation or tiny text', async () => {
  const cases = [
    (pack: Awaited<ReturnType<typeof createExample>>) => { pack.narrative.slides[0]!.title = '题'.repeat(81); },
    (pack: Awaited<ReturnType<typeof createExample>>) => { pack.narrative.slides[0]!.body = '文'.repeat(301); },
    (pack: Awaited<ReturnType<typeof createExample>>) => { pack.narrative.slides[0]!.body = 'a\n'.repeat(20); },
    (pack: Awaited<ReturnType<typeof createExample>>) => { pack.evidence[0]!.title = '据'.repeat(4000); },
    (pack: Awaited<ReturnType<typeof createExample>>) => {
      delete pack.narrative.slides[2]!.visual;
      pack.evidence[0]!.summary = '料'.repeat(4000);
    },
  ];
  for (const mutate of cases) {
    const pack = await createExample('evidence');
    mutate(pack);
    await assert.rejects(renderPptx(pack), error => {
      assert.ok(error instanceof AhaError);
      assert.equal(error.code, 'PPTX_CONTENT_LIMIT');
      assert.match(error.message, /Shorten the narrative or source caption/);
      assert.match(error.message, /No factual text was truncated/);
      return true;
    });
  }
  const invalid = await createExample('retry');
  invalid.narrative.slides[0]!.notes = 'bad\u0000XML';
  await assert.rejects(renderPptx(invalid), error => error instanceof AhaError && error.code === 'PPTX_TEXT_INVALID');
});

test('large balances fail instead of silently rounding native chart data', async () => {
  const draft = createDraft('compound');
  draft.scenarios[0]!.input = {
    principal: '999999999999', rates: ['1000', '1000', '1000', '1000'],
    cashflows: ['0', '0', '0', '0'], timing: 'end',
  };
  const pack = await buildPack(draft);
  await assert.rejects(renderPptx(pack), error => error instanceof AhaError && error.code === 'PPTX_NUMBER_RANGE');
});

test('shared scale validation rejects unsafe values even in cases not shown as slides', async () => {
  const draft = createDraft('compound');
  draft.scenarios.push({
    id: 'unshown-unsafe', title: 'Unsafe saved case', mode: 'derived-model', claimIds: ['rule'],
    input: {
      principal: '999999999999', rates: ['1000', '1000', '1000', '1000'],
      cashflows: ['0', '0', '0', '0'], timing: 'end',
    },
  });
  await assert.rejects(renderPptx(await buildPack(draft)), error => error instanceof AhaError && error.code === 'PPTX_NUMBER_RANGE');
  const negative = await createExample('compound');
  negative.traces[0]!.initialState.balance = '-0.01';
  await assert.rejects(renderPptx(negative), error => error instanceof AhaError && error.code === 'PPTX_NUMBER_RANGE');
  const nonfinite = await createExample('retry');
  nonfinite.traces[0]!.initialState.totalDelayMs = Infinity;
  await assert.rejects(renderPptx(nonfinite), error => error instanceof AhaError && error.code === 'PPTX_NUMBER_RANGE');
});
