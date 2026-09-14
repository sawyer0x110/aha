import { stateAt } from '../core/engine.js';
import { teachingOutcome } from '../core/teaching.js';
import { AhaError } from '../core/errors.js';
import type { Pack, Scenario, TeachingVisual, Trace } from '../core/schema.js';
import { readerConditions, readerSources, sourceLabel } from './learning.js';
import {
  conditionsMarkup, escapeHtml, fieldLabel, resultSummaryMarkup, sourceLinksMarkup,
  takeawayMarkup, teachingVisualMarkup, valueLabel,
} from './presentation.js';
import { themeCss, themeScript } from './theme.js';
import { teachingBasis, teachingCardMarkup, teachingSceneMarkup } from './teaching-html.js';
import { teachingCss } from './teaching-theme.js';

type Snapshot = { scenario: Scenario; trace: Trace; step: number };
type Budget = { text(value: string, path: string, maximum: number, weight?: number): void; finish(): void };

function budget(kind: 'CARD' | 'SCENE', total: number): Budget {
  let used = 0;
  const fail = (path: string, limit: number, unit = '字符'): never => {
    throw new AhaError(`${kind}_CONTENT_LIMIT`,
      `${kind === 'CARD' ? '图片卡片' : '视频画面'}内容超出预算（${path}，上限 ${limit} ${unit}）。请缩短内容或拆分讲解页；不会截断文字。`, path);
  };
  return {
    text(value, path, maximum, weight = 1) {
      const size = [...value].length;
      if (size > maximum) fail(path, maximum);
      used += size * weight;
    },
    finish() { if (used > total) fail('/visible-content', total, '排版单位'); },
  };
}

function snapshot(pack: Pack, scenario: Scenario, step?: number): Snapshot {
  const trace = pack.traces.find(item => item.scenarioId === scenario.id);
  if (!trace) throw new AhaError('TRACE_MISSING', '案例缺少保存的轨迹，请重新构建解释包。', `/scenarios/${scenario.id}`);
  const selectedStep = step ?? trace.events.length;
  stateAt(trace, selectedStep);
  return { scenario, trace, step: selectedStep };
}

function validateVisual(visual: TeachingVisual | undefined, limits: Budget, scene = false): void {
  if (!visual) return;
  limits.text(visual.title, '/visual/title', 80);
  for (const [index, item] of visual.items.entries()) {
    limits.text(item.label, `/visual/items/${index}/label`, 40, 2);
    limits.text(item.body, `/visual/items/${index}/body`, scene ? 100 : 160, 2);
  }
}

function inputText(scenario: Scenario): string {
  return Object.entries(scenario.input).map(([key, value]) => `${fieldLabel(key)}：${valueLabel(value)}`).join('； ');
}

function validateSnapshots(items: Snapshot[], limits: Budget, card = false): void {
  for (const item of items) {
    limits.text(item.scenario.title, `/scenarios/${item.scenario.id}/title`, 70, card ? 4 : 1);
    const state = stateAt(item.trace, item.step);
    const keys = item.trace.engine === 'compound' ? ['balance', 'period'] : ['attempt', 'totalDelayMs', 'status'];
    for (const [index, key] of keys.entries()) {
      limits.text(String(state[key]), `/traces/${item.scenario.id}/${key}`, 36, card ? index === 0 ? 10 : 2 : 1);
    }
  }
}

function snapshotVisual(item: Snapshot, prefix: string): string {
  const { trace, step } = item;
  if (trace.engine === 'evidence') return '';
  const title = `${prefix}-visual-title`;
  const key = trace.engine === 'compound' ? 'balance' : 'totalDelayMs';
  const states = Array.from({ length: step + 1 }, (_, index) => stateAt(trace, index));
  const numbers = states.map(state => Number(state[key]));
  const maximum = Math.max(1, ...numbers);
  const points = numbers.map((value, index) => `${(32 + index / Math.max(1, step) * 856).toFixed(2)},${(126 - value / maximum * 96).toFixed(2)}`);
  return `<figure class="snapshot-visual"><figcaption id="${title}">${trace.engine === 'compound' ? '余额' : '累计计划等待'} · 第 ${step} / ${trace.events.length} 步</figcaption>
    <svg viewBox="0 0 920 170" role="img" aria-labelledby="${title}">
      <path class="axis" d="M32 18 V126 H896" fill="none"></path>
      <polyline class="line" points="${points.join(' ')}"></polyline>
      <circle class="point" cx="${(32 + (step ? 856 : 0)).toFixed(2)}" cy="${(126 - numbers[step]! / maximum * 96).toFixed(2)}" r="6"></circle>
      <text x="32" y="155">步骤 0</text><text x="800" y="155">步骤 ${step}</text>
    </svg><p class="help">纵轴独立缩放，跨案例请比较数值。</p></figure>`;
}

