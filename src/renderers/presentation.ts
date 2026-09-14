import type { Claim, Evidence, Input, Mode, Pack, Scenario, State, TeachingVisual, Trace } from '../core/schema.js';
import { stateAt } from '../core/engine.js';
import { readerSources, sourceLabel } from './learning.js';

export function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]!);
}

export const modeLabels: Record<Mode, string> = {
  'derived-model': '规则推演 · 非真实执行',
  'source-based': '来源阅读 · 非因果模拟',
  observed: '已观察轨迹 · 仅限所给材料',
  illustrative: '示意说明 · 非验证结果',
};

const labels: Record<string, string> = {
  attempt: '尝试次数', status: '状态', totalDelayMs: '累计计划等待（ms）',
  balance: '余额（金额单位，显示到两位小数）', exactBalance: '精确余额（分数）',
  period: '期数', selectedEvidence: '所选材料数',
  maxRetries: '最大重试次数', baseDelayMs: '初始等待（毫秒）',
  multiplier: '等待倍率', maxDelayMs: '等待上限（毫秒）', outcomes: '尝试结果序列',
  retryableErrors: '允许重试的错误', principal: '初始本金（金额单位）',
  rates: '各期收益率（%）', cashflows: '各期现金流（金额单位）', timing: '现金流时点',
  evidenceIds: '材料引用', reasonCode: '事件原因', error: '错误类别',
  delayMs: '本次等待（毫秒）', ratePercent: '本期收益率（%）', cashflow: '本期现金流（金额单位）',
};

const values: Record<string, string> = {
  ready: '准备就绪', running: '正在尝试', waiting: '等待下一次尝试', success: '成功',
  transient: '暂时性错误', fatal: '致命错误', beginning: '期初', end: '期末',
  'source-based': '来源阅读', 'retries-exhausted': '重试预算耗尽',
  'not-retryable': '错误不允许重试', 'attempt-started': '开始尝试',
  succeeded: '尝试成功', stopped: '停止尝试', 'retry-scheduled': '安排重试等待',
  'retryable-error': '错误允许重试，且预算尚有余量',
  'period-settled': '本期结算', 'cashflow-before-return': '先计入现金流，再计算本期收益',
  'cashflow-after-return': '先计算本期收益，再计入现金流',
};

export function fieldLabel(key: string): string { return labels[key] ?? key; }
export function valueLabel(value: unknown): string {
  if (Array.isArray(value)) return value.length ? value.map(valueLabel).join('，') : '无';
  if (value === null) return '无';
  if (value === true) return '是';
  if (value === false) return '否';
  return values[String(value)] ?? String(value);
}
export function reasonLabel(value: unknown): string { return valueLabel(value); }

export function takeawayMarkup(pack: Pack): string {
  return `<p class="takeaway" data-takeaway>${escapeHtml(pack.brief.explanation?.takeaway ?? pack.brief.question)}</p>`;
}

export function teachingVisualMarkup(visual: TeachingVisual | undefined): string {
  if (!visual) return '';
  return `<figure class="teaching-visual teaching-${visual.layout}" aria-label="${escapeHtml(visual.title)}">
    <figcaption>${escapeHtml(visual.title)}</figcaption>
    <ol class="teaching-items">${visual.items.map((item, index) => `<li>
      ${visual.layout === 'steps' ? `<span class="teaching-step" aria-hidden="true">${index + 1}</span>` : ''}
      <h3>${escapeHtml(item.label)}</h3><p>${escapeHtml(item.body)}</p>
    </li>`).join('')}</ol>
  </figure>`;
}

export function conditionsMarkup(conditions: string[]): string {
  return conditions.length ? `<div class="reader-conditions">${conditions.map(text => `<p>${escapeHtml(text)}</p>`).join('')}</div>` : '';
}

