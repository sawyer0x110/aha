import { runScenario, stateAt } from '../core/engine.js';
import { createExploration } from '../core/exploration.js';
import { canonicalize } from '../core/identity.js';
import { validatePack } from '../core/pack.js';
import type { CompoundInput, Exploration, Input, Pack, RetryInput, Scenario, Trace } from '../core/schema.js';
import { enhanceTeaching } from '../renderers/teaching-html.js';
import {
  claimsMarkup, committedSummaryMarkup, fieldLabel, inputMarkup, modeLabels, reasonLabel, selectedStateMarkup,
  stateMarkup, traceVisual,
} from '../renderers/presentation.js';

type PanelId = 'a' | 'b';
type Panel = {
  id: PanelId;
  scenario: Scenario;
  trace: Trace;
  step: number;
  dirty: boolean;
  playing: boolean;
  timer: ReturnType<typeof setTimeout> | undefined;
};

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error('页面组件缺失，请重新生成 HTML。');
  return found as T;
}

function showError(error: unknown): string {
  if (error instanceof InputError) return error.message;
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const messages: Record<string, string> = {
    OUTCOME_MISSING: '尝试结果序列不完整：请为实际会执行到的每次尝试填写结果，系统不会补齐或默认成功。',
    CASHFLOW_LENGTH: '现金流项数必须与收益率期数完全相同，零现金流也必须明确填写。',
    PRINCIPAL_RANGE: '初始本金不能小于零。',
    RATE_RANGE: '每期收益率必须在 −100% 到 1000% 之间。',
    BALANCE_RANGE: '现金流导致透支：任何一期的取出金额都不能超过当时余额。',
    MODE_UNSUPPORTED: '此案例模式不受当前引擎支持，不能假装进行真实执行。',
    ENGINE_VERSION: '模型版本不兼容，请使用匹配版本重新生成页面。',
    EXPLORATION_PACK_MISMATCH: '探索记录与原解释包不匹配，不能导出。',
    EXPLORATION_TRACE_MISMATCH: '输入与轨迹校验不一致，不能导出。',
  };
  return messages[code] ?? '操作未完成：输入或解释包校验失败。请检查各字段的范围、格式和来源完整性，再重新运行。';
}

class InputError extends Error {}

function downloadExploration(exploration: Exploration): void {
  const blob = new Blob([JSON.stringify(exploration, null, 2)], { type: 'application/json;charset=utf-8' });
  if (blob.size > 4 * 1024 * 1024) throw new InputError('探索记录超过 4 MiB，无法作为有效文件导入；请减少所选案例。');
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${exploration.packId}.exploration.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  element('export-status').textContent = `已生成并发起下载：${exploration.packId}.exploration.json（${exploration.cases.length} 个案例）。如浏览器拦截下载，请允许本地文件下载后重试。`;
}

