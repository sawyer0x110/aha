import type { Pack, Teaching, TeachingCheck, TeachingState, TeachingTransition } from '../core/schema.js';
import { teachingCheck, teachingOutcome, transitionContext } from '../core/teaching.js';
import { escapeHtml, sourceLinksMarkup } from './presentation.js';

const e = escapeHtml;

export function teachingBasis(teaching: Teaching): string {
  return `<p class="teaching-basis">${teaching.basis.kind === 'recorded-example' ? '已记录的示例' : '依据资料整理的示例'} · ${e(teaching.basis.note)}</p>`;
}

export function teachingScope(pack: Pack): string {
  const conditions = pack.brief.explanation?.conditions ?? [];
  return conditions.length ? `<p class="teaching-basis teaching-scope">适用范围：${conditions.map(e).join(' ')}</p>` : '';
}

function contentMarkup(content: string, changes: number[] = []): string {
  if (!content) return '<pre class="teaching-code teaching-empty"><code>（空）</code></pre>';
  const lines = content.split('\n');
  // A final newline terminates the last line; it is not an extra blank content row.
  if (lines.at(-1) === '') lines.pop();
  return `<pre class="teaching-code"><code>${lines.map((line, index) =>
    `<span class="teaching-line${changes.includes(index) ? ' is-changed' : ''}"${changes.includes(index) ? ' data-changed-line' : ''}>${e(line)}</span>`).join('\n')}${content.endsWith('\n') ? '\n' : ''}</code></pre>`;
}

export function teachingStateMarkup(teaching: Teaching, state: TeachingState, transitionId?: string): string {
  const context = transitionId ? transitionContext(teaching, transitionId) : undefined;
  return `<div class="teaching-state" data-teaching-state="${e(state.id)}">
    <p class="state-caption">${e(state.label)}</p>
    <div class="entity-grid" data-entity-count="${teaching.entities.length}">${teaching.entities.map(entity => {
      const value = state.values.find(item => item.entityId === entity.id)!;
      const change = context?.changes.find(item => item.entity.id === entity.id);
      return `<article class="entity${change?.changed ? ' entity-changed' : ''}" data-entity-id="${e(entity.id)}"${change ? ` data-changed="${change.changed}"` : ''}>
        <header><h3>${e(entity.label)}</h3>${change ? `<span class="state-status">${change.changed ? '已改变' : '保持原样'}</span>` : ''}</header>
        <p class="value-label">${e(value.label)}</p>${contentMarkup(value.content, change?.changedLines)}
      </article>`;
    }).join('')}</div></div>`;
}

export function teachingOperationMarkup(teaching: Teaching, transition: TeachingTransition, showRoute = true): string {
  const target = teaching.entities.find(item => item.id === transition.targetEntityId)!;
  const source = teaching.entities.find(item => item.id === transition.copyFromEntityId);
  return `<div class="teaching-operation" aria-label="${e(transition.action)}">
    <span class="operation-arrow" aria-hidden="true">↓</span><div><strong>${e(transition.action)}</strong>
      ${transition.command ? `<code>${e(transition.command)}</code>` : ''}
    </div>${showRoute ? `<span class="operation-route">${source ? `${e(source.label)} <span aria-hidden="true">→</span> ` : ''}${e(target.label)}</span>` : ''}
  </div>`;
}

export function teachingConnectorMarkup(teaching: Teaching, transition: TeachingTransition, sameRow = false): string {
  const sourceId = transition.copyFromEntityId ?? transition.targetEntityId;
  const x = (id: string) => (teaching.entities.findIndex(entity => entity.id === id) + 0.5) * 1000 / teaching.entities.length;
  const source = x(sourceId);
  const target = x(transition.targetEntityId);
  const end = sameRow ? 4 : 60;
  return `<figure class="entity-connector" data-copy-from="${e(sourceId)}" data-copy-to="${e(transition.targetEntityId)}">
    <svg viewBox="0 0 1000 64" preserveAspectRatio="none" role="img" aria-label="${e(transition.action)}">
      <path d="M ${source} 0 V 32 H ${target} V ${end}" class="connector-line"></path>
      <path d="M ${target - 7} ${sameRow ? 12 : 52} L ${target} ${end} L ${target + 7} ${sameRow ? 12 : 52}" class="connector-line"></path>
    </svg><figcaption><strong>${e(transition.action)}</strong>${transition.command ? `<code>${e(transition.command)}</code>` : ''}</figcaption></figure>`;
}

