import { parse, type DefaultTreeAdapterTypes } from 'parse5';
import type { Format } from './project.js';

type Role = 'body' | 'label' | 'narration';
type Language = 'en' | 'zh' | 'other';
type Rule = 'sentence-length' | 'paragraph-length' | 'wording' | 'term-consistency';
export interface CopyBlock {
  text: string;
  role: Role;
  language?: string;
  location: { file: string; locator: string; line?: number; column?: number };
}
export interface ReadabilityWarning {
  severity: 'warning';
  rule: Rule;
  language: Language;
  location: CopyBlock['location'];
  excerpt: string;
  message: string;
  suggestion: string;
}

export const READABILITY_LIMITS = {
  html: { en: 35, zh: 60, paragraph: 6, labelEn: 12, labelZh: 24 },
  image: { en: 22, zh: 38, paragraph: 3, labelEn: 10, labelZh: 20 },
  pptx: { en: 24, zh: 42, paragraph: 3, labelEn: 12, labelZh: 24 },
  video: { en: 28, zh: 50, paragraph: 4, labelEn: 12, labelZh: 24 },
} as const;

const PRESERVE = 'Keep the objects, causal link, conditions, negation, units and evidence uncertainty. Do not invent precision or automatically replace technical terms.';
const SCOPE = 'STE-inspired editorial heuristics, not ASD-STE100 compliance, factual verification, visual QA or proof of understanding. Locations identify the source block. English/Chinese wording only; other languages receive length hints only.';
const WORDING: { language: 'en' | 'zh'; pattern: RegExp; suggestion: string }[] = [
  { language: 'en', pattern: /\butili[sz]e\b/gi, suggestion: 'Consider "use" if it preserves the technical meaning.' },
  { language: 'en', pattern: /\bin order to\b/gi, suggestion: 'Consider "to" without removing the purpose or condition.' },
  { language: 'en', pattern: /\b(?:seamlessly|significantly improves?)\b/gi, suggestion: 'Name the supported change and its conditions; retain the uncertainty if the effect is not measured.' },
  { language: 'zh', pattern: /进行(?:优化|比较|分析|检查)/g, suggestion: 'Consider the concrete verb directly, such as "检查" rather than "进行检查".' },
  { language: 'zh', pattern: /赋能|全方位|显著提升/g, suggestion: 'State the supported action or effect and its conditions; do not invent a measurement.' },
];
const TERMS = [
  { language: 'en', variants: ['log in', 'sign in'] },
  { language: 'en', variants: ['log out', 'sign out'] },
  { language: 'zh', variants: ['点击', '单击', '点按'] },
  { language: 'zh', variants: ['默认', '缺省'] },
] as const;
const MAX_WARNINGS = 200;
const SENTENCES = {
  en: new Intl.Segmenter('en', { granularity: 'sentence' }),
  zh: new Intl.Segmenter('zh', { granularity: 'sentence' }),
};
const WORDS = new Intl.Segmenter('en', { granularity: 'word' });

function language(text: string, declared?: string): Language {
  const base = declared?.toLowerCase().split('-')[0];
  if (base && !['en', 'zh'].includes(base)) return 'other';
  if (/\p{Script=Han}/u.test(text)) return 'zh';
  return 'en';
}

function length(text: string, lang: Language): number {
  const han = lang === 'zh' ? text.match(/\p{Script=Han}/gu)?.length ?? 0 : 0;
  const rest = lang === 'zh' ? text.replace(/\p{Script=Han}/gu, ' ') : text;
  const words = [...WORDS.segment(rest)]
    .filter(segment => segment.isWordLike).length;
  return han + words;
}