function readInput(panel: Panel, engine: Pack['modelSpec']['engine']): Input {
  const data = new FormData(element<HTMLFormElement>(`${panel.id}-form`));
  const text = (key: string): string => String(data.get(key) ?? '').trim();
  const integer = (key: string, min: number, max: number): number => {
    const raw = text(key);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < min || Number(raw) > max) {
      throw new InputError(`${fieldLabel(key)}必须是 ${min} 到 ${max} 之间的整数，不能为空。`);
    }
    return Number(raw);
  };
  const list = (key: string, allowEmpty = false): string[] => {
    const raw = text(key);
    if (raw === '' && allowEmpty) return [];
    const items = raw.split(',').map(item => item.trim());
    if (items.some(item => item === '')) {
      throw new InputError(`${fieldLabel(key)}存在空项；请用英文逗号分隔并明确填写每一项，不能自动补齐。`);
    }
    return items;
  };
  if (engine === 'retry') {
    const outcomes = list('outcomes');
    const retryableErrors = list('retryableErrors', true);
    if (outcomes.length > 21 || outcomes.some(item => !['transient', 'fatal', 'success'].includes(item))) {
      throw new InputError('尝试结果序列须为 1–21 项，只能填写 transient（暂时性错误）、fatal（致命错误）或 success（成功）。');
    }
    if (retryableErrors.length > 2 || new Set(retryableErrors).size !== retryableErrors.length
      || retryableErrors.some(item => !['transient', 'fatal'].includes(item))) {
      throw new InputError('允许重试的错误只能填写 transient、fatal，不能重复；空白表示都不重试。');
    }
    return {
      maxRetries: integer('maxRetries', 0, 20), baseDelayMs: integer('baseDelayMs', 0, 60000),
      multiplier: integer('multiplier', 1, 4), maxDelayMs: integer('maxDelayMs', 0, 3600000),
      outcomes: outcomes as RetryInput['outcomes'],
      retryableErrors: retryableErrors as RetryInput['retryableErrors'],
    };
  }
  if (engine === 'compound') {
    const decimal = (value: string, key: string): string => {
      if (!/^-?(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$/.test(value)) {
        throw new InputError(`${fieldLabel(key)}须为普通十进制数：整数部分最多 12 位、小数最多 6 位，不接受指数、空项或千位分隔符。`);
      }
      return value;
    };
    const principal = decimal(text('principal'), 'principal');
    const rates = list('rates').map(value => decimal(value, 'rates'));
    const cashflows = list('cashflows').map(value => decimal(value, 'cashflows'));
    if (rates.length > 120 || cashflows.length > 120) throw new InputError('最多支持 120 期，系统不会截断多余输入。');
    if (rates.length !== cashflows.length) throw new InputError('现金流项数必须与收益率期数完全相同，零现金流也必须明确填写。');
    const timing = text('timing');
    if (timing !== 'beginning' && timing !== 'end') throw new InputError('现金流时点只能选择期初或期末。');
    return { principal, rates, cashflows, timing } satisfies CompoundInput;
  }
  throw new InputError('材料阅读模式不提供数值计算。');
}

function fillInput(id: PanelId, input: Input): void {
  const form = element<HTMLFormElement>(`${id}-form`);
  for (const [key, value] of Object.entries(input)) {
    const control = form.elements.namedItem(key);
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) {
      control.value = Array.isArray(value) ? value.join(',') : String(value);
    }
  }
}

function initializeEvidence(pack: Pack): void {
  document.body.classList.remove('no-js-lab');
  const lesson = document.getElementById('lesson-selector') as HTMLSelectElement | null;
  if (lesson) lesson.disabled = false;
  lesson?.addEventListener('change', () => {
    document.querySelectorAll<HTMLElement>('[data-lesson-index]').forEach(page => {
      page.hidden = page.dataset.lessonIndex !== lesson.value;
    });
  });
  if (pack.teaching) enhanceTeaching(document.querySelector<HTMLElement>('[data-teaching="lab"]')!, pack.teaching, true);
  const select = element<HTMLSelectElement>('evidence-selector');
  select.disabled = false;
  const update = (): void => {
    const id = select.value;
    document.querySelectorAll<HTMLElement>('#evidence-cards [data-evidence-id]').forEach(card => {
      card.hidden = id !== '' && card.dataset.evidenceId !== id;
    });
    const claims = id === '' ? pack.claims : pack.claims.filter(claim => claim.evidenceIds.includes(id));
    element('evidence-claims').innerHTML = claimsMarkup(claims, 'reading-', pack.evidence);
    element('evidence-status').textContent = id === ''
      ? '全部参考资料'
      : `正在阅读：${pack.evidence.find(item => item.id === id)?.title ?? ''}`;
  };
  select.addEventListener('change', update);
  element('evidence-claims').addEventListener('click', event => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a');
    if (!link?.hash.startsWith('#reading-')) return;
    select.value = '';
    update();
  });
  const button = element<HTMLButtonElement>('evidence-export');
  button.disabled = false;
  button.addEventListener('click', () => {
    void (async () => {
      button.disabled = true;
      element('export-error').textContent = '';
      element('export-status').textContent = '';
      try {
        const evidenceIds = select.value === '' ? pack.evidence.map(item => item.id) : [select.value];
        const scenario: Scenario = {
          id: 'explore-evidence', title: '用户选定的材料与观点',
          mode: 'source-based', input: { evidenceIds },
          claimIds: pack.claims.filter(claim => claim.evidenceIds.some(id => evidenceIds.includes(id))).map(claim => claim.id),
        };
        const exploration = await createExploration(pack, [{
          scenario, trace: runScenario(pack.modelSpec, scenario),
          note: element<HTMLTextAreaElement>('evidence-note').value,
        }]);
        downloadExploration(exploration);
      } catch (error) {
        element('export-error').textContent = showError(error);
      } finally {
        button.disabled = false;
      }
    })();
  });
  update();
}