const captureCss = `
.capture-page { margin: 0; padding: 0; }
#aha-card, #aha-scene { margin: 0; background: var(--cp-bg); color: var(--cp-text); overflow-wrap: anywhere; }
#aha-card { width: 1080px; max-height: 2400px; padding: 40px; }
.capture-kicker { display: flex; justify-content: space-between; gap: 16px; color: var(--cp-text-muted); font-size: 15px; margin-bottom: 16px; }
.capture-title { font-size: 40px; line-height: 1.2; margin-bottom: 12px; }
.capture-question { font-size: 23px; }
.capture-takeaway { padding: 20px 0 4px; margin-top: 16px; }
.capture-takeaway .takeaway { max-width: none; font-size: 30px; }
.capture-section { margin-top: 24px; }
.capture-section h2 { font-size: 22px; margin-bottom: 12px; }
.capture-section .result-metric dd { font-size: 48px; }
.capture-section .summary-case-title { font-size: 22px; }
.capture-section .summary-panel { padding: 20px; }
.capture-input { font-size: 16px; border-top: 1px solid var(--cp-border); padding-top: 12px; margin-top: 12px; }
.capture-explanation { padding: 20px; border: 1px solid var(--cp-border); border-radius: 16px; background: var(--cp-bg-elevated); }
.capture-explanation p, .capture-explanation dd { font-size: 18px; }
.capture-explanation .glossary { margin: 12px 0; }
.capture-points { display: grid; gap: 16px; }
#aha-card .teaching-items { flex-wrap: wrap; }
#aha-card .teaching-items > li { flex-basis: 25%; }
#aha-card .teaching-items:has(> li:nth-child(4)) > li { flex-basis: 40%; }
#aha-card .teaching-items p { font-size: 22px; }
#aha-card .reader-conditions { font-size: 16px; }
.snapshot-visual { margin: 16px 0 0; }
.snapshot-visual figcaption { font-size: 17px; font-weight: 600; }
.snapshot-visual svg { display: block; width: 100%; height: 164px; }
.snapshot-visual .axis { stroke: var(--cp-border-strong); }
.snapshot-visual .line { stroke: var(--cp-accent); fill: none; stroke-width: 4; }
.snapshot-visual .point { fill: var(--cp-accent); stroke: var(--cp-surface); stroke-width: 2; }
.snapshot-visual text { fill: var(--cp-text-muted); font: 20px "Segoe UI", Aptos, Calibri, sans-serif; }
.snapshot-visual .help { font-size: 14px; margin-top: 4px; }
.capture-footer { border-top: 1px solid var(--cp-border); padding-top: 16px; margin-top: 24px; }
.capture-footer p { font-size: 15px; margin-bottom: 8px; }
#aha-scene { width: 1280px; height: 720px; padding: 28px 36px; display: grid; grid-template-rows: auto minmax(min-content, 1fr) auto auto; gap: 12px; }
#aha-scene .capture-kicker { margin-bottom: 4px; font-size: 14px; }
#aha-scene .capture-title { font-size: 32px; line-height: 1.2; margin-bottom: 4px; }
.scene-content { display: grid; grid-template-columns: 1.25fr 1fr; gap: 28px; align-items: start; }
.scene-content > * { min-width: 0; }
.scene-content.teaching-scene { display: block; }
.scene-body { font-size: 24px; line-height: 1.45; margin: 0; white-space: pre-line; }
.teaching-scene .teaching-visual { margin: 16px 0 0; }
.teaching-scene .teaching-items > li { padding: 16px; }
.teaching-scene .teaching-items h3 { font-size: 23px; }
.teaching-scene .teaching-items p { font-size: 22px; line-height: 1.4; }
.scene-content .result-metric dd { font-size: 44px; }
.scene-content .result-detail { font-size: 16px; margin-bottom: 4px; }
.scene-content .snapshot-visual { margin-top: 4px; }
.scene-content .snapshot-visual svg { height: 86px; }
.scene-content .snapshot-visual figcaption { font-size: 14px; }
.scene-content .snapshot-visual .help { display: none; }
.scene-case-label { margin-bottom: 4px; font-size: 15px; color: var(--cp-text-muted); }
.scene-caption { font-size: 26px; line-height: 1.35; font-weight: 600; padding: 12px 16px; margin: 0; background: var(--cp-accent-soft); border-radius: 10px; }
#aha-scene .capture-footer { margin: 0; padding-top: 8px; }
#aha-scene .capture-footer p { font-size: 14px; line-height: 1.3; margin-bottom: 4px; }
#aha-scene .reader-conditions { margin: 0; }
`;