/** Advisory only: this does not modify copy, certify prose or gate publication. */
export function analyzeReadability(blocks: CopyBlock[], format: Format) {
  const limits = READABILITY_LIMITS[format];
  const warnings: ReadabilityWarning[] = [];
  let warningCount = 0;
  const terms = new Map<number, Set<string>>();
  const checked = blocks.filter(block => block.text.trim());
  function warn(block: CopyBlock, lang: Language, rule: Rule, text: string, message: string, suggestion: string): void {
    warningCount++;
    if (warnings.length < MAX_WARNINGS) warnings.push({
      severity: 'warning', rule, language: lang, location: block.location,
      excerpt: text.length > 160 ? `${text.slice(0, 157)}...` : text,
      message, suggestion,
    });
  }
  for (const block of checked) {
    const lang = language(block.text, block.language);
    const sentences = [...SENTENCES[lang === 'zh' ? 'zh' : 'en'].segment(block.text)]
      .map(segment => segment.segment.trim()).filter(Boolean);
    for (const sentence of sentences) {
      const sentenceLang = language(sentence, block.language);
      const count = length(sentence, sentenceLang);
      const limit = block.role === 'label'
        ? sentenceLang === 'zh' ? limits.labelZh : limits.labelEn
        : sentenceLang === 'zh' ? limits.zh : limits.en;
      if (count > limit) warn(block, sentenceLang, 'sentence-length', sentence,
        `${block.role} has ${count} ${sentenceLang === 'zh' ? 'Han characters plus other words' : 'words'}; ${format} review threshold is ${limit}.`,
        `Consider a meaningful split or move secondary detail into a disclosure, note or separate beat. ${PRESERVE}`);
    }
    if (block.role !== 'label' && sentences.length > limits.paragraph) warn(block, lang, 'paragraph-length', block.text,
      `Block has ${sentences.length} sentences; ${format} review threshold is ${limits.paragraph}.`,
      `Group sentences by one explanatory step, without separating a claim from its qualification. ${PRESERVE}`);
    for (const entry of WORDING) {
      if (entry.language !== lang) continue;
      for (const match of block.text.matchAll(entry.pattern)) warn(block, lang, 'wording', match[0],
        `Review possibly indirect or unsupported wording: ${JSON.stringify(match[0])}.`, `${entry.suggestion} ${PRESERVE}`);
    }
    TERMS.forEach((group, index) => {
      if (group.language !== lang) return;
      const seen = terms.get(index) ?? new Set<string>();
      const text = block.text.toLowerCase();
      const found = group.variants.filter(term => group.language === 'en'
        ? new RegExp(`\\b${term}\\b`, 'i').test(text) : text.includes(term));
      for (const term of found) {
        if (!seen.has(term) && seen.size) warn(block, lang, 'term-consistency', term,
          `Possible naming drift: ${[...seen, term].map(value => JSON.stringify(value)).join(' / ')}.`,
          'If these name the same action or concept, use one name consistently. If they are distinct or an intentional comparison, retain both and explain the distinction. Do not rewrite quoted UI or source terminology.');
        seen.add(term);
      }
      terms.set(index, seen);
    });
  }
  return {
    status: checked.length ? 'checked' as const : 'not-checked' as const,
    mode: 'advisory' as const, format, codeExecuted: false, blocksChecked: checked.length,
    warningCount, warnings, truncated: warningCount > warnings.length, limits, verification: SCOPE,
  };
}

type HtmlNode = DefaultTreeAdapterTypes.Node;
const SKIP = new Set(['script', 'style', 'pre', 'code', 'template', 'blockquote', 'q']);
const LABELS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button', 'label', 'text', 'title', 'caption', 'summary']);
const BLOCKS = new Set(['p', 'li', 'td', 'th', 'figcaption', 'dd', 'dt', ...LABELS]);
const CONTAINERS = new Set(['body', 'main', 'article', 'section', 'div', 'figure', 'header', 'footer', 'nav', 'aside']);

function attribute(node: DefaultTreeAdapterTypes.Element, name: string): string | undefined {
  return node.attrs.find(attr => attr.name === name)?.value;
}

