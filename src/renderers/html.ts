import type { Pack, Scenario, Trace } from '../core/schema.js';
import { stateAt } from '../core/engine.js';
import {
  claimsMarkup, committedSummaryMarkup, escapeHtml, evidenceMarkup, explanationMarkup,
  inputMarkup, metadataMarkup, modeLabels, reasonLabel, selectedStateMarkup, stateMarkup,
  takeawayMarkup, traceVisual,
  conditionsMarkup, teachingVisualMarkup,
} from './presentation.js';
import { readerConditions, readerSources } from './learning.js';
import { themeCss, themeScript } from './theme.js';
import { teachingBasis, teachingLabMarkup, teachingSceneMarkup, teachingScope } from './teaching-html.js';
import { teachingCss } from './teaching-theme.js';

export type RenderAssets = { labJs: string; slidesJs: string; revealJs: string; revealCss: string };

export function serializeInertJson(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, char => ({
    '<': '\\u003c', '>': '\\u003e', '&': '\\u0026', '\u2028': '\\u2028', '\u2029': '\\u2029',
  })[char]!);
}

function inlineScript(value: string): string {
  return value.replace(/\/\/[#@]\s*sourceMappingURL=[^\r\n]*/g, '')
    .replace(/<\/script/gi, '<\\/script');
}

function inputFields(scenario: Scenario, panel: string): string {
  const input = scenario.input;
  const number = (key: string, label: string, value: number, min: number, max: number) =>
    `<label data-field-label="${key}" for="${panel}-${key}">${label}
      <small>整数，${min}–${max}</small>
      <input id="${panel}-${key}" name="${key}" type="number" min="${min}" max="${max}" step="1" value="${value}" required>
    </label>`;
  const text = (key: string, label: string, help: string, value: string, required = true) =>
    `<label class="wide" data-field-label="${key}" for="${panel}-${key}">${label}
      <small>${help}</small><input id="${panel}-${key}" name="${key}" type="text" value="${escapeHtml(value)}"${required ? ' required' : ''}>
    </label>`;
  if ('maxRetries' in input) {
    return `<div class="form-grid">
      ${number('maxRetries', '最大重试次数（不含首次尝试）', input.maxRetries, 0, 20)}
      ${number('baseDelayMs', '初始等待（毫秒）', input.baseDelayMs, 0, 60000)}
      ${number('multiplier', '等待倍率（倍）', input.multiplier, 1, 4)}
      ${number('maxDelayMs', '等待上限（毫秒）', input.maxDelayMs, 0, 3600000)}
      ${text('outcomes', '尝试结果序列', '英文逗号分隔，1–21 项：transient（暂时性错误）、fatal（致命错误）、success（成功）；不可省略实际执行到的项。', input.outcomes.join(','))}
      ${text('retryableErrors', '允许重试的错误', '英文逗号分隔：transient、fatal；空白表示都不重试，不能重复。', input.retryableErrors.join(','), false)}
    </div>`;
  }
  if ('principal' in input) {
    return `<div class="form-grid">
      ${text('principal', '初始本金（金额单位）', '非负十进制数，整数部分最多 12 位，小数最多 6 位；不用千位分隔符。', input.principal)}
      ${text('rates', '各期收益率（%）', '英文逗号分隔，1–120 期，每期 −100 到 1000；例如 10,-10。小数最多 6 位。', input.rates.join(','))}
      ${text('cashflows', '各期现金流（金额单位）', '与收益率期数完全相同；零也必须填写。正数为投入，负数为取出，不可透支；小数最多 6 位。', input.cashflows.join(','))}
      <label class="wide" data-field-label="timing" for="${panel}-timing">现金流时点
        <select id="${panel}-timing" name="timing">
          <option value="beginning"${input.timing === 'beginning' ? ' selected' : ''}>期初（先现金流、后收益）</option>
          <option value="end"${input.timing === 'end' ? ' selected' : ''}>期末（先收益、后现金流）</option>
        </select>
      </label>
    </div>`;
  }
  return '';
}

function modelPanel(pack: Pack, panel: 'a' | 'b', scenario: Scenario): string {
  const trace = pack.traces.find(item => item.scenarioId === scenario.id)!;
  const letter = panel.toUpperCase();
  return `<section class="card experiment-panel" id="panel-${panel}" aria-labelledby="${panel}-heading">
    <h2 id="${panel}-heading">案例 ${letter}</h2>
    <p class="help" id="${panel}-mode">按所选条件计算</p>
    <label for="${panel}-preset">选择预设案例</label>
    <select id="${panel}-preset" data-preset="${panel}">
      ${pack.scenarios.map(item => `<option value="${escapeHtml(item.id)}"${item.id === scenario.id ? ' selected' : ''}>${escapeHtml(item.title)}</option>`).join('')}
    </select>
    <form id="${panel}-form" novalidate>
      <fieldset data-runtime-controls disabled><legend>输入条件</legend>${inputFields(scenario, panel)}</fieldset>
      <button class="primary" id="${panel}-run" type="submit" disabled>运行案例 ${letter}</button>
    </form>
    <p id="${panel}-freshness" role="status">结果对应当前输入。</p>
    <div id="${panel}-error" role="alert" aria-live="assertive"></div>
    <section aria-labelledby="${panel}-result-heading"><h3 id="${panel}-result-heading">已运行案例的最终结果</h3>
      <div id="${panel}-result">${stateMarkup(trace.result)}</div>
      <details><summary>该结果实际使用的输入（不含未运行修改）</summary><div id="${panel}-committed-input">${inputMarkup(scenario.input)}</div></details>
    </section>
    <fieldset data-runtime-controls disabled><legend>确定性轨迹回放（不是真实执行）</legend>
      <div class="toolbar">
        <button type="button" id="${panel}-play">播放</button>
        <button type="button" id="${panel}-pause" disabled>暂停</button>
        <button type="button" id="${panel}-resume" disabled>继续</button>
        <button type="button" id="${panel}-prev" disabled>上一步</button>
        <button type="button" id="${panel}-next">下一步</button>
        <button type="button" id="${panel}-reset">重置到初始状态</button>
      </div>
      <label for="${panel}-interval">回放间隔（毫秒，仅改变播放速度）
        <select id="${panel}-interval"><option value="1000">1000 毫秒</option><option value="500">500 毫秒</option><option value="2000">2000 毫秒</option></select>
      </label>
      <p id="${panel}-playback-status" role="status">已暂停 · 初始状态</p>
    </fieldset>
    <div id="${panel}-selected-state" aria-live="polite" aria-atomic="true">${selectedStateMarkup(trace, 0)}</div>
    <div id="${panel}-visual">${traceVisual(trace, 0, panel)}</div>
    <details><summary>按语义事件选择步骤</summary><ol class="timeline" id="${panel}-timeline" aria-label="案例 ${letter} 的事件步骤"></ol></details>
    <details><summary>此案例关联的结论</summary><div id="${panel}-claims">${claimsMarkup(pack.claims.filter(claim => scenario.claimIds.includes(claim.id)))}</div></details>
    <fieldset data-runtime-controls disabled><legend>保存为讲解案例</legend>
      <label for="${panel}-export"><input type="checkbox" id="${panel}-export" checked> 导出案例 ${letter} 的已运行输入与结果</label>
      <label for="${panel}-note">案例 ${letter} 的观察备注（不是事实依据）</label>
      <textarea id="${panel}-note" rows="3" maxlength="4000" placeholder="可记录预测与实际结果的差异"></textarea>
    </fieldset>
  </section>`;
}

function labMarkup(pack: Pack): string {
  if (pack.modelSpec.engine === 'evidence') {
    return `${pack.teaching ? teachingLabMarkup(pack.teaching) : `<section class="card" id="observe" tabindex="-1" aria-labelledby="evidence-heading">
      <h2 id="evidence-heading">一步一步看</h2>
      <label for="lesson-selector">选择一个问题</label>
      <select id="lesson-selector" disabled>${pack.narrative.slides.map((slide, index) =>
        `<option value="${index}">${escapeHtml(slide.title)}</option>`).join('')}</select>
      <div class="lesson-pages">${pack.narrative.slides.map((slide, index) => `<article data-lesson-index="${index}"${index ? ' hidden' : ''}>
        <h3>${escapeHtml(slide.title)}</h3><p class="lesson-body">${escapeHtml(slide.body)}</p>
        ${teachingVisualMarkup(slide.visual)}${conditionsMarkup(slide.conditions ?? [])}
      </article>`).join('')}</div>
    </section>`}
    <details id="reading-sources"><summary>查阅参考资料</summary>
      ${pack.teaching ? teachingBasis(pack.teaching) + teachingScope(pack) : ''}
      <label for="evidence-selector">选择阅读材料</label>
      <select id="evidence-selector" disabled><option value="">并列阅读全部材料</option>${pack.evidence.map(item =>
        `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)}</option>`).join('')}</select>
      <p id="evidence-status" role="status"></p>
      <div id="evidence-cards">${pack.evidence.map(item => evidenceMarkup(item, 'reading-')).join('')}</div>
      <details><summary>相关解释与适用范围</summary><div id="evidence-claims">${claimsMarkup(pack.claims, 'reading-', pack.evidence)}</div></details>
      <h3>记下你的理解</h3>
      <label for="evidence-note">我的笔记</label>
      <textarea id="evidence-note" rows="3" maxlength="4000"></textarea>
      <button class="primary" id="evidence-export" type="button" disabled>保存学习笔记</button>
      <p id="export-status" role="status" aria-live="polite"></p>
      <div id="export-error" role="alert"></div>
    </details>`;
  }
  return `<section class="card" id="observe" tabindex="-1" aria-labelledby="compare-heading"><p class="eyebrow">02 · 观察结果</p><h2 id="compare-heading">改一个条件，观察差异</h2>
    <p>两侧独立运行；修改后须点击“运行”才会更新结果。回放只浏览语义事件；等待是计划逻辑时间，不是实测耗时，不会实际等待或执行请求。</p>
    <p id="input-differences" role="status"></p>
  </section>
  <div class="comparison">${modelPanel(pack, 'a', pack.scenarios[0]!)}${modelPanel(pack, 'b', pack.scenarios[1] ?? pack.scenarios[0]!)}</div>
  <section class="card" aria-labelledby="export-heading"><h2 id="export-heading">保存探索，继续讲解</h2>
    <p>只导出勾选的、已成功运行的案例。若有未运行修改，请先运行，或取消勾选该案例。观察备注不会自动变成结论。</p>
    <button class="primary" id="export-exploration" type="button" disabled>下载探索记录（.exploration.json）</button>
    <p id="export-status" role="status" aria-live="polite"></p>
    <div id="export-error" role="alert"></div>
  </section>`;
}