function documentHtml(title: string, content: string, teaching = false): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
    <title>${escapeHtml(title)}</title><script>${themeScript}</script><style>${themeCss}${captureCss}${teaching ? teachingCss : ''}</style>
    </head><body class="capture-page">${content}</body></html>`;
}

export function renderCardHtml(pack: Pack): string {
  if (pack.teaching) {
    const limits = budget('CARD', 2800);
    limits.text(pack.teaching.card.headline, '/teaching/card/headline', 90, 4);
    limits.text(pack.teaching.card.summary, '/teaching/card/summary', 180, 2);
    limits.text(pack.teaching.card.takeaway, '/teaching/card/takeaway', 150, 3);
    limits.text((pack.brief.explanation?.conditions ?? []).join(' '), '/brief/explanation/conditions', 360);
    const states = new Set(pack.teaching.card.transitionIds.flatMap(id => {
      const transition = pack.teaching!.transitions.find(item => item.id === id)!;
      limits.text(transition.explanation, `/teaching/transitions/${id}/explanation`, 240);
      return [transition.from, transition.to];
    }));
    let contentRows = 0;
    for (const state of pack.teaching.states.filter(item => states.has(item.id))) {
      const columns = pack.teaching.entities.length === 3 ? 22 : 36;
      contentRows += Math.max(...state.values.map(value => value.content.replace(/\n$/, '').split('\n').reduce((rows, line) => {
        const width = [...line].reduce((size, char) => size + (char.charCodeAt(0) > 255 ? 2 : 1), 0);
        return rows + Math.max(1, Math.ceil(width / columns));
      }, 0)));
      for (const value of state.values) limits.text(value.content, `/teaching/states/${state.id}/content`, 300, 1.5);
    }
    if (pack.teaching.outcome && states.has(pack.teaching.outcome.fromStateId)) {
      const { outcome, value } = teachingOutcome(pack.teaching);
      limits.text(outcome.label + outcome.action + outcome.explanation, '/teaching/outcome', 420);
      limits.text(value.content, '/teaching/outcome/content', 300, 1.5);
      contentRows += value.content.replace(/\n$/, '').split('\n').length;
    }
    if (contentRows > 24) throw new AhaError('CARD_CONTENT_LIMIT',
      '图片卡片的内容行过多。请缩短内容片段或减少操作；不会隐藏或截断状态。', '/teaching/states');
    limits.text(pack.evidence.filter(item => pack.teaching!.basis.evidenceIds.includes(item.id)).map(item => item.title).join(' · '), '/teaching/basis/evidenceIds', 360);
    limits.finish();
    return documentHtml(`${pack.teaching.title} · Aha 图片卡片`, teachingCardMarkup(pack), true);
  }
  const evidence = pack.modelSpec.engine === 'evidence';
  const snapshots = evidence ? [] : pack.scenarios.slice(0, 2).map(scenario => snapshot(pack, scenario));
  const sources = readerSources(pack);
  const conditions = readerConditions(pack);
  const explanation = pack.brief.explanation;
  const visual = explanation?.visual;
  const points = evidence && !visual ? pack.narrative.slides.slice(0, 3) : [];
  const limits = budget('CARD', 2200);
  limits.text(pack.brief.topic, '/brief/topic', 80, 6);
  limits.text(pack.brief.question, '/brief/question', 140, 2);
  validateSnapshots(snapshots, limits, true);
  for (const item of snapshots) limits.text(inputText(item.scenario), `/scenarios/${item.scenario.id}/input`, 340, 2);
  validateVisual(visual, limits);
  for (const point of points) {
    limits.text(point.title, `/narrative/slides/${point.id}/title`, 80, 2);
    limits.text(point.body, `/narrative/slides/${point.id}/body`, 240, 1.5);
  }
  if (explanation) {
    limits.text(explanation.takeaway, '/brief/explanation/takeaway', 240, 3.5);
    limits.text(explanation.checkQuestion, '/brief/explanation/checkQuestion', 160, 1.2);
    if (explanation.answer) limits.text(explanation.answer, '/brief/explanation/answer', 240, 1.2);
    if (explanation.analogy) {
      limits.text(explanation.analogy.text, '/brief/explanation/analogy/text', 180, 1.5);
      limits.text(explanation.analogy.limitations, '/brief/explanation/analogy/limitations', 180, 1.5);
    }
    if (explanation.glossary.length > 3) {
      throw new AhaError('CARD_CONTENT_LIMIT', '图片卡片最多容纳 3 个词语。请精简术语表；不会静默省略。', '/brief/explanation/glossary');
    }
    for (const [index, entry] of explanation.glossary.entries()) {
      limits.text(entry.term, `/brief/explanation/glossary/${index}/term`, 30, 2);
      limits.text(entry.meaning, `/brief/explanation/glossary/${index}/meaning`, 90, 2.5);
    }
  }
  limits.text(conditions.join(' '), '/conditions', 600);
  limits.text(sources.map(sourceLabel).join('； '), '/sources', 500);
  limits.finish();
  return documentHtml(`${pack.brief.topic} · Aha 图片卡片`, `<article id="aha-card" aria-label="含来源与边界的解释卡片">
    <header><div class="capture-kicker"><span>Aha</span>${pack.manifest.visibility === 'private' ? '<span>私密资料</span>' : ''}</div>
      <h1 class="capture-title">${escapeHtml(pack.brief.topic)}</h1><p class="capture-question">${escapeHtml(pack.brief.question)}</p>
      <div class="capture-takeaway">${takeawayMarkup(pack)}</div></header>
    ${teachingVisualMarkup(visual)}
    ${points.length ? `<section class="capture-section capture-points">${points.map(point => `<article>
      <h2>${escapeHtml(point.title)}</h2><p class="lesson-body">${escapeHtml(point.body)}</p></article>`).join('')}</section>` : ''}
    ${snapshots.length ? `<section class="capture-section"><h2>对比结果</h2>
      <div class="result-comparison">${snapshots.map((item, index) => `<section class="summary-panel" data-scenario-id="${escapeHtml(item.scenario.id)}">
        <p class="eyebrow">案例 ${index === 0 ? 'A' : 'B'}</p><h3 class="summary-case-title">${escapeHtml(item.scenario.title)}</h3>
        ${resultSummaryMarkup(item.trace, item.step)}<p class="capture-input">${escapeHtml(inputText(item.scenario))}</p></section>`).join('')}</div>
      ${snapshotVisual(snapshots[0]!, 'card')}</section>` : ''}
    ${explanation && (explanation.analogy || explanation.glossary.length) ? `<section class="capture-section capture-explanation">
      ${explanation.analogy ? `<p>${escapeHtml(explanation.analogy.text)}</p><p class="help">${escapeHtml(explanation.analogy.limitations)}</p>` : ''}
      ${explanation.glossary.length ? `<dl class="glossary">${explanation.glossary.map(item => `<div><dt>${escapeHtml(item.term)}</dt><dd>${escapeHtml(item.meaning)}</dd></div>`).join('')}</dl>` : ''}</section>` : ''}
    ${explanation ? `<section class="capture-section"><h2>想一想</h2><p>${escapeHtml(explanation.checkQuestion)}</p>
      ${explanation.answer ? `<p class="help">${escapeHtml(explanation.answer)}</p>` : ''}</section>` : ''}
    ${conditionsMarkup(conditions)}<footer class="capture-footer"><p>参考：${sourceLinksMarkup(sources)}</p></footer>
  </article>`);
}

export function renderSceneHtml(pack: Pack, slideId: string, caption: string): string {
  const slide = pack.narrative.slides.find(item => item.id === slideId);
  if (!slide) throw new AhaError('SCENE_SLIDE_MISSING', `讲解页 ${slideId} 不存在。`, '/narrative/slides');
  if (pack.teaching && slide.scene) {
    const limits = budget('SCENE', 1400);
    limits.text(slide.title, `/narrative/slides/${slideId}/title`, 64);
    limits.text(caption, '/caption', 120);
    limits.finish();
    return documentHtml(`${slide.title} · Aha 视频画面`, `<article id="aha-scene" class="teaching-scene-capture" data-slide-id="${escapeHtml(slideId)}" data-scene-kind="${slide.scene.kind}">
      <header><div class="capture-kicker"><span>Aha · ${pack.narrative.slides.indexOf(slide) + 1} / ${pack.narrative.slides.length}</span></div><h1 class="capture-title">${escapeHtml(slide.title)}</h1></header>
      <div>${teachingSceneMarkup(pack, slide)}</div><p class="scene-caption">${escapeHtml(caption)}</p>
      <footer class="capture-footer">${teachingBasis(pack.teaching)}</footer></article>`, true);
  }
  const scenario = pack.scenarios.find(item => item.id === slide.scenarioId);
  if (slide.scenarioId && !scenario) throw new AhaError('SCENE_SCENARIO_MISSING', '讲解页关联的案例不存在。', `/narrative/slides/${slideId}`);
  const item = scenario && pack.modelSpec.engine !== 'evidence' ? snapshot(pack, scenario, slide.eventStep) : undefined;
  const sources = readerSources(pack, slide);
  const conditions = readerConditions(pack, slide);
  const limits = budget('SCENE', 1400);
  limits.text(slide.title, `/narrative/slides/${slideId}/title`, 64);
  limits.text(slide.body, `/narrative/slides/${slideId}/body`, 180);
  limits.text(caption, '/caption', 120);
  limits.text(conditions.join(' '), '/conditions', 300);
  limits.text(sources.map(sourceLabel).join('； '), '/sources', 360);
  validateVisual(slide.visual, limits, true);
  budget('SCENE', 240).text(slide.title + slide.body + caption, '/scene-story', 240);
  if (item) validateSnapshots([item], limits);
  limits.finish();
  return documentHtml(`${slide.title} · Aha 视频画面`, `<article id="aha-scene" data-slide-id="${escapeHtml(slideId)}" aria-label="含来源的固定视频画面">
    <header><div class="capture-kicker"><span>Aha · ${pack.narrative.slides.indexOf(slide) + 1} / ${pack.narrative.slides.length}</span>
      ${pack.manifest.visibility === 'private' ? '<span>私密资料</span>' : ''}</div><h1 class="capture-title">${escapeHtml(slide.title)}</h1></header>
    <div class="scene-content${item ? '' : ' teaching-scene'}"><p class="scene-body">${escapeHtml(slide.body)}</p>
      ${item ? `<section aria-label="计算结果"><p class="scene-case-label" data-scenario-id="${escapeHtml(item.scenario.id)}">第 ${item.step} / ${item.trace.events.length} 步</p>
        ${resultSummaryMarkup(item.trace, item.step)}${snapshotVisual(item, 'scene')}</section>` : teachingVisualMarkup(slide.visual)}</div>
    <p class="scene-caption" aria-label="当前讲解句">${escapeHtml(caption)}</p>
    <footer class="capture-footer">${conditionsMarkup(conditions)}<p>参考：${sourceLinksMarkup(sources)}</p></footer>
  </article>`);
}