export function teachingOutcomeMarkup(teaching: Teaching, showState = false): string {
  const { outcome, state, entity, value } = teachingOutcome(teaching);
  return `<div class="teaching-outcome" data-teaching-outcome data-outcome-state="${e(state.id)}">
    ${showState ? teachingStateMarkup(teaching, state) : ''}
    <div class="entity-grid outcome-relation" data-entity-count="${teaching.entities.length}">${teaching.entities.map(item =>
      item.id === entity.id ? `<div class="outcome-result" data-outcome-source="${e(entity.id)}">
        <div class="outcome-arrow"><span class="hypothetical-arrow" aria-hidden="true"></span><span>如果此刻执行 <code>${e(outcome.action)}</code></span></div>
        <article class="outcome-copy"><h3>${e(outcome.label)}</h3>${contentMarkup(value.content)}</article>
      </div>` : '<div aria-hidden="true"></div>').join('')}</div>
    <p class="outcome-explanation">${e(outcome.explanation)}</p></div>`;
}

export function teachingCheckMarkup(check: TeachingCheck): string {
  return `<fieldset class="teaching-check" data-check-id="${e(check.id)}">
    <legend>${check.kind === 'transfer' ? '换个情境，再判断' : '先预测，再揭晓'}</legend>
    <p class="check-prompt">${e(check.question)}</p>
    <div class="teaching-choices">${check.choices.map(choice =>
      `<button type="button" data-choice-id="${e(choice.id)}" aria-pressed="false" disabled><span>${e(choice.text)}</span></button>`).join('')}</div>
    <p data-teaching-feedback role="status" aria-live="polite" aria-atomic="true"></p>
    <details data-teaching-answer><summary>阅读答案与原因</summary>${check.choices.map(choice =>
      `<p><strong>${choice.id === check.correctChoiceId ? '正确' : '需要再想想'} · ${e(choice.text)}</strong><br>${e(choice.feedback)}</p>`).join('')}</details>
  </fieldset>`;
}

export function teachingLabMarkup(teaching: Teaching): string {
  return `<section class="teaching-lab" id="observe" data-teaching="lab" aria-label="逐步回放">
    <div class="teaching-intro"><p class="eyebrow">观察 → 预测 → 核对</p><p>先看当前内容。选一个预测，再揭晓这一步留下的结果。</p><p class="teaching-safety">只回放保存状态，不执行命令或修改文件。</p></div>
    <div class="teaching-progress" aria-label="回放进度">${teaching.transitions.map((transition, index) =>
      `<span data-progress-step="${index}"><b>${index + 1}</b>${e(transition.action)}</span>`).join('')}</div>
    ${teaching.transitions.map((transition, index) => {
      const context = transitionContext(teaching, transition.id);
      return `<section class="teaching-turn" data-transition-id="${e(transition.id)}" data-teaching-turn="${index}" tabindex="-1">
        <div class="turn-heading"><p class="eyebrow">第 ${index + 1} / ${teaching.transitions.length} 步</p><h2>${e(transition.action)}</h2></div>
        <div data-teaching-before>${teachingStateMarkup(teaching, context.before)}</div>
        ${teachingOperationMarkup(teaching, transition, false)}
        ${teachingCheckMarkup(teachingCheck(teaching, transition.predictionId))}
        <button class="primary" type="button" data-teaching-reveal disabled>揭晓这一步</button>
        <div data-teaching-result><h3 class="result-heading">核对保存的结果</h3>
          ${teachingStateMarkup(teaching, context.after, transition.id)}
          <p class="teaching-reason">${e(transition.explanation)}</p>
          ${teaching.outcome?.fromStateId === context.after.id ? teachingOutcomeMarkup(teaching) : ''}
        </div>
        <button type="button" data-teaching-next disabled>${index === teaching.transitions.length - 1 ? '换个情境试试 →' : '下一步 →'}</button>
      </section>`;
    }).join('')}
    <section class="teaching-transfer" data-teaching-transfer tabindex="-1">
      <p class="eyebrow">现在，由你判断</p><h2>不照搬答案，试着迁移</h2>
      ${teaching.checks.filter(check => check.kind === 'transfer').map(teachingCheckMarkup).join('')}
      <div data-teaching-conclusion><p class="teaching-takeaway">${e(teaching.card.takeaway)}</p></div>
    </section>
    <div class="toolbar teaching-controls"><button type="button" data-teaching-restart disabled>从头预测</button><p data-teaching-status role="status" aria-live="polite"></p></div>
  </section>`;
}