function initializeModels(pack: Pack): void {
  const panels = (['a', 'b'] as const).map((id, index): Panel => {
    const source = pack.scenarios[index] ?? pack.scenarios[0]!;
    const scenario = { ...structuredClone(source), id: `explore-${id}` };
    const trace = structuredClone(pack.traces.find(item => item.scenarioId === source.id)!);
    trace.scenarioId = scenario.id;
    return { id, scenario, trace, step: 0, dirty: false, playing: false, timer: undefined };
  });
  let exporting = false;

  function updateDifferences(): void {
    const forms = panels.map(panel => new FormData(element<HTMLFormElement>(`${panel.id}-form`)));
    const keys = [...forms[0]!.keys()];
    const pending = keys.filter(key => forms[0]!.get(key) !== forms[1]!.get(key));
    const committed = keys.filter(key =>
      canonicalize(Reflect.get(panels[0]!.scenario.input, key)) !==
      canonicalize(Reflect.get(panels[1]!.scenario.input, key)));
    for (const panel of panels) {
      const summaryStatus = element(`${panel.id}-summary-freshness`);
      summaryStatus.textContent = panel.dirty ? '尚未运行修改 · 摘要仍为上次成功结果' : '结果对应已运行输入 · 回放不改变最终结果';
      summaryStatus.classList.toggle('dirty', panel.dirty);
      element(`panel-${panel.id}`).querySelectorAll<HTMLElement>('[data-field-label]').forEach(label => {
        label.classList.toggle('different', pending.includes(label.dataset.fieldLabel!));
      });
    }
    element('input-differences').textContent =
      `当前表单差异：${pending.length ? pending.map(fieldLabel).join('、') : '无'}。` +
      `已运行输入差异：${committed.length ? committed.map(fieldLabel).join('、') : '无'}。` +
      (panels.some(panel => panel.dirty) ? '存在未运行修改；结果仍对应旧输入。' : '结果均对应当前输入。');
  }

  function stop(panel: Panel): void {
    if (panel.timer !== undefined) clearTimeout(panel.timer);
    panel.timer = undefined;
    panel.playing = false;
  }

  function updatePlaybackButtons(panel: Panel): void {
    const atEnd = panel.step === panel.trace.events.length;
    element<HTMLButtonElement>(`${panel.id}-prev`).disabled = panel.step === 0;
    element<HTMLButtonElement>(`${panel.id}-next`).disabled = atEnd;
    element<HTMLButtonElement>(`${panel.id}-pause`).disabled = !panel.playing;
    element<HTMLButtonElement>(`${panel.id}-resume`).disabled = panel.playing || atEnd;
    element<HTMLButtonElement>(`${panel.id}-play`).disabled = panel.playing || panel.trace.events.length === 0;
    element(`${panel.id}-playback-status`).textContent =
      `${panel.playing ? '播放中' : atEnd ? '已到末尾' : '已暂停'} · 第 ${panel.step} / ${panel.trace.events.length} 步` +
      (panel.dirty ? ' · 仍为修改前的轨迹' : '');
  }

  function displayStep(panel: Panel): void {
    // stateAt is the only replay state authority; elapsed wall time never changes the model.
    stateAt(panel.trace, panel.step);
    element(`${panel.id}-selected-state`).innerHTML = selectedStateMarkup(panel.trace, panel.step);
    element(`${panel.id}-visual`).innerHTML = traceVisual(panel.trace, panel.step, panel.id);
    element(`${panel.id}-timeline`).querySelectorAll<HTMLButtonElement>('[data-step]').forEach(button => {
      if (Number(button.dataset.step) === panel.step) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    updatePlaybackButtons(panel);
  }

  function displayRun(panel: Panel): void {
    element(`${panel.id}-summary`).innerHTML = committedSummaryMarkup(panel.scenario, panel.trace);
    element(`${panel.id}-mode`).textContent = '按所选条件计算';
    element(`${panel.id}-result`).innerHTML = stateMarkup(panel.trace.result);
    element(`${panel.id}-committed-input`).innerHTML = inputMarkup(panel.scenario.input);
    element(`${panel.id}-claims`).innerHTML = claimsMarkup(pack.claims.filter(claim => panel.scenario.claimIds.includes(claim.id)), 'source-', pack.evidence);
    const timeline = element<HTMLOListElement>(`${panel.id}-timeline`);
    timeline.replaceChildren();
    ['初始状态', ...panel.trace.events.map(event => reasonLabel(event.kind))].forEach((label, index) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.step = String(index);
      button.textContent = `${index} · ${label}`;
      button.addEventListener('click', () => {
        stop(panel);
        panel.step = index;
        displayStep(panel);
      });
      item.append(button);
      timeline.append(item);
    });
    displayStep(panel);
  }

  function markDirty(panel: Panel): void {
    panel.dirty = true;
    stop(panel);
    const status = element(`${panel.id}-freshness`);
    status.textContent = '输入已修改，尚未运行。下方结果与回放仍对应上次成功运行；请点击运行后再导出。';
    status.classList.add('dirty');
    element(`${panel.id}-error`).textContent = '';
    element('export-status').textContent = '';
    updatePlaybackButtons(panel);
    updateDifferences();
  }

  function schedule(panel: Panel): void {
    const interval = Number(element<HTMLSelectElement>(`${panel.id}-interval`).value);
    panel.timer = setTimeout(() => {
      if (!panel.playing) return;
      panel.step = Math.min(panel.trace.events.length, panel.step + 1);
      if (panel.step === panel.trace.events.length) stop(panel);
      displayStep(panel);
      if (panel.playing) schedule(panel);
    }, interval);
  }

  for (const panel of panels) {
    element(`panel-${panel.id}`).querySelectorAll<HTMLFieldSetElement>('[data-runtime-controls]').forEach(fieldset => { fieldset.disabled = false; });
    element<HTMLButtonElement>(`${panel.id}-run`).disabled = false;
    const form = element<HTMLFormElement>(`${panel.id}-form`);
    form.addEventListener('input', () => markDirty(panel));
    form.addEventListener('change', () => markDirty(panel));
    form.addEventListener('submit', event => {
      event.preventDefault();
      stop(panel);
      try {
        const presetId = element<HTMLSelectElement>(`${panel.id}-preset`).value;
        const preset = pack.scenarios.find(item => item.id === presetId)!;
        const scenario: Scenario = {
          ...structuredClone(preset), id: `explore-${panel.id}`,
          title: `探索案例 ${panel.id.toUpperCase()}（本次运行输入）`,
          input: readInput(panel, pack.modelSpec.engine),
        };
        const trace = runScenario(pack.modelSpec, scenario);
        panel.scenario = scenario;
        panel.trace = trace;
        panel.step = 0;
        panel.dirty = false;
        element(`${panel.id}-error`).textContent = '';
        const status = element(`${panel.id}-freshness`);
        status.textContent = '已成功重新计算；下方结果对应当前输入。回放已回到初始状态。';
        status.classList.remove('dirty');
        element('export-status').textContent = '';
        displayRun(panel);
      } catch (error) {
        panel.dirty = true;
        element(`${panel.id}-error`).textContent = showError(error);
        element(`${panel.id}-freshness`).textContent = '本次运行失败，结果未更新；不能导出这些未成功运行的修改。';
        element(`${panel.id}-freshness`).classList.add('dirty');
        updatePlaybackButtons(panel);
      }
      updateDifferences();
    });
    element<HTMLSelectElement>(`${panel.id}-preset`).addEventListener('change', event => {
      const preset = pack.scenarios.find(item => item.id === (event.target as HTMLSelectElement).value)!;
      fillInput(panel.id, preset.input);
      markDirty(panel);
    });
    for (const action of ['prev', 'next', 'reset'] as const) {
      element(`${panel.id}-${action}`).addEventListener('click', () => {
        stop(panel);
        panel.step = action === 'reset' ? 0 : Math.max(0, Math.min(panel.trace.events.length, panel.step + (action === 'next' ? 1 : -1)));
        displayStep(panel);
      });
    }
    element(`${panel.id}-play`).addEventListener('click', () => {
      stop(panel);
      panel.step = 0;
      panel.playing = true;
      displayStep(panel);
      schedule(panel);
    });
    element(`${panel.id}-pause`).addEventListener('click', () => {
      stop(panel);
      updatePlaybackButtons(panel);
    });
    element(`${panel.id}-resume`).addEventListener('click', () => {
      if (panel.step >= panel.trace.events.length) return;
      stop(panel);
      panel.playing = true;
      updatePlaybackButtons(panel);
      schedule(panel);
    });
    element(`${panel.id}-interval`).addEventListener('change', () => {
      if (panel.playing) {
        if (panel.timer !== undefined) clearTimeout(panel.timer);
        schedule(panel);
      }
    });
    displayRun(panel);
  }
  updateDifferences();
  const exportButton = element<HTMLButtonElement>('export-exploration');
  exportButton.disabled = false;
  exportButton.addEventListener('click', () => { void exportCases(); });

  async function exportCases(): Promise<void> {
    if (exporting) return;
    element('export-error').textContent = '';
    element('export-status').textContent = '';
    try {
      const selected = panels.filter(panel => element<HTMLInputElement>(`${panel.id}-export`).checked);
      if (!selected.length) throw new InputError('请至少勾选一个案例，才能下载探索记录。');
      if (selected.some(panel => panel.dirty)) throw new InputError('所选案例存在未运行或运行失败的修改。请先成功运行，或取消勾选该案例；不会把新输入冒充已运行结果。');
      const cases = selected.map(panel => ({
        scenario: structuredClone(panel.scenario), trace: structuredClone(panel.trace),
        note: element<HTMLTextAreaElement>(`${panel.id}-note`).value,
      }));
      exporting = true;
      exportButton.disabled = true;
      const exploration = await createExploration(pack, cases);
      downloadExploration(exploration);
    } catch (error) {
      element('export-error').textContent = showError(error);
    } finally {
      exporting = false;
      exportButton.disabled = false;
    }
  }
}

async function bootstrap(): Promise<void> {
  const pack = await validatePack(JSON.parse(element('aha-pack').textContent ?? ''));
  // A fragment link must reveal collapsed source details before the browser scrolls to it.
  document.addEventListener('click', event => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a');
    if (!link?.getAttribute('href')?.startsWith('#')) return;
    const target = document.getElementById(link.hash.slice(1));
    let ancestor: HTMLElement | null = target;
    while (ancestor) {
      if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
      ancestor = ancestor.parentElement;
    }
    if (target) {
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
  });
  if (pack.modelSpec.engine === 'evidence') initializeEvidence(pack);
  else initializeModels(pack);
}

void bootstrap().catch(() => {
  document.documentElement.removeAttribute('data-teaching-runtime');
  const alert = document.createElement('p');
  alert.setAttribute('role', 'alert');
  alert.textContent = '页面交互初始化失败。仍可阅读静态内容；请用匹配版本的工具重新生成 HTML。';
  document.querySelector('main')?.prepend(alert);
});
