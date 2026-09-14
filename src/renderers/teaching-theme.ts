export const teachingCss = `
.teaching-page, .teaching-card, .teaching-scene-capture { font-family: "Segoe UI", Aptos, Calibri, "Microsoft YaHei", "PingFang SC", sans-serif; }
html[data-teaching-runtime] .teaching-lab:not(.teaching-ready) :is([data-teaching-result], [data-teaching-answer], [data-teaching-transfer], [data-teaching-next], [data-teaching-turn]:not([data-teaching-turn="0"])) { display: none; }
.teaching-page main, .teaching-page .page-header, .teaching-page .page-footer { max-width: 1120px; }
.teaching-page .page-header { padding-top: 32px; }
.teaching-page .page-header h1 { max-width: 28em; }
.teaching-intro { display: grid; grid-template-columns: 1fr auto; gap: 0 32px; padding-bottom: 16px; }
.teaching-intro > .eyebrow { grid-column: 1; }
.teaching-intro .teaching-safety { grid-column: 2; grid-row: 1 / 3; align-self: center; font-size: 12px; color: var(--cp-text-muted); margin: 0; }
.teaching-basis { font-size: 13px; line-height: 1.5; color: var(--cp-text-muted); margin: 0; }
.teaching-progress { display: flex; gap: 12px; border-top: 1px solid var(--cp-border); padding: 16px 0 24px; }
.teaching-progress > span { display: flex; align-items: center; gap: 8px; color: var(--cp-text-muted); font-size: 14px; flex: 1; }
.teaching-progress b { border: 1px solid var(--cp-border-strong); border-radius: 50%; width: 28px; height: 28px; flex: 0 0 28px; text-align: center; }
.teaching-progress [aria-current] { color: var(--cp-accent); font-weight: 600; }
.teaching-progress [aria-current] b { background: var(--cp-accent); color: var(--cp-accent-fg); border-color: var(--cp-accent); }
.teaching-turn, .teaching-transfer { margin-bottom: 32px; }
.turn-heading { display: flex; align-items: baseline; gap: 16px; }
.turn-heading h2 { font-size: 24px; }
.entity-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.entity-grid[data-entity-count="3"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.entity { min-width: 0; border: 1px solid var(--cp-border); border-top: 3px solid var(--cp-border-strong); background: var(--cp-surface); border-radius: 10px; overflow: hidden; }
.entity header { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 12px 16px 0; }
.entity h3 { margin: 0; font-size: 17px; }
.entity-changed { border-top-color: var(--cp-accent); }
.entity-changed .state-status { color: var(--cp-accent); }
.state-status { color: var(--cp-text-muted); font-size: 12px; white-space: nowrap; font-weight: 600; }
.state-caption { color: var(--cp-text-muted); font-size: 13px; margin: 0 0 8px; }
.value-label { color: var(--cp-text-muted); font-size: 13px; margin: 4px 16px 8px; }
.teaching-code { margin: 0; padding: 8px 0 12px; min-height: 56px; background: var(--cp-bg-elevated); color: var(--cp-text); text-align: left; white-space: pre-wrap; overflow-wrap: anywhere; tab-size: 2; }
.teaching-code code { display: block; white-space: normal; font: 16px/1.55 Consolas, "Courier New", "Microsoft YaHei", monospace; }
.teaching-line { display: block; white-space: pre-wrap; min-height: 1.55em; padding: 0 16px; }
.teaching-line.is-changed { background: var(--cp-highlight); font-weight: 600; box-shadow: inset 3px 0 var(--cp-accent); }
.teaching-empty { color: var(--cp-text-muted); padding-left: 24px; }
.teaching-operation { display: flex; gap: 16px; align-items: center; padding: 12px 20px; min-height: 64px; }
.operation-arrow { font-size: 36px; line-height: 1; color: var(--cp-accent); }
.teaching-operation > div { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 16px; }
.teaching-operation code { color: var(--cp-accent); font-size: 15px; }
.operation-route { margin-left: auto; color: var(--cp-text-muted); font-size: 13px; }
.operation-route span { color: var(--cp-accent); padding: 0 8px; }
.entity-connector { position: relative; margin: 0; height: 64px; }
.entity-connector svg { display: block; width: 100%; height: 64px; overflow: visible; }
.connector-line { fill: none; stroke: var(--cp-accent); stroke-width: 2; vector-effect: non-scaling-stroke; }
.entity-connector figcaption { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); display: flex; align-items: baseline; gap: 12px; padding: 0 12px; background: var(--cp-bg); white-space: nowrap; font-size: 16px; }
.entity-connector code { color: var(--cp-accent); }
.teaching-page .reveal .entity-connector figcaption { background: var(--cp-surface); }
.outcome-arrow { display: flex; align-items: center; gap: 12px; min-height: 44px; font-size: 15px; }
.hypothetical-arrow { position: relative; display: block; height: 32px; width: 16px; flex: 0 0 16px; }
.hypothetical-arrow::before { content: ""; position: absolute; left: 8px; top: 0; bottom: 2px; border-left: 2px dashed var(--cp-accent); }
.hypothetical-arrow::after { content: ""; position: absolute; left: 4px; bottom: 2px; width: 8px; height: 8px; border-right: 2px solid var(--cp-accent); border-bottom: 2px solid var(--cp-accent); transform: rotate(45deg); }
.outcome-copy { border: 2px dashed var(--cp-accent); border-radius: 10px; min-width: 0; }
.outcome-copy h3 { margin: 0; padding: 8px 16px; font-size: 17px; }
.outcome-explanation { margin: 12px 0 4px; font-size: 16px; }
.teaching-check { background: var(--cp-bg-elevated); border: 0; border-left: 3px solid var(--cp-accent); padding: 12px 20px 16px; margin: 12px 0 16px; }
.teaching-check legend { color: var(--cp-accent); padding-left: 0; font-size: 14px; }
.check-prompt { font-size: 20px; font-weight: 600; }
.teaching-choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.teaching-choices button { display: flex; gap: 12px; align-items: baseline; text-align: left; background: var(--cp-surface); min-width: 0; }
.teaching-choices button[aria-pressed="true"] { border-color: var(--cp-accent); background: var(--cp-accent-soft); }
[data-teaching-feedback] { color: var(--cp-text); }
[data-teaching-feedback]:not(:empty) { padding: 12px 0 0; margin: 0; }
[data-teaching-feedback][data-correct="true"]::before { content: "✓"; color: var(--cp-success); margin-right: 8px; font-weight: 700; }
.teaching-reason { padding: 12px 16px; margin: 16px 0; border-left: 3px solid var(--cp-accent); background: var(--cp-accent-soft); font-size: 18px; line-height: 1.55; }
.result-heading { margin-top: 20px; font-size: 16px; }
.teaching-controls { border-top: 1px solid var(--cp-border); padding-top: 16px; justify-content: space-between; }
.teaching-controls p { color: var(--cp-text-muted); font-size: 13px; margin: 0; }
.teaching-takeaway { font-size: 28px; line-height: 1.4; font-weight: 700; padding: 24px 0 0; border-top: 3px solid var(--cp-accent); }
.teaching-page #reading-sources { margin-top: 32px; }
.teaching-page .deck-shell { height: calc(100vh - 146px); min-height: 420px; }
.teaching-page .reveal .slides > section { padding: 24px 36px; font-size: 20px; }
.teaching-page .reveal .lesson-body { font-size: 19px; max-width: 62em; color: var(--cp-text-muted); margin-bottom: 20px; }
.teaching-page .reveal h2 { font-size: 32px; }
.teaching-page .reveal p { margin: 0 0 12px; }
.teaching-page .reveal .value-label { margin: 4px 16px 8px; }
.teaching-page .reveal .state-caption { margin: 0 0 8px; }
.teaching-page .reveal .teaching-code { width: auto; box-shadow: none; margin: 0; }
.teaching-page .reveal .teaching-code code { max-height: none; padding: 0; font-size: 16px; }
.teaching-page .reveal .slide-mode { position: absolute; top: 16px; right: 24px; color: var(--cp-text-muted); font-size: 12px; }
.teaching-page .reveal h2 { line-height: 1.3; padding-right: 48px; margin-bottom: 20px; }
.teaching-page .reveal .slide-sources { padding: 8px 12px; font-size: 13px; margin-top: 16px; }
.scene-hook { padding: 16px 0; }
.hook-question { font-size: 34px; font-weight: 700; max-width: 30em; padding-bottom: 20px; }
.hook-question { white-space: pre-line; }
.hook-invitation { font-size: 20px; margin-top: 24px; color: var(--cp-accent); }
.scene-transition .entity header { padding-top: 8px; }
.scene-transition .teaching-code { padding-top: 4px; padding-bottom: 6px; min-height: 40px; }
.scene-transition .teaching-operation { padding-top: 8px; padding-bottom: 8px; min-height: 48px; }
.scene-transition .eyebrow { margin-bottom: 2px; }
.scene-transition .state-caption { margin-bottom: 4px; }
.scene-transition .teaching-reason { margin-top: 12px; font-size: 18px; }
.transition-comparison .entity { padding-bottom: 8px; }
.transition-comparison .content-change-arrow { color: var(--cp-accent); font-size: 28px; line-height: 1; padding: 4px 20px; }
.transition-comparison .entity-frozen { display: flex; flex-direction: column; }
.frozen-content { margin: auto 0; padding: 12px 0; }
.frozen-label { color: var(--cp-text-muted); font-size: 14px; padding: 12px 16px 0; }
.mechanism-flow { margin: 24px 0; }
.mechanism-arrow { color: var(--cp-accent); text-align: center; font-size: 16px; }
.mechanism-arrow b { display: block; font-size: 64px; line-height: 1; }
.frozen-note { color: var(--cp-text-muted); font-size: 18px; }
.scene-transfer { max-width: 960px; margin: 16px auto; }
.scene-transfer .check-prompt { font-size: 28px; margin-bottom: 24px; }
.scene-transfer .teaching-check { padding: 24px; }
.scene-transfer [data-teaching-feedback] { font-size: 20px; }
.scene-takeaway { padding: 16px 32px; }
.takeaway-mark { color: var(--cp-accent); font-size: 72px; line-height: 1; }
.scene-takeaway .teaching-takeaway { border: 0; padding-top: 8px; font-size: 40px; max-width: 26em; }
.takeaway-path { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; padding: 16px 0 24px; font-size: 19px; }
.takeaway-path b { color: var(--cp-accent); }
.scene-outcome { padding: 0; }
.teaching-page .reveal .scene-outcome .outcome-explanation { margin: 12px 0 4px; font-size: 18px; }
.teaching-page .reveal .scene-outcome .teaching-basis { margin: 0; }
.scene-answer { padding: 16px 24px; }
.answer-verdict { border-left: 4px solid var(--cp-accent); padding-left: 24px; }
.teaching-page .reveal .answer-value { font-size: 48px; font-weight: 700; color: var(--cp-accent); line-height: 1.15; }
.answer-reason { font-size: 24px; }
.answer-alternatives { border-top: 1px solid var(--cp-border); padding-top: 16px; margin: 20px 0; }
.answer-alternatives p { display: grid; grid-template-columns: minmax(48px, .2fr) 1fr; gap: 16px; font-size: 18px; }
.answer-alternatives strong { color: var(--cp-text-muted); }
.teaching-card .card-summary { font-size: 23px; line-height: 1.5; max-width: 40em; margin-bottom: 16px; }
#aha-card.teaching-card { padding: 32px 48px; max-height: none; min-height: 1100px; }
.teaching-card .capture-title { font-size: 42px; }
.teaching-card .entity-grid { gap: 24px; }
.teaching-card .entity header { padding-top: 8px; }
.teaching-card .entity h3 { font-size: 21px; line-height: 1.3; }
.teaching-card .value-label { font-size: 15px; margin-top: 2px; margin-bottom: 4px; }
.teaching-card .state-caption { font-size: 15px; }
.teaching-card .teaching-code code { font-size: 21px; line-height: 1.45; }
.teaching-card .teaching-line { min-height: 1.45em; }
.teaching-card .teaching-code { padding-top: 4px; padding-bottom: 8px; min-height: 58px; }
.teaching-card .state-status { font-size: 14px; }
.teaching-card .teaching-operation { padding: 12px 16px; min-height: 60px; }
.teaching-card .teaching-operation strong { font-size: 20px; }
.teaching-card .teaching-operation code { font-size: 18px; }
.timeline-reason { font-size: 16px; color: var(--cp-text-muted); margin: 8px 0 12px; padding-left: 16px; border-left: 2px solid var(--cp-border-strong); }
.teaching-card .teaching-takeaway { margin-top: 16px; font-size: 28px; padding-top: 12px; }
.teaching-card .capture-footer { margin-top: 12px; }
.teaching-card .capture-footer p { font-size: 13px; }
.teaching-card .entity-connector, .teaching-card .entity-connector svg { height: 56px; }
.teaching-card .entity-connector figcaption { font-size: 18px; top: 12px; }
.teaching-card .outcome-explanation { font-size: 14px; margin-top: 8px; }
.teaching-card .outcome-copy h3 { font-size: 16px; padding: 4px 16px; }
.teaching-card .outcome-copy .teaching-code code { font-size: 18px; }
.teaching-card .outcome-copy .teaching-code { min-height: 0; padding: 4px 0; }
.teaching-scene-capture .scene-hook { padding: 4px 0; }
.teaching-scene-capture .hook-question { font-size: 30px; padding-bottom: 8px; }
.teaching-scene-capture .mechanism-flow { margin: 20px 0; }
.teaching-scene-capture .teaching-check { margin: 0; }
.teaching-scene-capture .scene-transfer { margin: 12px auto; }
.teaching-scene-capture .scene-transfer .check-prompt { font-size: 24px; margin-bottom: 12px; }
.teaching-scene-capture .scene-takeaway { padding: 8px 24px; }
.teaching-scene-capture .scene-takeaway .teaching-takeaway { font-size: 34px; }
.teaching-scene-capture [data-teaching-answer] { display: none; }
@media (max-width: 600px) {
  .teaching-intro { display: block; }
  .teaching-intro .teaching-safety { margin-top: 8px; }
  .teaching-progress { gap: 6px; padding-bottom: 16px; }
  .teaching-progress > span { font-size: 11px; align-items: flex-start; flex-direction: column; }
  .turn-heading { display: block; }
  .entity-grid, .entity-grid[data-entity-count="3"] { gap: 8px; }
  .entity header { display: block; padding: 8px 8px 0; }
  .entity h3 { font-size: 14px; }
  .state-status { font-size: 11px; }
  .value-label { margin: 4px 8px; font-size: 12px; }
  .teaching-code code { font-size: 13px; }
  .teaching-line { padding: 0 8px; }
  .entity-connector figcaption { font-size: 12px; gap: 4px; padding: 0 4px; }
  .outcome-arrow { font-size: 12px; gap: 4px; }
  .outcome-copy h3 { font-size: 14px; padding: 4px 8px; }
  .teaching-operation { gap: 8px; padding: 12px 4px; flex-wrap: wrap; }
  .operation-route { width: 100%; margin-left: 32px; }
  .teaching-check { padding: 8px 12px 12px; }
  .check-prompt { font-size: 18px; }
  .teaching-choices { grid-template-columns: 1fr; }
  .teaching-takeaway { font-size: 24px; }
  .teaching-page .reveal .slides > section { padding: 20px 16px; font-size: 16px; }
  .teaching-page .reveal h2 { font-size: 25px; }
  .teaching-page .reveal .lesson-body { font-size: 16px; }
  .hook-question { font-size: 25px; }
  .mechanism-flow { gap: 8px; grid-template-columns: 1fr; margin: 16px 0; }
  .mechanism-arrow b { transform: rotate(90deg); font-size: 32px; }
  .scene-transfer { margin: 12px 0; }
  .scene-transfer .teaching-check { padding: 12px; }
  .scene-transfer .check-prompt { font-size: 21px; }
  .scene-takeaway { padding: 12px 4px; }
  .scene-takeaway .teaching-takeaway { font-size: 28px; }
  .scene-answer { padding: 12px 0; }
  .answer-reason { font-size: 20px; }
  .answer-alternatives p { font-size: 16px; }
}
`;