export function teachingCardMarkup(pack: Pack): string {
  const teaching = pack.teaching!;
  let previous: string | undefined;
  return `<article id="aha-card" class="teaching-card" data-teaching="card" aria-label="状态与操作解释卡片">
    <header><div class="capture-kicker"><span>Aha · 看见变化的那一步</span>${pack.manifest.visibility === 'private' ? '<span>私密资料</span>' : ''}</div>
      <h1 class="capture-title">${e(teaching.card.headline)}</h1><p class="card-summary">${e(teaching.card.summary)}</p></header>
    <div class="teaching-timeline">${teaching.card.transitionIds.map(id => {
      const context = transitionContext(teaching, id);
      const before = previous === context.before.id ? '' : teachingStateMarkup(teaching, context.before);
      previous = context.after.id;
      return `${before}<section data-transition-id="${e(id)}">${teachingConnectorMarkup(teaching, context.transition)}
        ${teachingStateMarkup(teaching, context.after, id)}
        ${teaching.outcome?.fromStateId === context.after.id ? teachingOutcomeMarkup(teaching) : ''}</section>`;
    }).join('')}</div>
    <p class="teaching-takeaway">${e(teaching.card.takeaway)}</p>
    <footer class="capture-footer">${teachingScope(pack)}${teachingBasis(teaching)}<p>参考：${sourceLinksMarkup(pack.evidence.filter(item => teaching.basis.evidenceIds.includes(item.id)))}</p></footer>
  </article>`;
}

export function teachingSceneMarkup(pack: Pack, slide: Pack['narrative']['slides'][number]): string {
  const teaching = pack.teaching!;
  const scene = slide.scene!;
  const context = scene.transitionId ? transitionContext(teaching, scene.transitionId) : undefined;
  if (scene.kind === 'hook') {
    const check = teachingCheck(teaching, context!.transition.predictionId);
    const after = scene.statePhase === 'after';
    return `<div class="scene-hook"><p class="hook-question">${e(after ? slide.body : check.question)}</p>
      ${teachingStateMarkup(teaching, after ? context!.after : context!.before)}
      <p class="hook-invitation">${after ? '先比较当前内容，再说明你的判断。' : `接下来：${e(context!.transition.action)} <span aria-hidden="true">→</span> 你预测什么会变？`}</p></div>`;
  }
  if (scene.kind === 'transition') return `<div class="scene-transition" data-transition-id="${e(context!.transition.id)}">
    ${teachingOperationMarkup(teaching, context!.transition)}
    <div class="entity-grid transition-comparison" data-entity-count="${teaching.entities.length}">${context!.changes.map(change =>
      `<article class="entity${change.changed ? ' entity-changed' : ' entity-frozen'}" data-entity-id="${e(change.entity.id)}" data-changed="${change.changed}">
        <header><h3>${e(change.entity.label)}</h3><span class="state-status">${change.changed ? '已改变' : '保持原样'}</span></header>
        ${change.changed ? `<p class="value-label">操作前 · ${e(change.before.label)}</p>${contentMarkup(change.before.content)}
          <div class="content-change-arrow" aria-hidden="true">↓</div>
          <p class="value-label">操作后 · ${e(change.after.label)}</p>${contentMarkup(change.after.content, change.changedLines)}`
          : `<div class="frozen-content"><p class="value-label">操作前后 · ${e(change.after.label)}</p>${contentMarkup(change.after.content)}<p class="frozen-label">这一步没有改动这里</p></div>`}
      </article>`).join('')}</div><p class="teaching-reason">${e(context!.transition.explanation)}</p></div>`;
  if (scene.kind === 'mechanism') {
    const transition = context!.transition;
    const target = teaching.entities.find(entity => entity.id === transition.targetEntityId)!;
    return `<div class="scene-mechanism"><div class="mechanism-flow">
      ${teachingStateMarkup(teaching, context!.after, transition.id)}${teachingConnectorMarkup(teaching, transition, true)}
      </div><p class="teaching-reason">${e(transition.explanation)}</p>
      <p class="frozen-note">保持原样：${teaching.entities.filter(entity => entity.id !== target.id).map(entity => e(entity.label)).join('、')}。箭头表示这一次操作，不是持续同步。</p></div>`;
  }
  if (scene.kind === 'transfer') return `<div class="scene-transfer" data-teaching="check">${teachingCheckMarkup(teachingCheck(teaching, scene.checkId!))}</div>`;
  if (scene.kind === 'outcome') {
    return `<div class="scene-outcome">${teachingOutcomeMarkup(teaching, true)}</div>`;
  }
  if (scene.kind === 'answer') {
    const check = teachingCheck(teaching, scene.checkId!);
    const correct = check.choices.find(choice => choice.id === check.correctChoiceId)!;
    return `<div class="scene-answer" data-teaching-answer-scene>
      <div class="answer-verdict"><p class="eyebrow">符合这个情境的判断</p><p class="answer-value">${e(correct.text)}</p><p class="answer-reason">${e(correct.feedback)}</p></div>
      <div class="answer-alternatives">${check.choices.filter(choice => choice.id !== correct.id).map(choice =>
        `<p><strong>${e(choice.text)}</strong><span>${e(choice.feedback)}</span></p>`).join('')}</div>
      ${teachingScope(pack)}</div>`;
  }
  return `<div class="scene-takeaway"><span class="takeaway-mark" aria-hidden="true">↳</span><p class="teaching-takeaway">${e(teaching.card.takeaway)}</p>
    <div class="takeaway-path">${teaching.card.transitionIds.map(id => {
      const transition = transitionContext(teaching, id).transition;
      return `<span>${e(transition.action)}</span>`;
    }).join('<b aria-hidden="true">→</b>')}</div>${teachingScope(pack)}${teachingBasis(teaching)}</div>`;
}