export function sourceLinksMarkup(sources: Evidence[]): string {
  return sources.map(source => {
    const url = safeSourceUrl(source.url);
    return url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(sourceLabel(source))}</a>`
      : `<span>${escapeHtml(sourceLabel(source))}</span>`;
  }).join(' · ');
}

export function explanationMarkup(pack: Pack): string {
  const explanation = pack.brief.explanation;
  return `<section class="card explanation" id="explain" tabindex="-1" aria-labelledby="explain-heading">
    <h2 id="explain-heading">想一想</h2>
    ${explanation?.analogy ? `<div class="analogy">
      <p>${escapeHtml(explanation.analogy.text)}</p>
      <p class="help">${escapeHtml(explanation.analogy.limitations)}</p></div>` : ''}
    ${explanation?.glossary.length ? `<dl class="glossary">${explanation.glossary.map(item =>
      `<div><dt>${escapeHtml(item.term)}</dt><dd>${escapeHtml(item.meaning)}</dd></div>`).join('')}</dl>
      ` : ''}
    <p class="check-question">${escapeHtml(explanation?.checkQuestion ?? pack.brief.question)}</p>
    ${explanation?.answer ? `<details class="check-answer"><summary>查看答案</summary><p>${escapeHtml(explanation.answer)}</p></details>` : ''}
  </section>`;
}

export function resultSummaryMarkup(trace: Trace, step = trace.events.length): string {
  const state = stateAt(trace, step);
  const key = trace.engine === 'compound' ? 'balance' : trace.engine === 'retry' ? 'attempt' : 'selectedEvidence';
  const label = trace.engine === 'compound' ? '余额 · 金额单位（两位小数）'
    : trace.engine === 'retry' ? '已尝试 · 次' : '所选材料 · 份';
  return `<dl class="result-metric"><div><dt>${label}</dt><dd data-summary-key="${key}">${escapeHtml(valueLabel(state[key]))}</dd></div></dl>
    <p class="result-detail">${trace.engine === 'retry'
      ? `累计计划等待 <strong data-summary-key="totalDelayMs">${escapeHtml(state.totalDelayMs)}</strong> ms · ${escapeHtml(valueLabel(state.status))}`
      : trace.engine === 'compound' ? `第 ${escapeHtml(state.period)} 期 · 显示值舍入，精确值见完整轨迹`
        : '只表示阅读范围，不证明因果关系'}</p>`;
}

export function committedSummaryMarkup(scenario: Scenario, trace: Trace): string {
  return `<p class="summary-case-title">${escapeHtml(scenario.title)}</p>
    ${resultSummaryMarkup(trace)}`;
}

export function stateMarkup(state: State): string {
  return `<dl class="state-grid">${Object.entries(state).map(([key, value]) =>
    `<div><dt>${escapeHtml(fieldLabel(key))}</dt><dd data-state-key="${escapeHtml(key)}">${escapeHtml(valueLabel(value))}</dd></div>`,
  ).join('')}</dl>`;
}

export function inputMarkup(input: Input): string {
  return `<dl class="state-grid">${Object.entries(input).map(([key, value]) =>
    `<div><dt>${escapeHtml(fieldLabel(key))}</dt><dd>${escapeHtml(valueLabel(value))}</dd></div>`,
  ).join('')}</dl>`;
}

export function listMarkup(items: string[], empty = '未另行列出'): string {
  return items.length ? `<ul>${items.map(text => `<li>${escapeHtml(text)}</li>`).join('')}</ul>` : `<p class="muted">${empty}</p>`;
}

export function safeSourceUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

export function evidenceMarkup(evidence: Evidence, anchorPrefix = 'source-'): string {
  const url = safeSourceUrl(evidence.url);
  return `<article class="card evidence-card" id="${escapeHtml(anchorPrefix + evidence.id)}" data-evidence-id="${escapeHtml(evidence.id)}">
    <h3>${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(evidence.title)}</a>` : escapeHtml(evidence.title)}</h3>
    <p class="help">${escapeHtml(evidence.locator)}</p>
  </article>`;
}

export const claimLabels: Record<Claim['type'], string> = {
  'source-claim': '来源主张', 'model-result': '模型结论', inference: '推断',
  unresolved: '尚未解决', observation: '观察记录',
};

export function claimsMarkup(claims: Claim[], anchorPrefix = 'source-', sources: Evidence[] = []): string {
  return `<div class="claim-list">${claims.map(claim => `<article data-claim-id="${escapeHtml(claim.id)}">
    <p>${claim.type === 'unresolved' ? '<strong>尚未解决：</strong>' : claim.type === 'inference' ? '<strong>推断：</strong>' : ''}${escapeHtml(claim.text)}</p>
    <p>适用范围：${escapeHtml(claim.scope)}</p>
    <p>依据：${claim.evidenceIds.length ? claim.evidenceIds.map(id =>
      `<a href="#${escapeHtml(anchorPrefix + id)}">${escapeHtml(sources.find(source => source.id === id)?.title ?? '参考资料')}</a>`).join('、') : '尚缺依据'}</p>
    ${claim.assumptions.length ? `<details><summary>结论假设</summary>${listMarkup(claim.assumptions)}</details>` : ''}
    ${claim.limitations.length ? `<details><summary>限制与不确定性</summary>${listMarkup(claim.limitations)}</details>` : ''}
  </article>`).join('')}</div>`;
}

export function traceVisual(trace: Trace, selectedStep: number, prefix: string): string {
  if (trace.engine === 'evidence') return '<p>材料选择仅影响阅读范围，不进行数值或因果模拟。</p>';
  const titleId = `${prefix}-chart-title`;
  const states = [trace.initialState, ...trace.events.map(event => event.stateAfter)];
  const key = trace.engine === 'compound' ? 'balance' : 'totalDelayMs';
  const numbers = states.map(state => Number(state[key]));
  const maximum = Math.max(1, ...numbers.filter(Number.isFinite));
  const points = numbers.map((number, index) => ({
    x: 36 + index / Math.max(1, numbers.length - 1) * 528,
    y: 162 - (Number.isFinite(number) ? number / maximum : 0) * 130,
  }));
  const selected = points[selectedStep]!;
  const axisLabel = trace.engine === 'compound' ? '余额（金额单位）' : '累计计划等待（ms）';
  return `<figure aria-labelledby="${escapeHtml(titleId)}">
    <figcaption id="${escapeHtml(titleId)}">${axisLabel}随步骤变化 · 当前第 ${selectedStep} 步</figcaption>
    <p class="muted">各图纵轴独立缩放，跨案例请比较结果数值，不仅比较曲线高度。</p>
    <svg class="chart" viewBox="0 0 600 200" role="img" aria-labelledby="${escapeHtml(titleId)}">
      <path class="axis" d="M36 24 V162 H568" fill="none"></path>
      <polyline class="line" points="${points.map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')}"></polyline>
      <circle class="point" cx="${selected.x.toFixed(2)}" cy="${selected.y.toFixed(2)}" r="6"></circle>
      <text x="36" y="190">步骤 0</text><text x="488" y="190">步骤 ${trace.events.length}</text>
    </svg>
    <details><summary>图表的逐步数值表</summary><div class="table-scroll"><table>
      <caption>${axisLabel}：完整轨迹的文字等价数据</caption>
      <thead><tr><th scope="col">步骤</th><th scope="col">事件</th><th scope="col">${axisLabel}</th></tr></thead>
      <tbody>${states.map((state, index) => `<tr><th scope="row">${index}</th><td>${index === 0 ? '初始状态' : escapeHtml(reasonLabel(trace.events[index - 1]!.kind))}</td><td>${escapeHtml(state[key])}</td></tr>`).join('')}</tbody>
    </table></div></details>
  </figure>`;
}

export function selectedStateMarkup(trace: Trace, step: number): string {
  const event = step > 0 ? trace.events[step - 1] : undefined;
  return `<p>当前步骤：<strong>${step} / ${trace.events.length}</strong>${event ? ` · 逻辑时刻：${event.logicalTimeMs} 毫秒` : ''}</p>
    <p>事件原因：${event ? escapeHtml(reasonLabel(event.details.reasonCode ?? event.kind)) : '初始状态，尚未发生事件'}</p>
    ${event?.kind === 'retry-scheduled' ? '<p class="notice">此步骤记录安排等待的逻辑时刻；累计计划等待已包含新安排的等待，下一次尝试在等待后的逻辑时刻开始。这不是实测耗时，不会实际等待或执行请求。</p>' : ''}
    ${stateMarkup(stateAt(trace, step))}
    ${event ? `<details><summary>这一步发生了什么</summary>${stateMarkup(event.details)}</details>` : ''}`;
}

export function metadataMarkup(pack: Pack): string {
  return `<details id="pack-context"><summary>参考资料</summary>
    ${readerSources(pack).map(item => evidenceMarkup(item)).join('')}
    <details><summary>结论的适用范围</summary>${claimsMarkup(pack.claims, 'source-', pack.evidence)}</details>
  </details>`;
}