function orientationMarkup(pack: Pack): string {
  const evidence = pack.modelSpec.engine === 'evidence';
  return `<section class="card overview" id="overview" tabindex="-1" aria-label="讲解要点与当前结果">
    ${takeawayMarkup(pack)}
    ${evidence ? teachingVisualMarkup(pack.brief.explanation?.visual)
      : `<div class="summary-heading"><h2>当前 A / B · 已运行的最终结果</h2><a href="#observe">修改条件与逐步回放 ↓</a></div>
      <div class="result-comparison">${(['a', 'b'] as const).map((id, index) => {
        const scenario = pack.scenarios[index] ?? pack.scenarios[0]!;
        const trace = pack.traces.find(item => item.scenarioId === scenario.id)!;
        return `<article class="summary-panel" aria-label="案例 ${id.toUpperCase()} 结果摘要">
          <p class="eyebrow">案例 ${id.toUpperCase()}</p><div id="${id}-summary">${committedSummaryMarkup(scenario, trace)}</div>
          <p id="${id}-summary-freshness" class="summary-freshness" role="status">结果对应当前输入</p>
        </article>`;
      }).join('')}</div>`}
    ${conditionsMarkup(readerConditions(pack))}
  </section>
  <nav class="learning-path" aria-label="预测、观察、解释">
    <a href="#predict"><strong>01 · 预测</strong><span>先想一个可能结果</span></a>
    <a href="#observe"><strong>02 · 观察</strong><span>${evidence ? '一步一步看' : '改条件，再运行'}</span></a>
    <a href="#explain"><strong>03 · 解释</strong><span>用自己的话检查理解</span></a>
  </nav>
  <section class="card prediction" id="predict" tabindex="-1" aria-labelledby="predict-heading">
    <h2 id="predict-heading">先预测，再核对</h2>
    <p>${escapeHtml(pack.brief.explanation?.checkQuestion ?? pack.brief.question)}</p>
  </section>`;
}