export function htmlCopy(source: string, file: string): CopyBlock[] {
  const blocks: CopyBlock[] = [];
  const stack: { node: HtmlNode; block?: CopyBlock; language?: string }[] = [
    { node: parse(source, { sourceCodeLocationInfo: true }) },
  ];
  while (stack.length) {
    const current = stack.pop()!;
    const { node } = current;
    let block = current.block;
    let declared = current.language;
    if ('tagName' in node) {
      if (SKIP.has(node.tagName)) continue;
      declared = attribute(node, 'lang') ?? attribute(node, 'data-aha-lang') ?? declared;
      if (BLOCKS.has(node.tagName) || CONTAINERS.has(node.tagName)) {
        const position = node.sourceCodeLocation;
        const id = attribute(node, 'id');
        block = {
          text: '', role: LABELS.has(node.tagName) ? 'label' : 'body',
          ...(declared ? { language: declared } : {}),
          location: {
            file, locator: `${node.tagName}${id ? `#${id}` : ''}`,
            ...(position ? { line: position.startLine, column: position.startCol } : {}),
          },
        };
        blocks.push(block);
      }
      if (node.tagName === 'br' && block) block.text += '\n';
      for (const name of ['alt', 'aria-label', 'data-aha-title']) {
        const value = attribute(node, name);
        if (!value) continue;
        const position = node.sourceCodeLocation?.attrs?.[name] ?? node.sourceCodeLocation;
        blocks.push({
          text: value, role: 'label', ...(declared ? { language: declared } : {}),
          location: {
            file, locator: `${node.tagName}[${name}]`,
            ...(position ? { line: position.startLine, column: position.startCol } : {}),
          },
        });
      }
    }
    if (node.nodeName === '#text' && 'value' in node && block) block.text += node.value;
    if ('childNodes' in node) {
      for (const child of [...node.childNodes].reverse()) stack.push({
        node: child, ...(block ? { block } : {}), ...(declared ? { language: declared } : {}),
      });
    }
  }
  return blocks.map(block => ({ ...block, text: block.text.replace(/\s+/g, ' ').trim() })).filter(block => block.text);
}

export function lintHtml(source: string, format: Format, file: string) {
  return {
    ...analyzeReadability(htmlCopy(source, file), format),
    extraction: 'Static HTML text and labels, including both localized branches. Code, preformatted/diagram DSL and quotations excluded. CSS visibility, generated text and external SVG text are not inspected.',
  };
}

export function textCopy(source: string, file: string, markdown = false): CopyBlock[] {
  const blocks: CopyBlock[] = [];
  let block: CopyBlock | undefined;
  let fence: { character: string; length: number } | undefined;
  let frontmatter = false;
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
  lines.forEach((raw, index) => {
    const trimmed = raw.trim();
    if (markdown && index === 0 && trimmed === '---') { frontmatter = true; return; }
    if (frontmatter) { if (trimmed === '---') frontmatter = false; return; }
    const marker = markdown ? /^\s*(`{3,}|~{3,})(.*)$/.exec(raw) : null;
    if (fence) {
      if (marker && marker[1]![0] === fence.character && marker[1]!.length >= fence.length && !marker[2]!.trim()) fence = undefined;
      return;
    }
    if (marker) { fence = { character: marker[1]![0]!, length: marker[1]!.length }; block = undefined; return; }
    if (!trimmed || (markdown && (/^>/.test(trimmed) || /^[-*_]{3,}$/.test(trimmed) || /^\|?[\s:|-]+\|?$/.test(trimmed)))) {
      block = undefined;
      return;
    }
    const heading = markdown && /^#{1,6}\s+/.test(trimmed);
    const separate = markdown && (heading || /^(?:[-*+]|\d+[.)])\s+|^\|/.test(trimmed));
    const text = markdown ? trimmed
      .replace(/`+[^`]*`+/g, '')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^#{1,6}\s+|^(?:[-*+]|\d+[.)])\s+/g, '')
      .replace(/~~[^~]*~~/g, '')
      .replace(/\*+/g, '')
      .replace(/(?<![\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])/gu, '') : trimmed;
    if (!block || separate) {
      block = {
        text: '', role: heading ? 'label' : 'body',
        location: { file, locator: `block at line ${index + 1}`, line: index + 1, column: 1 },
      };
      blocks.push(block);
    }
    block.text += `${block.text ? ' ' : ''}${text}`;
    if (separate) block = undefined;
  });
  return blocks;
}

export function lintText(source: string, format: Format, file: string, markdown = false) {
  return {
    ...analyzeReadability(textCopy(source, file, markdown), format),
    extraction: markdown
      ? 'Markdown prose and labels; fenced/inline code, frontmatter and block quotations excluded. This is not a full Markdown renderer.'
      : 'Exported UTF-8 copy. Paragraphs separated by blank lines; no author code or binary media inspected.',
  };
}

export function lintNarration(segments: readonly { id: string; text: string }[], file: string) {
  return {
    ...analyzeReadability(segments.map((segment, index) => ({
      text: segment.text, role: 'narration',
      location: { file, locator: `/segments/${index}/text (${segment.id})` },
    })), 'video'),
    extraction: 'Video plan segments[].text only; no synthesized audio, timing, source support or frame review.',
  };
}
