type RevealDeck = {
  initialize(options: Record<string, unknown>): Promise<void>;
  prev(): void;
  next(): void;
  slide(index: number): void;
  getIndices(): { h: number; v?: number };
  on(event: string, callback: () => void): void;
};

declare global {
  interface Window { Reveal: new (element: HTMLElement, options?: Record<string, unknown>) => RevealDeck }
}

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error('页面组件缺失。');
  return found as T;
}

async function bootstrap(): Promise<void> {
  const teachingPage = document.body.classList.contains('teaching-page');
  if (teachingPage) {
    const pack = await validatePack(JSON.parse(element('aha-pack').textContent ?? ''));
    if (pack.teaching) document.querySelectorAll<HTMLElement>('[data-teaching="check"]').forEach(root => enhanceTeaching(root, pack.teaching!));
  }
  const container = document.querySelector<HTMLElement>('.reveal')!;
  const sections = [...container.querySelectorAll<HTMLElement>('.slides > section')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const deck = new window.Reveal(container);
  document.body.classList.remove('no-js-deck');
  await deck.initialize({
    width: 1280, height: 720, margin: 0.04,
    controls: false, progress: true, slideNumber: 'c/t',
    keyboard: true, touch: true, hash: false, history: false,
    keyboardCondition: (event: KeyboardEvent) => !(event.target instanceof Element
      && event.target.closest('button, input, select, textarea, summary, a, [contenteditable]')),
    postMessage: false, postMessageEvents: false,
    center: false, embedded: true, overview: false,
    transition: reducedMotion ? 'none' : 'slide',
    backgroundTransition: 'none', autoSlide: 0,
    help: false, pause: false, showNotes: false,
    disableLayout: teachingPage, plugins: [], dependencies: [],
  });
  const previous = element<HTMLButtonElement>('slide-prev');
  const next = element<HTMLButtonElement>('slide-next');
  const notes = element<HTMLButtonElement>('slide-notes-toggle');
  const fullscreen = element<HTMLButtonElement>('slide-fullscreen');
  const jump = element<HTMLSelectElement>('slide-jump');
  jump.disabled = false;
  jump.addEventListener('change', () => deck.slide(Number(jump.value)));
  function update(): void {
    const index = deck.getIndices().h;
    previous.disabled = index === 0;
    next.disabled = index === sections.length - 1;
    element('slide-position').textContent = `第 ${index + 1} / ${sections.length} 页`;
    jump.value = String(index);
  }
  previous.addEventListener('click', () => deck.prev());
  next.addEventListener('click', () => deck.next());
  notes.disabled = false;
  notes.addEventListener('click', () => {
    const show = notes.getAttribute('aria-pressed') !== 'true';
    notes.setAttribute('aria-pressed', String(show));
    notes.textContent = show ? '隐藏讲解备注' : '显示讲解备注';
    sections.forEach(section => {
      const content = section.querySelector<HTMLElement>('.slide-notes');
      if (content) content.hidden = !show;
    });
  });
  fullscreen.disabled = !document.fullscreenEnabled;
  if (fullscreen.disabled) fullscreen.title = '当前浏览器不支持全屏，可使用浏览器自身的全屏功能。';
  fullscreen.addEventListener('click', () => {
    const task = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    void task.catch(() => {
      element('slides-error').textContent = '无法切换全屏。请使用浏览器自身的全屏功能；幻灯片仍可正常导航。';
    });
  });
  document.addEventListener('fullscreenchange', () => {
    fullscreen.textContent = document.fullscreenElement ? '退出全屏' : '全屏演示';
  });
  document.addEventListener('click', event => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a');
    const href = link?.getAttribute('href');
    if (!href?.startsWith('#')) return;
    const target = document.getElementById(href.slice(1));
    if (!target) return;
    let ancestor: HTMLElement | null = target;
    while (ancestor) {
      if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
      ancestor = ancestor.parentElement;
    }
    const slide = target.closest<HTMLElement>('[data-slide-index]');
    if (slide) deck.slide(Number(slide.dataset.slideIndex));
    event.preventDefault();
    target.tabIndex = -1;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'nearest' });
  });
  deck.on('slidechanged', update);
  update();
}

void bootstrap().catch(() => {
  element('slides-error').textContent = '幻灯片导航初始化失败；已保留全部静态内容。请使用匹配版本重新生成文件。';
  document.body.classList.add('no-js-deck');
});
import { validatePack } from '../core/pack.js';
import { enhanceTeaching } from '../renderers/teaching-html.js';