function slideCase(trace: Trace, scenario: Scenario, step: number, prefix: string, title: string): string {
  if (trace.engine === 'evidence') return '';
  const { exactBalance: _exact, ...visibleState } = stateAt(trace, step);
  const event = step > 0 ? trace.events[step - 1] : undefined;
  return `<div class="slide-case" data-scenario-id="${escapeHtml(scenario.id)}">
    <div>${scenario.title !== title ? `<h3>${escapeHtml(scenario.title)}</h3>` : ''}
      <p>第 ${step} / ${trace.events.length} 步 · ${event ? escapeHtml(reasonLabel(event.details.reasonCode ?? event.kind)) : '初始状态'}</p>
      ${stateMarkup(visibleState)}
      <details><summary>案例过程、实际输入与精确数值</summary>
        ${selectedStateMarkup(trace, step)}${inputMarkup(scenario.input)}
        <h3>完整轨迹的最终结果</h3>${stateMarkup(trace.result)}
      </details>
    </div>
    <div>${traceVisual(trace, step, prefix)}</div>
  </div>`;
}

function slidesMarkup(pack: Pack): string {
  return `<nav class="toolbar" id="story" tabindex="-1" aria-label="幻灯片导航">
    <button id="slide-prev" type="button" disabled>上一页</button>
    <button id="slide-next" type="button" disabled>下一页</button>
    <button id="slide-notes-toggle" type="button" aria-pressed="false" aria-controls="${pack.narrative.slides.map(slide => `notes-${escapeHtml(slide.id)}`).join(' ')}" disabled>显示讲解备注</button>
    <button id="slide-fullscreen" type="button" disabled>全屏演示</button>
    <span id="slide-position" role="status" aria-live="polite">第 1 / ${pack.narrative.slides.length} 页</span>
    <label class="slide-jump-label" for="slide-jump">跳到讲解页
      <select id="slide-jump" disabled>${pack.narrative.slides.map((slide, index) =>
        `<option value="${index}">${index + 1} · ${escapeHtml(slide.title)}</option>`).join('')}</select>
    </label>
  </nav>
  <div id="slides-error" role="alert"></div>
  <div class="deck-shell"><div class="reveal" aria-label="离线讲解幻灯片"><div class="slides">
    ${pack.narrative.slides.map((slide, index) => {
      const scenario = pack.scenarios.find(item => item.id === slide.scenarioId);
      const trace = scenario ? pack.traces.find(item => item.scenarioId === scenario.id) : undefined;
      const step = slide.eventStep ?? trace?.events.length ?? 0;
      const claims = pack.claims.filter(claim => slide.claimIds.includes(claim.id));
      const prefix = `slide-${index}-source-`;
      return `<section id="slide-${escapeHtml(slide.id)}" aria-labelledby="title-${escapeHtml(slide.id)}" data-slide-index="${index}"${pack.teaching && slide.scene ? ` data-scene-kind="${slide.scene.kind}"` : ''}>
        <p class="slide-mode">${index + 1} / ${pack.narrative.slides.length}</p>
        <h2 id="title-${escapeHtml(slide.id)}">${escapeHtml(slide.title)}</h2>${pack.teaching && slide.scene ? '' : `<p class="lesson-body">${escapeHtml(slide.body)}</p>`}
        ${pack.teaching && slide.scene ? teachingSceneMarkup(pack, slide) : teachingVisualMarkup(slide.visual)}
        ${trace && scenario ? slideCase(trace, scenario, step, `slide-${index}`, slide.title) : ''}
        ${pack.teaching ? '' : conditionsMarkup(readerConditions(pack, slide))}
        <details class="slide-sources"><summary>参考资料</summary>
          ${readerSources(pack, slide).map(item => evidenceMarkup(item, prefix)).join('')}
          ${claims.length ? `<details><summary>适用范围</summary>${claimsMarkup(claims, prefix, pack.evidence)}</details>` : ''}
        </details>
        <aside class="slide-notes" id="notes-${escapeHtml(slide.id)}" aria-label="讲解备注" hidden>
          <h3>讲解文字</h3><p>${escapeHtml(slide.notes)}</p>
        </aside>
      </section>`;
    }).join('')}
  </div></div></div>`;
}