/** Enhance the readable record only after the validated plan and all controls exist. */
export function enhanceTeaching(root: HTMLElement, teaching: Teaching, sequence = false): void {
  const turns = [...root.querySelectorAll<HTMLElement>('[data-teaching-turn]')];
  const transfer = root.querySelector<HTMLElement>('[data-teaching-transfer]');
  const completed = new Set<string>();
  function prepareChecks(): void {
    root.querySelectorAll<HTMLElement>('[data-check-id]').forEach(field => {
      const check = teachingCheck(teaching, field.dataset.checkId!);
      field.querySelector<HTMLElement>('[data-teaching-answer]')!.hidden = true;
      const feedback = field.querySelector<HTMLElement>('[data-teaching-feedback]')!;
      feedback.textContent = '';
      field.querySelectorAll<HTMLButtonElement>('[data-choice-id]').forEach(button => {
        button.disabled = false;
        button.setAttribute('aria-pressed', 'false');
        button.onclick = () => {
          const choice = check.choices.find(item => item.id === button.dataset.choiceId)!;
          field.querySelectorAll<HTMLButtonElement>('[data-choice-id]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
          const correct = choice.id === check.correctChoiceId;
          feedback.textContent = `${correct ? '判断正确。' : '再想一步。'}${choice.feedback}`;
          feedback.dataset.correct = String(correct);
          const reveal = field.closest('[data-teaching-turn]')?.querySelector<HTMLButtonElement>('[data-teaching-reveal]');
          if (reveal) reveal.disabled = false;
          if (correct) completed.add(check.id);
          else completed.delete(check.id);
          const conclusion = root.querySelector<HTMLElement>('[data-teaching-conclusion]');
          if (conclusion) conclusion.hidden = !teaching.checks.filter(item => item.kind === 'transfer').every(item => completed.has(item.id));
        };
      });
    });
  }
  function show(index: number, focus = true): void {
    turns.forEach((turn, i) => { turn.hidden = i !== index; });
    if (transfer) transfer.hidden = index < turns.length;
    root.querySelectorAll<HTMLElement>('[data-progress-step]').forEach((step, i) => {
      if (i === index) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
    const status = root.querySelector<HTMLElement>('[data-teaching-status]');
    if (status) status.textContent = index < turns.length ? `第 ${index + 1} 步，先预测。` : '回放完成，试试新的情境。';
    if (focus) (turns[index] ?? transfer)?.focus({ preventScroll: false });
  }
  function reset(focus = true): void {
    completed.clear();
    prepareChecks();
    turns.forEach(turn => {
      turn.querySelector<HTMLElement>('[data-teaching-before]')!.hidden = false;
      turn.querySelector<HTMLElement>('[data-teaching-result]')!.hidden = true;
      const reveal = turn.querySelector<HTMLButtonElement>('[data-teaching-reveal]')!;
      reveal.disabled = true;
      reveal.hidden = false;
      turn.querySelector<HTMLButtonElement>('[data-teaching-next]')!.hidden = true;
    });
    const conclusion = root.querySelector<HTMLElement>('[data-teaching-conclusion]');
    if (conclusion) conclusion.hidden = true;
    if (sequence) show(0, focus);
  }
  turns.forEach((turn, index) => {
    const reveal = turn.querySelector<HTMLButtonElement>('[data-teaching-reveal]')!;
    const next = turn.querySelector<HTMLButtonElement>('[data-teaching-next]')!;
    reveal.addEventListener('click', () => {
      turn.querySelector<HTMLElement>('[data-teaching-before]')!.hidden = true;
      const result = turn.querySelector<HTMLElement>('[data-teaching-result]')!;
      result.hidden = false;
      result.tabIndex = -1;
      reveal.hidden = true;
      next.disabled = false;
      next.hidden = false;
      const status = root.querySelector<HTMLElement>('[data-teaching-status]');
      if (status) status.textContent = `第 ${index + 1} 步的保存结果已揭晓。${teaching.transitions[index]!.explanation}`;
      result.focus();
    });
    next.addEventListener('click', () => show(index + 1));
  });
  root.querySelectorAll<HTMLButtonElement>('[data-teaching-restart]').forEach(button => {
    button.disabled = false;
    button.addEventListener('click', () => reset());
  });
  reset(false);
  root.classList.add('teaching-ready');
}
