import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import { stateAt } from '../core/engine.js';
import { fail } from '../core/errors.js';
import type { Claim, Evidence, Pack, Scenario, State, TeachingVisual, Trace } from '../core/schema.js';
import { readerConditions, readerSources, sourceLabel, teachingVisual, type LearningPage } from './learning.js';
import { fieldLabel, reasonLabel, safeSourceUrl, valueLabel } from './presentation.js';
import { renderTeachingScene } from './pptx-teaching.js';
import { teachingCheck } from '../core/teaching.js';

// PptxGenJS 4 publishes a CommonJS declaration with an ESM runtime entry.
const Presentation = 'default' in PptxGenJS ? PptxGenJS.default : PptxGenJS;
type Deck = InstanceType<typeof Presentation>;
type Slide = ReturnType<Deck['addSlide']>;
type TextOptions = NonNullable<Parameters<Slide['addText']>[1]>;
type Box = { x: number; y: number; w: number; h: number };
type ValueAxis = { min: number; max: number; majorUnit: number };
type Context = {
  page: LearningPage;
  path: string;
  claims: Claim[];
  sources: Evidence[];
  conditions: string[];
  visual?: TeachingVisual;
  scenario?: Scenario;
  trace?: Trace;
  step?: number;
};

const WIDTH = 13.333333;
const HEIGHT = 7.5;
const FONT = 'Microsoft YaHei';
const COLORS = { cream: 'F7F4EF', white: 'FFFFFF', ink: '242424', muted: '5C5C5C', rose: 'B11F4B', soft: 'F6E7EC' };
const LEFT = 0.55;
const BODY_WIDTH = 12.23;
const FOOTER_BOTTOM = 6.8;
const SOURCE_SIZE = 14;
const wordSegmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('zh-CN', { granularity: 'word' }) : undefined;
const graphemeSegmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('zh-CN', { granularity: 'grapheme' }) : undefined;
const NO_LINE_START = /^[、。，．？！：；）》」』】〕〉〗〙〛’”!?%,.:;\])}]/u;
const NO_LINE_END = /[（《「『【〔〈〖〘〚‘“([{]$/u;

function contentLimit(message: string, path: string): never {
  fail('PPTX_CONTENT_LIMIT', `${message} Shorten the narrative or source caption in the Aha skill; keep 1–12 slides. No factual text was truncated.`, path);
}

function budget(text: string, maximum: number, path: string): void {
  if ([...text].length > maximum) contentLimit(`PPTX text exceeds ${maximum} characters.`, path);
}

function xmlText(value: unknown, path = ''): void {
  if (typeof value === 'string') {
    for (const character of value) {
      const code = character.codePointAt(0)!;
      if ((code < 32 && ![9, 10, 13].includes(code)) || (code >= 0xd800 && code <= 0xdfff) || code === 0xfffe || code === 0xffff) {
        fail('PPTX_TEXT_INVALID', 'Text contains a character that XML 1.0 cannot preserve.', path || '/');
      }
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => xmlText(item, `${path}/${index}`));
  } else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      xmlText(key, path);
      xmlText(item, `${path}/${key}`);
    }
  }
}

function wrappedLines(text: string, width: number, size: number, widthUsage = 0.85): string[] {
  // Legacy slides reserve 15% horizontal slack; teaching layouts use 8% with the same font floor.
  const capacity = width * 72 / size * widthUsage;
  const units = (char: string) => char === '\t' ? 2.4 : /[\u0020-\u007e]/.test(char) ? 0.62 : 1;
  return text.split(/\r\n|\r|\n/).flatMap(line => {
    if (!line) return [''];
    const characters = graphemeSegmenter
      ? [...graphemeSegmenter.segment(line)].map(item => item.segment) : [...line];
    const wordEnds = new Set(wordSegmenter
      ? [...wordSegmenter.segment(line)].map(item => item.index + item.segment.length) : []);
    let offset = 0;
    const preferred = characters.map((character, index) => {
      offset += character.length;
      // Commands, identifiers and exact decimal values remain whole unless wider than a line.
      const insideAscii = /[\u0021-\u007e]$/.test(character) && /^[\u0021-\u007e]/.test(characters[index + 1] ?? '');
      return !insideAscii && (!wordSegmenter || wordEnds.has(offset));
    });
    const legal = (end: number) => !NO_LINE_END.test(characters.slice(0, end).join('').trimEnd())
      && !NO_LINE_START.test(characters.slice(end).join('').trimStart());
    const lines: string[] = [];
    for (let start = 0; start < characters.length;) {
      let end = start;
      let used = 0;
      while (end < characters.length) {
        const next = [...characters[end]!].reduce((sum, character) => sum + units(character), 0);
        if (used + next > capacity) break;
        used += next;
        end++;
      }
      if (end === characters.length) { lines.push(characters.slice(start).join('')); break; }
      let split = end;
      while (split > start && !(legal(split) && preferred[split - 1])) split--;
      if (split === start) {
        split = end;
        while (split > start && !legal(split)) split--;
      }
      // An indivisible cluster/punctuation sequence cannot fit: fail the normal layout budget, never drop it.
      if (split === start) contentLimit('An indivisible text cluster cannot fit at a readable size.', '/narrative');
      lines.push(characters.slice(start, split).join(''));
      start = split;
    }
    return lines;
  });
}

function textHeight(text: string, width: number, size: number, widthUsage = 0.85): number {
  return wrappedLines(text, width, size, widthUsage).length * size * 1.3 / 72 + 0.02;
}

function fits(text: string, box: Box, size: number, path: string, widthUsage = 0.85): void {
  if (box.w <= 0 || box.h <= 0 || textHeight(text, box.w, size, widthUsage) > box.h + 0.002) {
    contentLimit('PPTX text does not fit its fixed, readable layout.', path);
  }
}

function text(slide: Slide, value: string, box: Box, path: string, options: TextOptions = {}, widthUsage = 0.85): void {
  const size = options.fontSize ?? 20;
  fits(value, box, size, path, widthUsage);
  slide.addText(value, {
    ...box, fontFace: FONT, fontSize: size, lang: 'zh-CN',
    color: COLORS.ink, margin: 0, breakLine: false, valign: 'top', paraSpaceAfter: 0, paraSpaceBefore: 0,
    ...options,
  });
}

function wrappedText(slide: Slide, value: string, box: Box, path: string, options: TextOptions, widthUsage = 0.85): void {
  const size = options.fontSize ?? 20;
  // PptxGenJS writes each newline as a separate DrawingML paragraph; do not rely on viewer word wrapping.
  text(slide, wrappedLines(value, box.w, size, widthUsage).join('\n'), box, path, {
    ...options, wrap: false, lineSpacing: size * 1.3,
  }, widthUsage);
}

function panel(deck: Deck, slide: Slide, box: Box, color = COLORS.white): void {
  slide.addShape(deck.ShapeType.roundRect, {
    ...box, rectRadius: 0.15,
    fill: { color }, line: { color, transparency: 100 },
  });
}

function context(pack: Pack, page: LearningPage, index: number): Context {
  const path = `/narrative/slides/${index}`;
  budget(page.title, 80, `${path}/title`);
  budget(page.body, 300, `${path}/body`);
  const visual = teachingVisual(pack, page);
  const claims = [...new Set([...page.claimIds, ...(visual?.claimIds ?? [])])].map(id => {
    const claim = pack.claims.find(item => item.id === id);
    if (!claim) fail('REFERENCE_UNKNOWN', `Unknown claim ${id}.`, `${path}/claimIds`);
    return claim;
  });
  const scenario = page.scenarioId === undefined ? undefined : pack.scenarios.find(item => item.id === page.scenarioId);
  const trace = scenario ? pack.traces.find(item => item.scenarioId === scenario.id) : undefined;
  if (page.scenarioId !== undefined && (!scenario || !trace)) {
    fail('NARRATIVE_REFERENCE', 'PPTX slide requires its saved scenario and trace.', `${path}/scenarioId`);
  }
  const sceneSources = new Set(claims.flatMap(claim => claim.evidenceIds));
  if (page.scene && pack.teaching) pack.teaching.basis.evidenceIds.forEach(id => sceneSources.add(id));
  const sources = page.scene ? pack.evidence.filter(source => sceneSources.has(source.id)) : readerSources(pack, page);
  const selected = trace ? page.eventStep ?? trace.events.length : undefined;
  if (trace && selected !== undefined) stateAt(trace, selected);
  return {
    page, path, claims, sources, conditions: page.scene
      ? [...new Set([...(index === 0 ? pack.brief.explanation?.conditions ?? [] : []), ...(page.conditions ?? [])])]
      : readerConditions(pack, page),
    ...(visual ? { visual } : {}), ...(scenario && trace ? { scenario, trace, step: selected! } : {}),
  };
}

function footer(slide: Slide, sources: Evidence[], path: string): number {
  if (!sources.length) return FOOTER_BOTTOM;
  const captions = sources.map(source => {
    const title = sourceLabel(source);
    // A complete bibliographic heading can stand alone; retain subtitles in the link tooltip and notes.
    const heading = title.split(/\s+[—–|]\s+|:\s+|\r\n|\r|\n/)[0]!.trim();
    return [...title].length > 80 && [...heading].length >= 8 ? heading : title;
  });
  const labels = captions.map((caption, index) =>
    captions.some((other, otherIndex) => otherIndex !== index && other === caption
      && sources[otherIndex]!.title !== sources[index]!.title) ? sourceLabel(sources[index]!) : caption);
  // Multiline captions get wide columns; short labels can share a row without stealing teaching space.
  const candidates = Array.from({ length: Math.min(4, sources.length) }, (_value, index) => {
    const columns = index + 1;
    const width = (BODY_WIDTH - (columns - 1) * 0.3) / columns;
    const rows = Array.from({ length: Math.ceil(sources.length / columns) }, (_row, row) =>
      Math.max(...labels.slice(row * columns, (row + 1) * columns).map(label => textHeight(label, width, SOURCE_SIZE))));
    return { columns, width, rows, height: rows.reduce((sum, height) => sum + height, 0) + (rows.length - 1) * 0.1 };
  }).filter(candidate => sources.length > 4 || candidate.columns <= 2
    || labels.every(label => wrappedLines(label, candidate.width, SOURCE_SIZE).length === 1))
    .sort((a, b) => a.height - b.height);
  const layout = candidates[0]!;
  const top = FOOTER_BOTTOM - layout.height;
  if (top < 1.5) contentLimit('Source citations leave no readable space for the explanation.', `${path}/sources`);
  sources.forEach((source, index) => {
    const row = Math.floor(index / layout.columns);
    const box = {
      x: LEFT + (index % layout.columns) * (layout.width + 0.3),
      y: top + layout.rows.slice(0, row).reduce((sum, height) => sum + height + 0.1, 0),
      w: layout.width, h: layout.rows[row]!,
    };
    const url = safeSourceUrl(source.url);
    wrappedText(slide, labels[index]!, box, `${path}/sources/${source.id}/title`, {
      fontSize: SOURCE_SIZE, color: COLORS.muted,
      ...(url ? { hyperlink: { url, tooltip: source.title } } : {}),
      objectName: `Aha source ${index + 1}`,
    });
  });
  return top;
}

function header(slide: Slide, pack: Pack, item: Context, index: number): number {
  if (pack.manifest.visibility === 'private') {
    text(slide, '私密', { x: 1.5, y: 0.51, w: 1, h: 0.35 }, item.path,
      { fontSize: 18, color: COLORS.rose, objectName: 'Aha confidentiality' });
  }
  text(slide, `${index + 1} / ${pack.narrative.slides.length}`, { x: 11.4, y: 0.51, w: 1.38, h: 0.35 },
    item.path, { fontSize: 18, align: 'right', color: COLORS.muted, objectName: 'Aha slide number' });
  const titleSize = item.page.scene && textHeight(item.page.title, BODY_WIDTH, 36) < 0.7 ? 36 : 32;
  const height = textHeight(item.page.title, BODY_WIDTH, titleSize);
  text(slide, item.page.title, { x: LEFT, y: 1, w: BODY_WIDTH, h: height }, `${item.path}/title`,
    { fontSize: titleSize, bold: true, objectName: 'Aha title' });
  return 1 + height + 0.18;
}

function conditions(deck: Deck, slide: Slide, item: Context, bottom: number): number {
  const values = item.conditions.filter(condition => !item.page.body.includes(condition));
  if (!values.length) return bottom;
  const caption = values.join(' ');
  if (item.page.scene) {
    const height = textHeight(caption, BODY_WIDTH, 18);
    wrappedText(slide, caption, { x: LEFT, y: bottom - height, w: BODY_WIDTH, h: height },
      `${item.path}/conditions`, { fontSize: 18, color: COLORS.muted, objectName: 'Aha reader conditions' });
    return bottom - height - 0.14;
  }
  const height = textHeight(caption, BODY_WIDTH - 0.4, 18) + 0.24;
  const top = bottom - height;
  if (top < 1.5) contentLimit('Reader conditions leave no readable space for the explanation.', `${item.path}/conditions`);
  panel(deck, slide, { x: LEFT, y: top, w: BODY_WIDTH, h: height }, COLORS.soft);
  wrappedText(slide, caption, { x: LEFT + 0.2, y: top + 0.12, w: BODY_WIDTH - 0.4, h: height - 0.24 },
    `${item.path}/conditions`, { fontSize: 18, objectName: 'Aha reader conditions' });
  return top - 0.2;
}

function chartValues(trace: Trace, path: string): { states: State[]; values: number[]; metric: string } {
  const states = [trace.initialState, ...trace.events.map(event => event.stateAfter)];
  const key = trace.engine === 'compound' ? 'balance' : 'totalDelayMs';
  const values = states.map((state, index) => {
    const original = state[key];
    const value = Number(original);
    if (trace.engine === 'compound') {
      if (typeof original !== 'string' || !/^-?(?:0|[1-9][0-9]*)\.[0-9]{2}$/.test(original)
        || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER / 100
        || value.toFixed(2) !== original) {
        fail('PPTX_NUMBER_RANGE', 'Balance must be nonnegative and faithfully representable in a native chart at two decimal places; use a smaller model input.', `${path}/states/${index}/balance`);
      }
    } else if (typeof original !== 'number' || !Number.isSafeInteger(value) || value < 0) {
      fail('PPTX_NUMBER_RANGE', 'Planned wait must be a finite, nonnegative safe integer in milliseconds.', `${path}/states/${index}/totalDelayMs`);
    }
    return value;
  });
  return { states, values, metric: trace.engine === 'compound' ? '余额（金额单位；显示到两位小数）' : '累计计划等待（ms；非实测耗时）' };
}

function sharedValueAxis(pack: Pack): ValueAxis {
  let peak = 0;
  pack.traces.forEach((trace, index) => {
    if (trace.engine === 'evidence') return;
    for (const value of chartValues(trace, `/traces/${index}`).values) peak = Math.max(peak, value);
  });
  const magnitude = 10 ** Math.floor(Math.log10(peak || 1));
  const max = peak === 0 ? 1 : [1, 2, 5, 10].map(factor => factor * magnitude).find(bound => bound >= peak)
    ?? fail('PPTX_NUMBER_RANGE', 'Cannot select a finite shared chart scale.', '/traces');
  return { min: 0, max, majorUnit: Math.max(pack.modelSpec.engine === 'retry' ? 1 : 0.01, max / 5) };
}

function selectedTable(slide: Slide, trace: Trace, step: number, box: Box, path: string): void {
  const state = stateAt(trace, step);
  const rows = Object.entries(state).map(([key, value]) => [
    key === 'balance' ? '余额（金额单位）' : fieldLabel(key),
    valueLabel(value),
  ]);
  if (rows.length > 3) contentLimit('Selected state supports at most three rows.', path);
  rows.forEach((row, index) => row.forEach((cell, column) => {
    budget(cell, 96, `${path}/state/${index}/${column}`);
    fits(cell, { x: 0, y: 0, w: column === 0 ? 2.3 : 2.02, h: 0.69 }, 18, `${path}/state/${index}/${column}`);
  }));
  text(slide, `第 ${step} 步，共 ${trace.events.length} 步`, { x: box.x + 0.22, y: box.y + 0.15, w: 4.27, h: 0.4 }, path,
    { fontSize: 20, bold: true });
  slide.addTable(rows.map(row => row.map(cell => ({ text: cell }))), {
    x: box.x + 0.16, y: box.y + 0.64, w: 4.38, h: rows.length * 0.7, colW: [2.3, 2.08],
    rowH: 0.7, autoPage: false, fontFace: FONT, fontSize: 18, lang: 'zh-CN',
    margin: 0, color: COLORS.ink, fill: { color: COLORS.white }, border: { type: 'solid', color: COLORS.soft, pt: 0.5 },
    valign: 'middle', objectName: 'Aha selected state',
  });
}

function numericCase(deck: Deck, slide: Slide, item: Context, area: Box, reversed: boolean, axis: ValueAxis): void {
  const { trace, step = 0, path } = item;
  if (!trace) return;
  if (area.h < 2.87) contentLimit('Numeric chart, exact values and reader conditions require more space.', path);
  const data = chartValues(trace, path);
  const chartX = reversed ? 5.62 : LEFT;
  const stateX = reversed ? LEFT : 8.08;
  const stateBox = { x: stateX, y: area.y, w: 4.7, h: area.h };
  panel(deck, slide, stateBox);
  selectedTable(slide, trace, step, stateBox, path);
  text(slide, data.metric, { x: chartX, y: area.y + 0.03, w: 7.15, h: 0.38 }, path, { fontSize: 18, color: COLORS.rose });
  slide.addChart(deck.ChartType.line, [{
    name: trace.engine === 'compound' ? '余额（金额单位）' : '累计计划等待（ms）',
    labels: data.states.map((_state, index) => String(index)), values: data.values,
  }], {
    x: chartX, y: area.y + 0.5, w: 7.15, h: area.h - 0.5, lang: 'zh-CN', showLegend: false,
    showTitle: false, showValue: false,
    chartColors: [COLORS.rose], chartArea: { fill: { color: COLORS.cream } },
    plotArea: { fill: { color: COLORS.cream } },
    lineSize: 3, lineSmooth: false, lineDataSymbol: 'circle', lineDataSymbolSize: 5,
    catAxisLabelFontFace: FONT, catAxisLabelFontSize: 18, catAxisLabelColor: COLORS.muted,
    catAxisLabelFrequency: String(Math.max(1, Math.ceil(data.values.length / 6))),
    showCatAxisTitle: true, catAxisTitle: '步骤', catAxisTitleFontFace: FONT, catAxisTitleFontSize: 18,
    valAxisLabelFontFace: FONT, valAxisLabelFontSize: 18, valAxisLabelColor: COLORS.muted,
    valAxisLabelFormatCode: trace.engine === 'compound' ? '0.00' : '0',
    valAxisMinVal: axis.min, valAxisMaxVal: axis.max, valAxisMajorUnit: axis.majorUnit,
    valGridLine: { color: 'DEDEDE', size: 0.5 }, catGridLine: { style: 'none' },
  });
}

function knowledgeVisual(deck: Deck, slide: Slide, visual: TeachingVisual, area: Box, path: string, baseline = area.y): number {
  const titleHeight = textHeight(visual.title, area.w, 20);
  let top = area.y + titleHeight + 0.16;
  if (visual.layout === 'steps') {
    const labelWidth = 2.8;
    const bodyWidth = area.w - 4.05;
    const heights = visual.items.map(item =>
      Math.max(0.4, textHeight(item.label, labelWidth, 18), textHeight(item.body, bodyWidth, 18)) + 0.18);
    const height = titleHeight + 0.16 + heights.reduce((sum, value) => sum + value, 0) + (heights.length - 1) * 0.1;
    if (height <= area.h) {
      text(slide, visual.title, { x: area.x, y: area.y, w: area.w, h: titleHeight }, `${path}/title`,
        { fontSize: 20, bold: true, color: COLORS.rose, objectName: 'Aha teaching title' });
      let y = top;
      visual.items.forEach((item, index) => {
        const rowHeight = heights[index]!;
        panel(deck, slide, { x: area.x, y, w: area.w, h: rowHeight });
        slide.addShape(deck.ShapeType.ellipse, {
          x: area.x + 0.18, y: y + 0.09, w: 0.4, h: 0.4,
          fill: { color: COLORS.rose }, line: { color: COLORS.rose, transparency: 100 },
        });
        text(slide, String(index + 1), { x: area.x + 0.18, y: y + 0.11, w: 0.4, h: 0.36 }, path,
          { fontSize: 18, color: COLORS.white, align: 'center', objectName: `Aha teaching step ${index + 1}` });
        text(slide, item.label, { x: area.x + 0.83, y: y + 0.09, w: labelWidth, h: rowHeight - 0.18 }, `${path}/items/${index}/label`,
          { fontSize: 18, bold: true, objectName: `Aha teaching label ${index + 1}` });
        text(slide, item.body, { x: area.x + 3.85, y: y + 0.09, w: bodyWidth, h: rowHeight - 0.18 }, `${path}/items/${index}/body`,
          { fontSize: 18, objectName: `Aha teaching body ${index + 1}` });
        y += rowHeight + 0.1;
      });
      return height;
    }
  }
  // Short multiline steps can use horizontal lanes when vertical rows would crowd the caveats.
  const steps = visual.layout === 'steps';
  const labelSize = steps ? 18 : 20;
  const badgeWidth = steps ? 0.57 : 0;
  const labelHeight = (item: TeachingVisual['items'][number], width: number) =>
    Math.max(steps ? 0.4 : 0, textHeight(item.label, width - 0.46 - badgeWidth, labelSize));
  const options = [...new Set([visual.items.length === 4 ? 2 : visual.items.length, 2, visual.items.length])];
  const layout = options.map(columns => {
    const width = (area.w - (columns - 1) * 0.3) / columns;
    const heights = visual.items.map(item =>
      Math.max(1.5, labelHeight(item, width) + 0.12 + textHeight(item.body, width - 0.46, 18) + 0.46));
    const rows = Array.from({ length: Math.ceil(heights.length / columns) }, (_row, row) =>
      Math.max(...heights.slice(row * columns, (row + 1) * columns)));
    return { columns, width, rows, height: titleHeight + 0.16 + rows.reduce((sum, value) => sum + value, 0) + (rows.length - 1) * 0.2 };
  }).find(candidate => candidate.height <= area.h);
  if (!layout) contentLimit(`Teaching ${visual.layout} and reader conditions do not fit at readable sizes.`, path);
  const shift = Math.max(0, baseline - top);
  // Align comparable card panels only when the full measured content still fits.
  const offset = !steps && layout.height + shift <= area.h ? shift : 0;
  top += offset;
  text(slide, visual.title, { x: area.x, y: area.y + offset, w: area.w, h: titleHeight }, `${path}/title`,
    { fontSize: 20, bold: true, color: COLORS.rose, objectName: 'Aha teaching title' });
  visual.items.forEach((item, index) => {
    const row = Math.floor(index / layout.columns);
    const x = area.x + (index % layout.columns) * (layout.width + 0.3);
    const y = top + layout.rows.slice(0, row).reduce((sum, value) => sum + value + 0.2, 0);
    const headingHeight = labelHeight(item, layout.width);
    panel(deck, slide, { x, y, w: layout.width, h: layout.rows[row]! });
    if (steps) {
      slide.addShape(deck.ShapeType.ellipse, {
        x: x + 0.23, y: y + 0.23, w: 0.4, h: 0.4,
        fill: { color: COLORS.rose }, line: { color: COLORS.rose, transparency: 100 },
      });
      text(slide, String(index + 1), { x: x + 0.23, y: y + 0.25, w: 0.4, h: 0.36 }, path,
        { fontSize: 18, color: COLORS.white, align: 'center', objectName: `Aha teaching step ${index + 1}` });
    }
    text(slide, item.label, { x: x + 0.23 + badgeWidth, y: y + 0.23, w: layout.width - 0.46 - badgeWidth, h: headingHeight }, `${path}/items/${index}/label`,
      { fontSize: labelSize, bold: true, objectName: `Aha teaching label ${index + 1}` });
    text(slide, item.body, {
      x: x + 0.23, y: y + 0.23 + headingHeight + 0.12, w: layout.width - 0.46,
      h: layout.rows[row]! - headingHeight - 0.58,
    }, `${path}/items/${index}/body`, { fontSize: 18, objectName: `Aha teaching body ${index + 1}` });
  });
  return layout.height + offset;
}

function statement(deck: Deck, slide: Slide, pack: Pack, item: Context, index: number, area: Box): void {
  const selectedIds = item.scenario && 'evidenceIds' in item.scenario.input ? item.scenario.input.evidenceIds : [];
  const selected = item.sources.filter(source => selectedIds.includes(source.id));
  if (selected.length) {
    let y = area.y;
    for (const source of selected) {
      const height = textHeight(source.summary, area.w - 0.46, 20) + 0.46;
      if (y + height > area.y + area.h) contentLimit('Source explanations do not fit at a readable size.', `${item.path}/sources/${source.id}/summary`);
      panel(deck, slide, { x: area.x, y, w: area.w, h: height });
      text(slide, source.summary, { x: area.x + 0.23, y: y + 0.23, w: area.w - 0.46, h: height - 0.46 },
        `${item.path}/sources/${source.id}/summary`, { fontSize: 20, objectName: 'Aha source explanation' });
      y += height + 0.2;
    }
  } else if (index === 0 && pack.brief.explanation) {
    panel(deck, slide, area, COLORS.rose);
    text(slide, pack.brief.explanation.takeaway,
      { x: area.x + 0.35, y: area.y + 0.3, w: area.w - 0.7, h: area.h - 0.6 },
      '/brief/explanation/takeaway', { fontSize: 28, bold: true, color: COLORS.white, objectName: 'Aha takeaway' });
  }
}

function notes(pack: Pack, item: Context): string {
  const selected = item.trace ? stateAt(item.trace, item.step!) : undefined;
  const event = item.trace && item.step ? item.trace.events[item.step - 1] : undefined;
  const result = [
    ...(pack.teaching && item.page.scene?.kind === 'answer' ? (() => {
      const check = teachingCheck(pack.teaching, item.page.scene.checkId!);
      const answer = check.choices.findIndex(choice => choice.id === check.correctChoiceId);
      return [
        '本页练习 · 答案与完整解析', check.question,
        `答案 ${String.fromCharCode(65 + answer)}：${check.choices[answer]!.text}`,
        ...check.choices.map((choice, index) =>
          `${String.fromCharCode(65 + index)}｜${choice.text}\n${choice.feedback}`),
        '—— 以下为来源与审阅记录 ——',
      ];
    })() : []),
    'Aha Pack — 完整来源、输入与限制；原文保留',
    `PackHash: ${pack.manifest.contentHash}`,
    `PackId: ${pack.manifest.packId}; revision: ${pack.manifest.revision}; visibility: ${pack.manifest.visibility}; language: ${pack.brief.language}`,
    '原始讲解备注：', item.page.notes,
    '原始叙事页：', JSON.stringify(item.page, null, 2),
    '问题、读者、范围与解释边界：', JSON.stringify(pack.brief, null, 2),
    '模型规则、版本与假设：', JSON.stringify(pack.modelSpec, null, 2),
    '本页完整主张、适用范围、假设与限制：', JSON.stringify(item.claims, null, 2),
    '本页引用来源（可见页脚仅显示标题与安全链接）：', JSON.stringify(item.sources, null, 2),
    '来源完整元数据：', JSON.stringify(pack.evidence, null, 2),
    ...(pack.research ? ['研究记录：', JSON.stringify(pack.research, null, 2)] : []),
    ...(pack.teaching ? ['来源支持的状态教学（不是实时执行记录）：', JSON.stringify(pack.teaching, null, 2)] : []),
    ...(item.scenario && item.trace ? [
      '当前案例与实际输入：', JSON.stringify(item.scenario, null, 2),
      `选中步骤：${item.step} / ${item.trace.events.length}`,
      '选中状态（原始精确值）：', JSON.stringify(selected, null, 2),
      `事件原因：${event ? reasonLabel(event.details.reasonCode ?? event.kind) : '初始状态，尚未发生事件'}`,
      ...(event?.kind === 'retry-scheduled' ? ['该步骤记录安排等待的逻辑时刻；累计计划等待包含新安排的等待，不是实测耗时。'] : []),
      item.trace.engine === 'evidence' ? '完整保存的来源选择记录（无数值图表）：'
        : '完整保存轨迹（图表使用原始 balance 两位小数显示值或 totalDelayMs 毫秒；exactBalance 分数不转换）：',
      JSON.stringify(item.trace, null, 2),
    ] : []),
  ].join('\n');
  budget(result, 180000, `${item.path}/notes`);
  return result;
}

/**
 * 16:9 design contract: editable text/shapes/charts/tables, body >=18pt,
 * title 32pt, source labels 14pt. Reader conditions reserve space before content.
 * Explicit qualifier/citation wraps preserve words and punctuation; comparable cards share a baseline when space permits.
 * Numeric charts share one explicit zero-based scale covering all saved traces.
 * Layout-specific fit checks reject overflow; full audit metadata stays in notes.
 * Accepts an already validated Pack and performs no file or network I/O.
 */
export async function renderPptx(pack: Pack): Promise<Uint8Array> {
  xmlText(pack);
  if (pack.narrative.slides.length < 1 || pack.narrative.slides.length > 12) {
    contentLimit('PPTX requires 1–12 narrative slides.', '/narrative/slides');
  }
  const axis = sharedValueAxis(pack);
  const deck = new Presentation();
  deck.defineLayout({ name: 'AHA_WIDE', width: WIDTH, height: HEIGHT });
  deck.layout = 'AHA_WIDE';
  deck.author = 'Aha';
  deck.company = 'Aha';
  deck.title = pack.brief.topic;
  deck.subject = `PackHash: ${pack.manifest.contentHash}`;
  deck.revision = String(pack.manifest.revision);
  deck.theme = { headFontFace: FONT, bodyFontFace: FONT };
  deck.defineSlideMaster({
    title: 'AHA_CREAM', background: { color: COLORS.cream },
    objects: [{ text: { text: 'Aha', options: { x: 0.55, y: 0.5, w: 0.8, h: 0.36, fontFace: FONT, fontSize: 18, bold: true, color: COLORS.rose, margin: 0, lang: 'zh-CN' } } }],
  });
  const items = pack.narrative.slides.map((page, index) => context(pack, page, index));
  const comparisonKey = (visual: TeachingVisual) => JSON.stringify(visual.items.map(item => item.label));
  const baselines = new Map<string, number>();
  for (const item of items) {
    if (item.visual?.layout !== 'cards' || (item.trace && item.trace.engine !== 'evidence')) continue;
    // Long introductions keep their natural flow instead of forcing every short comparison downward.
    if (wrappedLines(item.page.body, BODY_WIDTH, 18).length > 3) continue;
    const baseline = 1 + textHeight(item.page.title, BODY_WIDTH, 32) + 0.18
      + textHeight(item.page.body, BODY_WIDTH, 18) + 0.2 + textHeight(item.visual.title, BODY_WIDTH, 20) + 0.16;
    const key = comparisonKey(item.visual);
    baselines.set(key, Math.max(baselines.get(key) ?? 0, baseline));
  }
  items.forEach((item, index) => {
    const { page } = item;
    const slide = deck.addSlide({ masterName: 'AHA_CREAM' });
    const top = header(slide, pack, item, index);
    const bottom = conditions(deck, slide, item, footer(slide, item.sources, item.path) - 0.2);
    const area = { x: LEFT, y: top, w: BODY_WIDTH, h: bottom - top };
    const numeric = item.trace && item.trace.engine !== 'evidence';
    const sourceExplanation = item.scenario && 'evidenceIds' in item.scenario.input && item.scenario.input.evidenceIds.length > 0;
    if (area.h <= 0) contentLimit('Title, citations and reader conditions leave no room for the explanation.', item.path);
    if (page.scene && pack.teaching) {
      renderTeachingScene(deck, slide, pack.teaching, page, area, item.path, {
        text: (slide, value, box, path, options) => wrappedText(slide, value, box, path, options, 0.92),
        height: (value, width, size) => textHeight(value, width, size, 0.92),
        limit: contentLimit,
      });
    } else if (numeric || item.visual || sourceExplanation || (index === 0 && pack.brief.explanation)) {
      const bodyHeight = textHeight(page.body, BODY_WIDTH, 18);
      text(slide, page.body, { ...area, h: bodyHeight }, `${item.path}/body`, { fontSize: 18, objectName: 'Aha narrative' });
      area.y += bodyHeight + 0.2;
      area.h -= bodyHeight + 0.2;
      if (area.h <= 0) contentLimit('Narrative and reader conditions leave no room for the teaching content.', item.path);
      if (item.visual) {
        const height = knowledgeVisual(deck, slide, item.visual, { ...area, h: area.h - (numeric ? 3.07 : 0) },
          `${item.path}/visual`, numeric ? undefined : baselines.get(comparisonKey(item.visual)));
        area.y += height + 0.2;
        area.h -= height + 0.2;
      }
      if (numeric) numericCase(deck, slide, item, area, index % 2 === 1, axis);
      else if (!item.visual) statement(deck, slide, pack, item, index, area);
    } else {
      panel(deck, slide, area);
      text(slide, page.body, { x: area.x + 0.35, y: area.y + 0.3, w: area.w - 0.7, h: area.h - 0.6 },
        `${item.path}/body`, { fontSize: 24, objectName: 'Aha narrative' });
    }
    slide.addNotes(notes(pack, item));
  });
  const bytes = await deck.write({ outputType: 'uint8array', compression: true });
  if (!(bytes instanceof Uint8Array)) fail('PPTX_OUTPUT', 'PptxGenJS did not return an in-memory byte array.');
  // The library has no document-language property; add standard core metadata.
  const zip = await JSZip.loadAsync(bytes);
  const core = zip.file('docProps/core.xml');
  if (!core) fail('PPTX_OUTPUT', 'PPTX core metadata is missing.');
  zip.file('docProps/core.xml', (await core.async('string')).replace('</cp:coreProperties>', '<dc:language>zh-CN</dc:language></cp:coreProperties>'));
  for (const name of Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))) {
    const xml = await zip.file(name)!.async('string');
    // Keep native shape-level citation links, without inline link boxes that some canvas viewers collapse to word width.
    zip.file(name, xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, shape => {
      if (!/name="Aha source \d+"/.test(shape)) return shape;
      return shape.replace(/<a:rPr\b[\s\S]*?<\/a:rPr>/g, run =>
        run.replace(/<a:hlinkClick\b[^>]*>[\s\S]*?<\/a:hlinkClick>|<a:hlinkClick\b[^>]*\/>/g, ''));
    }));
  }
  for (const name of Object.keys(zip.files).filter(name => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name))) {
    zip.file(name, (await zip.file(name)!.async('string')).replaceAll('lang="en-US"', 'lang="zh-CN"'));
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