export function renderHtml(pack: Pack, kind: 'lab' | 'slides', assets: RenderAssets): string {
  const css = (kind === 'slides' ? assets.revealCss : '') + themeCss + (pack.teaching ? teachingCss : '');
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<title>${escapeHtml(pack.brief.topic)} · Aha ${kind === 'lab' ? '探索实验室' : '离线讲解'}</title>
<script>${themeScript}${pack.teaching && kind === 'lab' ? '\ndocument.documentElement.setAttribute("data-teaching-runtime", "pending");' : ''}</script>
<style>${css.replace(/<\/style/gi, '<\\/style').replace(/\/\*[#@]\s*sourceMappingURL=[\s\S]*?\*\//g, '')}</style>
</head><body class="${kind === 'slides' ? 'deck-page no-js-deck' : 'lab-page no-js-lab'}${pack.teaching ? ' teaching-page' : ''}">
<a class="skip-link" href="#main">跳到主要内容</a>
<header class="page-header">
  <h1>${escapeHtml(pack.teaching?.title ?? pack.brief.topic)}</h1>
  ${kind === 'lab' && !pack.teaching ? `<p>${escapeHtml(pack.brief.question)}</p>` : ''}
  ${pack.manifest.visibility === 'private' ? '<span class="badge">私密资料</span>' : ''}
</header>
<main id="main">
  <noscript><p class="notice">JavaScript 已关闭，下方内容仍可阅读；交互操作与导出不可用。</p></noscript>
  ${pack.teaching ? '' : `<nav class="section-nav" aria-label="本页章节">
    ${kind === 'lab' ? '<a href="#overview">要点与结果</a><a href="#predict">预测</a><a href="#observe">探索</a>' : '<a href="#story">讲解页</a>'}
    <a href="#explain">想一想</a><a href="#pack-context">参考资料</a>
  </nav>`}
  ${kind === 'lab' ? `${pack.teaching ? '' : orientationMarkup(pack)}${labMarkup(pack)}` : slidesMarkup(pack)}
  ${pack.teaching ? kind === 'slides' ? teachingBasis(pack.teaching) : '' : `${explanationMarkup(pack)}${metadataMarkup(pack)}`}
</main>
<footer class="page-footer"><p class="muted">Aha</p></footer>
<script id="aha-pack" type="application/json">${serializeInertJson(pack)}</script>
${kind === 'slides' ? `<script>${inlineScript(assets.revealJs)}</script>` : ''}
<script>${inlineScript(kind === 'lab' ? assets.labJs : assets.slidesJs)}</script>
</body></html>`;
}
