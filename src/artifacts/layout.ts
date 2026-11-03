import type { Frame, Page } from 'playwright-core';
import { fail } from '../core/errors.js';

export interface LayoutIssue {
  rule: 'horizontal-overflow' | 'clipped-text' | 'small-diagram-text' | 'overlapping-diagram-text';
  selector: string;
  relatedSelector?: string;
  text: string;
  bounds: { x: number; y: number; width: number; height: number };
  message: string;
}

export async function inspectLayout(frame: Frame) {
  const result = await frame.evaluate(() => {
    const nodes = [...document.querySelectorAll('body *')];
    if (nodes.length > 10_000) return { limit: 'Layout inspection exceeds 10000 elements.' };
    const issues: LayoutIssue[] = [];
    let issueCount = 0;
    const selector = (element: Element): string => {
      const parts: string[] = [];
      let node: Element | null = element;
      while (node && node !== document.documentElement) {
        const tag = node.localName;
        const siblings = node.parentElement ? [...node.parentElement.children].filter(child => child.localName === tag) : [node];
        parts.unshift(`${CSS.escape(tag)}:nth-of-type(${siblings.indexOf(node) + 1})`);
        node = node.parentElement;
      }
      return `html > ${parts.join(' > ')}`;
    };
    const add = (rule: LayoutIssue['rule'], element: Element, message: string, related?: Element): void => {
      issueCount++;
      if (issues.length >= 200) return;
      const rect = element.getBoundingClientRect();
      issues.push({
        rule, selector: selector(element), text: (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 160),
        bounds: { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height },
        message, ...(related ? { relatedSelector: selector(related) } : {}),
      });
    };
    const visible = (element: Element): boolean => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility === 'visible' && element.checkVisibility({ opacityProperty: true });
    };
    const root = document.documentElement;
    if (root.scrollWidth > innerWidth + 1) add('horizontal-overflow', document.body, `Document width ${root.scrollWidth}px exceeds viewport ${innerWidth}px.`);
    const labels: SVGTextElement[] = [];
    for (const element of nodes) {
      if (!visible(element)) continue;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      let scrollContainer = false;
      for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (['auto', 'scroll'].includes(getComputedStyle(parent).overflowX)) { scrollContainer = true; break; }
      }
      if (!scrollContainer && (rect.left < -1 || rect.right > innerWidth + 1)) {
        add('horizontal-overflow', element, 'Element extends beyond the horizontal viewport; inspect intentional off-canvas content manually.');
      }
      if (element instanceof HTMLElement && [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) {
        const clipsX = ['hidden', 'clip'].includes(style.overflowX);
        const clipsY = ['hidden', 'clip'].includes(style.overflowY);
        if ((clipsX && element.scrollWidth > element.clientWidth + 1) || (clipsY && element.scrollHeight > element.clientHeight + 1)) {
          add('clipped-text', element, 'Text exceeds a box with hidden/clip overflow (including ellipsis or line-clamp); verify truncation is intentional.');
        } else {
          const range = document.createRange();
          range.selectNodeContents(element);
          const textRects = [...range.getClientRects()];
          for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
            const parentStyle = getComputedStyle(parent);
            const box = parent.getBoundingClientRect();
            if (textRects.some(text => (['hidden', 'clip'].includes(parentStyle.overflowX) && (text.left < box.left - 1 || text.right > box.right + 1))
              || (['hidden', 'clip'].includes(parentStyle.overflowY) && (text.top < box.top - 1 || text.bottom > box.bottom + 1)))) {
              add('clipped-text', element, 'Text extends beyond an ancestor with hidden/clip overflow.', parent);
              break;
            }
          }
        }
      }
      if (element instanceof SVGTextElement && element.textContent?.trim()) {
        labels.push(element);
        const matrix = element.getScreenCTM();
        const scale = matrix ? Math.min(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d)) : 1;
        const pixels = parseFloat(style.fontSize) * scale;
        if (pixels < 12) add('small-diagram-text', element, `SVG text is approximately ${pixels.toFixed(1)} CSS px on screen; threshold is 12px.`);
      }
    }
    if (labels.length > 1000) return { limit: 'Layout inspection exceeds 1000 SVG text labels.' };
    for (let index = 0; index < labels.length; index++) {
      const a = labels[index]!;
      const ar = a.getBoundingClientRect();
      for (const b of labels.slice(index + 1)) {
        if (a.ownerSVGElement !== b.ownerSVGElement) continue;
        const br = b.getBoundingClientRect();
        const width = Math.min(ar.right, br.right) - Math.max(ar.left, br.left);
        const height = Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top);
        if (width > 2 && height > 2 && width * height > Math.min(ar.width * ar.height, br.width * br.height) * 0.2) {
          add('overlapping-diagram-text', a, 'SVG label bounding boxes overlap by more than 20%; this is a review candidate, not pixel-level proof.', b);
        }
      }
    }
    return {
      width: innerWidth, height: innerHeight, scrollWidth: root.scrollWidth, scrollHeight: root.scrollHeight,
      issueCount, truncated: issueCount > issues.length, issues,
    };
  });
  if ('limit' in result) fail('ARTIFACT_LAYOUT_LIMIT', result.limit!);
  return result;
}

export interface LayoutScreenshot {
  file: string;
  bytes: Buffer;
}

export async function captureLayout(frame: Frame, page: Page, language: string) {
  const layout = await inspectLayout(frame);
  const screenshots: LayoutScreenshot[] = [];
  const evidence: { file: string; scrollX: number; scrollY: number; issueIndexes: number[] }[] = [];
  // Keep the viewport unchanged: enlarging an iframe would change vh/media-query layout.
  const offsets = [0, ...layout.issues.slice(0, 12).map(issue => Math.max(0, issue.bounds.y - 80))];
  for (const offset of offsets) {
    const position = await frame.evaluate(async y => {
      window.scrollTo({ top: y, left: 0, behavior: 'instant' });
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      return { x: scrollX, y: scrollY };
    }, offset);
    if (evidence.some(item => Math.abs(item.scrollY - position.y) < 1)) continue;
    const file = `${layout.width}-${language}-${evidence.length + 1}.png`;
    const bytes = await page.screenshot({ type: 'png', animations: 'disabled', timeout: 15_000 });
    if (bytes.length > 16 * 1024 * 1024) fail('OUTPUT_SIZE', 'Layout screenshot exceeds 16 MiB.');
    screenshots.push({ file, bytes });
    evidence.push({
      file, scrollX: position.x, scrollY: position.y,
      issueIndexes: layout.issues.flatMap((issue, index) => issue.bounds.y + issue.bounds.height > position.y && issue.bounds.y < position.y + layout.height ? [index] : []),
    });
  }
  await frame.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
  return { result: { language, ...layout, evidence }, screenshots };
}
