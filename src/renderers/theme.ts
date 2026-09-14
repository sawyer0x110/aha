export const themeScript = `(() => {
  const param = new URLSearchParams(window.location.search).get("scoutTheme");
  const theme = param === "light" || param === "dark" ? param :
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
})();`;

export const themeCss = `
:root {
  color-scheme: light;
  --cp-bg: #f7f4ef;
  --cp-bg-elevated: #fcfbf8;
  --cp-surface: #ffffff;
  --cp-surface-soft: #f5f5f5;
  --cp-border: #dedede;
  --cp-border-strong: #919191;
  --cp-text: #242424;
  --cp-text-muted: #5c5c5c;
  --cp-text-soft: #6f6f6f;
  --cp-accent: #b11f4b;
  --cp-accent-hover: #9a1a41;
  --cp-accent-soft: rgba(177, 31, 75, 0.08);
  --cp-accent-fg: #ffffff;
  --cp-success: #16a34a;
  --cp-danger: #dc2626;
  --cp-warning: #f59e0b;
  --cp-link: #0078d4;
  --cp-shadow: 0 18px 48px rgba(0, 0, 0, 0.12);
  --cp-overlay: rgba(255, 255, 255, 0.8);
  --cp-panel: rgba(255, 255, 255, 0.86);
  --cp-panel-strong: rgba(255, 255, 255, 0.96);
  --cp-sheen: rgba(255, 255, 255, 0.55);
  --cp-highlight: rgba(177, 31, 75, 0.12);
}
html[data-theme="dark"] {
  color-scheme: dark;
  --cp-bg: #3d3b3a;
  --cp-bg-elevated: #343231;
  --cp-surface: #292929;
  --cp-surface-soft: #2e2e2e;
  --cp-border: #474747;
  --cp-border-strong: #5f5f5f;
  --cp-text: #dedede;
  --cp-text-muted: #919191;
  --cp-text-soft: #b0b0b0;
  --cp-accent: #fd8ea1;
  --cp-accent-hover: #fb7b91;
  --cp-accent-soft: rgba(253, 142, 161, 0.14);
  --cp-accent-fg: #1a1a1a;
  --cp-success: #4ade80;
  --cp-danger: #f87171;
  --cp-warning: #fbbf24;
  --cp-link: #4da6ff;
  --cp-shadow: 0 18px 48px rgba(0, 0, 0, 0.32);
  --cp-overlay: rgba(41, 41, 41, 0.88);
  --cp-panel: rgba(41, 41, 41, 0.72);
  --cp-panel-strong: rgba(41, 41, 41, 0.96);
  --cp-sheen: rgba(255, 255, 255, 0.04);
  --cp-highlight: rgba(253, 142, 161, 0.12);
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--cp-bg); color: var(--cp-text); font: 16px/1.6 "Segoe UI", Aptos, Calibri, -apple-system, BlinkMacSystemFont, sans-serif; }
main, .page-header, .page-footer { width: min(1280px, 100% - 32px); margin: 0 auto; }
.page-header { padding: 24px 0 16px; }
h1, h2, h3, p { margin: 0 0 12px; }
h1 { font-size: clamp(1.6rem, 3vw, 2.4rem); line-height: 1.3; }
h2 { font-size: 1.35rem; } h3 { font-size: 1.1rem; }
h1, h2, h3, .takeaway { text-wrap: balance; overflow-wrap: anywhere; }
p, li, figcaption { overflow-wrap: anywhere; }
a { color: var(--cp-link); overflow-wrap: anywhere; }
button, input, select, textarea { font: inherit; border: 1px solid var(--cp-border-strong); border-radius: 0.625rem; padding: 8px 12px; color: var(--cp-text); background: var(--cp-surface); }
button { cursor: pointer; min-height: 44px; }
button:hover { border-color: var(--cp-accent); background: var(--cp-accent-soft); }
button.primary { background: var(--cp-accent); color: var(--cp-accent-fg); border-color: var(--cp-accent); font-weight: 600; }
button.primary:hover { background: var(--cp-accent-hover); }
button:disabled { opacity: .55; cursor: not-allowed; }
input:not([type=checkbox]), select, textarea { width: 100%; }
input[type=checkbox] { width: 20px; height: 20px; accent-color: var(--cp-accent); vertical-align: middle; }
:focus-visible { outline: 3px solid var(--cp-accent); outline-offset: 3px; }
label { display: block; margin: 8px 0; font-weight: 600; }
label small { display: block; font-weight: 400; color: var(--cp-text-muted); }
fieldset { border: 1px solid var(--cp-border); border-radius: 0.625rem; padding: 12px; margin: 12px 0; min-width: 0; }
legend { padding: 0 8px; font-weight: 600; }
details { border: 1px solid var(--cp-border); border-radius: 0.625rem; padding: 12px; margin: 12px 0; background: var(--cp-bg-elevated); }
summary { cursor: pointer; font-weight: 600; }
details[open] > summary { margin-bottom: 12px; }
ul, ol { padding-left: 24px; }
.card { background: var(--cp-surface); border: 1px solid var(--cp-border); border-radius: 16px; padding: 20px; margin-bottom: 16px; min-width: 0; }
.comparison { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.section-nav { display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 0 0 16px; border-bottom: 1px solid var(--cp-border); }
.section-nav a { padding: 8px 4px; text-underline-offset: 6px; }
.eyebrow { font-size: .85rem; font-weight: 600; color: var(--cp-text-muted); margin-bottom: 8px; }
.overview { border-top: 4px solid var(--cp-accent); }
.takeaway { font-size: clamp(1.4rem, 2.5vw, 2rem); font-weight: 700; line-height: 1.35; max-width: 48ch; margin-bottom: 20px; }
.summary-heading { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 4px 16px; }
.summary-heading h2 { font-size: 1rem; }
.result-comparison { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.summary-panel { padding: 16px; background: var(--cp-bg-elevated); border: 1px solid var(--cp-border); border-radius: 0.625rem; min-width: 0; }
.summary-panel p:last-child { margin-bottom: 0; }
.summary-case-title { font-weight: 600; }
.result-metric { margin: 4px 0 8px; font-variant-numeric: tabular-nums; }
.result-metric dt { color: var(--cp-text-muted); font-size: .9rem; }
.result-metric dd { color: var(--cp-accent); font-size: 2.5rem; font-weight: 700; line-height: 1.15; }
.result-detail { font-size: .9rem; font-variant-numeric: tabular-nums; }
.summary-freshness { font-size: .85rem; color: var(--cp-text-muted); }
.summary-source { margin: 12px 0 0; font-size: .9rem; }
.learning-path { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 16px 0; }
.learning-path a { padding: 12px 16px; border-bottom: 2px solid var(--cp-border-strong); text-decoration: none; }
.learning-path a:hover { border-color: var(--cp-accent); background: var(--cp-accent-soft); }
.learning-path strong, .learning-path span { display: block; }
.learning-path strong { color: var(--cp-text); }
.learning-path span { color: var(--cp-text-muted); font-size: .9rem; }
.prediction { background: var(--cp-bg-elevated); }
.prediction p:last-child { margin-bottom: 0; }
.glossary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 24px; }
.glossary dt { color: var(--cp-text); font-weight: 700; font-size: 1rem; }
.glossary dd { font-weight: 400; color: var(--cp-text-muted); }
.analogy { max-width: 76ch; border-left: 3px solid var(--cp-border-strong); padding-left: 16px; margin: 16px 0; }
.teaching-visual { margin: 24px 0; }
.teaching-visual figcaption { font-weight: 600; margin-bottom: 16px; }
.teaching-items { display: flex; gap: 16px; padding: 0; margin: 0; list-style: none; }
.teaching-items > li { flex: 1; min-width: 0; padding: 24px; border-radius: 16px; background: var(--cp-bg-elevated); border: 1px solid var(--cp-border); }
.teaching-items h3 { color: var(--cp-accent); font-size: 1.25em; margin-bottom: 12px; }
.teaching-items p { white-space: pre-line; margin: 0; }
.teaching-step { display: inline-flex; justify-content: center; align-items: center; width: 32px; height: 32px; margin-bottom: 12px; border-radius: 50%; background: var(--cp-accent); color: var(--cp-accent-fg); font-weight: 700; }
.lesson-body { white-space: pre-line; font-size: 1.15em; line-height: 1.65; }
.lesson-pages { margin-top: 24px; }
.reader-conditions { color: var(--cp-text-muted); font-size: .85em; margin-top: 16px; }
.reader-conditions p { margin-bottom: 4px; }
.check-question { font-size: 1.15rem; padding-top: 8px; }
[tabindex="-1"] { scroll-margin-top: 16px; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 12px; }
.wide { grid-column: 1 / -1; }
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 12px 0; }
.toolbar label { max-width: 220px; margin: 0; }
.toolbar .slide-jump-label { max-width: 300px; font-size: .85rem; }
.badge { display: inline-block; padding: 4px 10px; margin: 0 8px 8px 0; background: var(--cp-accent-soft); color: var(--cp-accent); border: 1px solid var(--cp-border); border-radius: 0.625rem; font-size: .9rem; }
.muted, .help { color: var(--cp-text-muted); }
.hash, code { font-family: Consolas, "Courier New", Courier, monospace; overflow-wrap: anywhere; font-size: .85em; }
.hash { display: block; }
.notice { border-left: 4px solid var(--cp-accent); padding: 8px 12px; background: var(--cp-accent-soft); margin: 12px 0; }
[role=alert]:not(:empty) { padding: 12px; border: 2px solid var(--cp-danger); border-radius: 0.625rem; background: var(--cp-surface); }
.dirty { border-left: 4px solid var(--cp-warning); padding-left: 12px; }
.different { border: 2px solid var(--cp-accent); border-radius: 0.625rem; padding: 8px; }
.state-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; margin: 12px 0; }
.state-grid > div { padding: 8px; border-bottom: 1px solid var(--cp-border); min-width: 0; }
dt { font-size: .85em; color: var(--cp-text-muted); } dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
.table-scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: .9em; }
th, td { border-bottom: 1px solid var(--cp-border); padding: 8px; text-align: left; overflow-wrap: anywhere; }
th { color: var(--cp-text-muted); }
caption { text-align: left; font-weight: 600; margin: 8px 0; }
.timeline { display: flex; flex-wrap: wrap; list-style: none; gap: 8px; padding: 0; }
.timeline li { flex: 1 1 100px; }
.timeline button { width: 100%; height: 100%; font-size: .85em; }
.timeline [aria-current=step] { border: 2px solid var(--cp-accent); background: var(--cp-accent-soft); }
.chart { width: 100%; height: auto; max-height: 220px; overflow: visible; }
.chart .axis { stroke: var(--cp-border-strong); }
.chart .line { stroke: var(--cp-accent); fill: none; stroke-width: 3; }
.chart .point { fill: var(--cp-accent); stroke: var(--cp-surface); stroke-width: 2; }
.chart text { fill: var(--cp-text-muted); font: 13px "Segoe UI", Aptos, Calibri, sans-serif; }
.evidence-card:target { outline: 3px solid var(--cp-accent); }
.claim-list { display: grid; gap: 12px; }
.claim-list article { padding: 12px; border-left: 3px solid var(--cp-border-strong); }
.claim-list article p { margin-bottom: 4px; }
.page-footer { padding: 16px 0 32px; }
.skip-link { position: absolute; left: 16px; top: -100px; padding: 12px; z-index: 100; background: var(--cp-surface); }
.skip-link:focus { top: 16px; }
[hidden] { display: none !important; }
.reveal { color: var(--cp-text); font: inherit; }
.deck-shell { width: 100%; height: calc(100vh - 185px); min-height: 480px; }
.reveal .slides { text-align: left; }
.reveal .slides > section { padding: 24px; height: 100%; overflow-y: auto; background: var(--cp-surface); border: 1px solid var(--cp-border); border-radius: 16px; font-size: 20px; }
.reveal h2 { font-size: 1.65em; }
.reveal h3 { font-size: 1.1em; }
.reveal p { line-height: 1.45; }
.reveal .state-grid { font-size: .9em; }
.reveal .slide-number { color: var(--cp-text); background: var(--cp-surface); font-family: inherit; }
.reveal .progress { color: var(--cp-accent); background: var(--cp-border); }
.reveal .slides section .slide-notes { border-left: 4px solid var(--cp-accent); padding: 12px; margin-top: 12px; background: var(--cp-accent-soft); }
.slide-case { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.slide-case figure { margin: 0; }
.slide-case [data-state-key=balance], .slide-case [data-state-key=totalDelayMs] { font-size: 1.5em; color: var(--cp-accent); }
.slide-case .chart { max-height: 160px; }
.slide-claim-summary { border-left: 3px solid var(--cp-accent); padding-left: 12px; }
.reveal .slides .slide-claim-summary p { margin: 8px 0; }
.deck-page .page-header { padding: 12px 0 4px; }
.deck-page .page-header > .muted { display: none; }
.deck-page .page-header h1 { font-size: 1.6rem; }
.deck-page .section-nav { display: none; }
.deck-page .page-header h1 { font-size: 1rem; color: var(--cp-text-muted); }
.reveal .teaching-items > li { padding: 20px; }
.reveal .teaching-visual { margin: 20px 0; }
.deck-page .audience { font-size: .85rem; margin-bottom: 4px; }
.reveal .takeaway { font-size: 1.5em; margin-top: 8px; max-width: 44ch; }
.slide-mode { font-size: .8em; }
.no-js-deck .deck-shell { height: auto; }
.no-js-deck .reveal { height: auto; overflow: visible; }
.no-js-deck .reveal .slides { position: static; width: auto; transform: none; }
.no-js-deck .reveal .slides > section { display: block; position: static; margin-bottom: 16px; height: auto; }
.no-js-lab [data-lesson-index] { display: block !important; }
@media (max-width: 760px) { .comparison, .form-grid, .glossary { grid-template-columns: 1fr; } .page-header { padding-top: 16px; } .card { padding: 16px; } .summary-panel { padding: 12px; } .learning-path { gap: 4px; } .learning-path a { padding: 8px 4px; } .result-metric dd { font-size: 2rem; } }
@media (max-width: 760px) { .lab-page .teaching-items { flex-direction: column; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
`;
