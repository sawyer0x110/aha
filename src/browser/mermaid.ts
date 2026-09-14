import mermaid from 'mermaid';

declare global {
  interface Window {
    ahaMermaidReady: Promise<void>;
  }
}

async function renderDiagrams(): Promise<void> {
  const tokens = getComputedStyle(document.documentElement);
  const color = (name: string): string => tokens.getPropertyValue(name).trim();
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: getComputedStyle(document.body).fontFamily,
    themeVariables: {
      primaryColor: color('--cp-surface'),
      primaryTextColor: color('--cp-text'),
      primaryBorderColor: color('--cp-border-strong'),
      lineColor: color('--cp-text-muted'),
      secondaryColor: color('--cp-accent-soft'),
      tertiaryColor: color('--cp-surface-soft'),
      background: color('--cp-bg'),
      mainBkg: color('--cp-surface'),
      nodeBorder: color('--cp-border-strong'),
      clusterBkg: color('--cp-surface-soft'),
      clusterBorder: color('--cp-border'),
      edgeLabelBackground: color('--cp-bg'),
      textColor: color('--cp-text'),
    },
  });
  const sources = Array.from(document.querySelectorAll<HTMLElement>('.mermaid'));
  const style = document.createElement('style');
  style.textContent = `
    .aha-diagram{border:1px solid var(--cp-border);border-radius:.625rem;margin:1.5rem 0;overflow:hidden;background:var(--cp-surface);color:var(--cp-text)}
    .aha-diagram figcaption{padding:.75rem 1rem;color:var(--cp-text-muted)}
    .aha-diagram-controls{display:flex;gap:.5rem;flex-wrap:wrap;padding:.5rem;border-bottom:1px solid var(--cp-border)}
    .aha-diagram-controls button{font:inherit;background:var(--cp-surface-soft);color:var(--cp-text);border:1px solid var(--cp-border);border-radius:.625rem;padding:.4rem .7rem;cursor:pointer}
    .aha-diagram-controls button:focus-visible,.aha-diagram-viewport:focus-visible{outline:2px solid var(--cp-accent);outline-offset:2px}
    .aha-diagram-viewport{height:min(60vh,36rem);overflow:hidden;position:relative;touch-action:none;cursor:grab}
    .aha-diagram-canvas{width:100%;height:100%;display:grid;place-items:center;transform-origin:center}
    .aha-diagram-canvas svg{max-width:100%;max-height:100%;height:auto}
    .aha-diagram[data-expanded=true]{position:fixed;inset:1rem;z-index:10000;margin:0;display:flex;flex-direction:column}
    .aha-diagram[data-expanded=true] .aha-diagram-viewport{flex:1;height:auto}
    .aha-diagram-error{padding:1rem;color:var(--cp-danger);border:1px solid var(--cp-danger);white-space:pre-wrap}
  `;
  document.head.append(style);
  for (const [index, source] of sources.entries()) {
    const text = source.textContent ?? '';
    const branchLanguage = source.closest<HTMLElement>('[data-aha-lang]')?.dataset.ahaLang;
    const isChinese = (): boolean => (branchLanguage ?? document.documentElement.lang).startsWith('zh');
    const customLabel = source.dataset.caption || source.getAttribute('aria-label');
    const label = customLabel || (isChinese() ? `图 ${index + 1}` : `Diagram ${index + 1}`);
    const figure = document.createElement('figure');
    figure.className = 'aha-diagram';
    figure.setAttribute('aria-label', label);
    const controls = document.createElement('div');
    controls.className = 'aha-diagram-controls';
    const viewport = document.createElement('div');
    viewport.className = 'aha-diagram-viewport';
    viewport.tabIndex = 0;
    const canvas = document.createElement('div');
    canvas.className = 'aha-diagram-canvas';
    const caption = document.createElement('figcaption');
    caption.textContent = label;
    viewport.append(canvas);
    figure.append(controls, viewport, caption);
    source.replaceWith(figure);
    try {
      const rendered = await mermaid.render(`aha-mermaid-${index}`, text);
      canvas.innerHTML = rendered.svg;
      rendered.bindFunctions?.(canvas);
    } catch (error) {
      const failure = document.createElement('pre');
      failure.className = 'aha-diagram-error';
      failure.textContent = `Diagram failed: ${error instanceof Error ? error.message : String(error)}`;
      figure.replaceChildren(failure, caption);
      throw error;
    }
    let scale = 1;
    let x = 0;
    let y = 0;
    const update = (): void => { canvas.style.transform = `translate(${x}px, ${y}px) scale(${scale})`; };
    const zoom = (factor: number): void => { scale = Math.max(0.25, Math.min(8, scale * factor)); update(); };
    const reset = (): void => { scale = 1; x = 0; y = 0; update(); };
    let expandButton: HTMLButtonElement;
    const expand = (): void => {
      const expanded = figure.dataset.expanded !== 'true';
      figure.dataset.expanded = String(expanded);
      expandButton.setAttribute('aria-expanded', String(expanded));
      localize();
      reset();
    };
    const addButton = (labelText: string, action: () => void): HTMLButtonElement => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = labelText;
      button.addEventListener('click', action);
      controls.append(button);
      return button;
    };
    const zoomInButton = addButton('+', () => zoom(1.2));
    const zoomOutButton = addButton('−', () => zoom(1 / 1.2));
    const resetButton = addButton('', reset);
    expandButton = addButton('', expand);
    expandButton.setAttribute('aria-expanded', 'false');
    function localize(): void {
      const zh = isChinese();
      const currentLabel = customLabel || (zh ? `图 ${index + 1}` : `Diagram ${index + 1}`);
      caption.textContent = currentLabel;
      figure.setAttribute('aria-label', currentLabel);
      viewport.setAttribute('aria-label', `${currentLabel}; ${zh ? '方向键平移，加减键缩放' : 'use arrow keys to pan and plus/minus to zoom'}`);
      zoomInButton.setAttribute('aria-label', zh ? '放大' : 'Zoom in');
      zoomOutButton.setAttribute('aria-label', zh ? '缩小' : 'Zoom out');
      resetButton.textContent = zh ? '重置' : 'Reset';
      expandButton.textContent = figure.dataset.expanded === 'true' ? (zh ? '收起' : 'Collapse') : (zh ? '展开' : 'Expand');
    }
    localize();
    window.addEventListener('aha:languagechange', localize);
    viewport.addEventListener('wheel', event => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoom(event.deltaY < 0 ? 1.1 : 1 / 1.1);
    }, { passive: false });
    let drag: { x: number; y: number; id: number } | undefined;
    viewport.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      drag = { x: event.clientX, y: event.clientY, id: event.pointerId };
      viewport.setPointerCapture(event.pointerId);
    });
    viewport.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      x += event.clientX - drag.x; y += event.clientY - drag.y;
      drag.x = event.clientX; drag.y = event.clientY;
      update();
    });
    const release = (): void => { drag = undefined; };
    viewport.addEventListener('pointerup', release);
    viewport.addEventListener('pointercancel', release);
    figure.addEventListener('keydown', event => {
      if (event.key === 'Escape' && figure.dataset.expanded === 'true') { expand(); expandButton.focus(); }
      if (event.target !== viewport) return;
      const movement: Record<string, [number, number]> = { ArrowLeft: [30, 0], ArrowRight: [-30, 0], ArrowUp: [0, 30], ArrowDown: [0, -30] };
      const delta = movement[event.key];
      if (delta) { event.preventDefault(); x += delta[0]; y += delta[1]; update(); }
      if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.2); }
      if (event.key === '-') { event.preventDefault(); zoom(1 / 1.2); }
      if (event.key === '0') { event.preventDefault(); reset(); }
    });
  }
}

window.ahaMermaidReady = document.readyState === 'loading'
  ? new Promise<void>((resolve, reject) => document.addEventListener('DOMContentLoaded', () => {
    renderDiagrams().then(resolve, reject);
  }, { once: true }))
  : renderDiagrams();
