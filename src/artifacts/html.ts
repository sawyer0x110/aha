import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, parseFragment, serialize, type DefaultTreeAdapterTypes } from 'parse5';
import { fail } from '../core/errors.js';
import { assertAuthored } from './project.js';
import { localPath, readBounded, sourceFiles, MAX_SOURCE_BYTES } from './files.js';
import { themeCss, themeScript } from './theme.js';
import { languageCss, languageScript } from './language.js';

interface Node {
  nodeName: string;
  tagName?: string;
  attrs?: { name: string; value: string; prefix?: string; namespace?: string }[];
  childNodes?: Node[];
  parentNode?: Node;
  content?: Node;
  value?: string;
}

export const OFFLINE_CSP = "default-src 'none'; script-src 'unsafe-inline' data:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; worker-src 'none'; child-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
};
const UNSUPPORTED = new Set(['base', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'portal', 'fencedframe', 'audio', 'video', 'source', 'track']);
const URL_ATTRIBUTES = new Set(['src', 'href', 'xlink:href', 'poster', 'background', 'action', 'formaction', 'data', 'codebase', 'manifest', 'profile', 'longdesc', 'usemap']);

function attr(node: Node, name: string): string | undefined {
  return node.attrs?.find(attribute => attribute.name === name)?.value;
}

function setAttr(node: Node, name: string, value: string): void {
  const item = node.attrs?.find(attribute => attribute.name === name);
  if (item) item.value = value;
  else (node.attrs ??= []).push({ name, value });
}

function removeAttr(node: Node, name: string): void {
  node.attrs = node.attrs?.filter(attribute => attribute.name !== name) ?? [];
}

function text(node: Node): string {
  return (node.childNodes ?? []).map(child => child.value ?? text(child)).join('');
}

function setText(node: Node, value: string): void {
  node.childNodes = [{ nodeName: '#text', value, parentNode: node }];
}

function fragment(html: string): Node[] {
  return (parseFragment(html) as unknown as Node).childNodes ?? [];
}

function localReference(reference: string, from: string): string {
  const value = reference.trim();
  if (!value || /[\\%\u0000-\u0020]/.test(value) || /^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(value)
    || value.includes('?') || value.includes('#')) {
    fail('HTML_RESOURCE', 'Resource URLs must be plain local paths (or supported data URLs), without query strings.', reference);
  }
  const joined = path.posix.normalize(path.posix.join(path.posix.dirname(from), value));
  return localPath(joined);
}

const diagramScript = `
window.__ahaReady = window.ahaMermaidReady;
window.__ahaReady.catch(error => { window.__ahaRenderError = String(error); });
`;

/** Parse and inline local resources. This function never executes authored code. */
export async function prepareHtml(directory: string): Promise<string> {
  const { artifact } = await assertAuthored(directory);
  if (artifact.format === 'pptx') fail('ARTIFACT_FORMAT', 'PPTX projects are not HTML.');
  const files = await sourceFiles(directory);
  const source = files.get(artifact.entry)!.toString('utf8');
  const document = parse(source) as unknown as Node;
  let mermaid = false;
  let inlinedBytes = 0;
  const languageRoots: Node[] = [];
  function resource(reference: string, from: string): { name: string; bytes: Buffer } {
    const name = localReference(reference, from);
    const bytes = files.get(name);
    if (!bytes) fail('HTML_RESOURCE_MISSING', 'Local resource is missing.', name);
    inlinedBytes += bytes.length;
    if (inlinedBytes > MAX_SOURCE_BYTES) fail('HTML_SIZE', 'Expanded HTML resources exceed 64 MiB.');
    return { name, bytes };
  }
  function dataUrl(reference: string, from: string): string {
    if (reference.startsWith('#')) {
      if (!/^#[A-Za-z0-9_.:-]+$/.test(reference)) fail('HTML_RESOURCE', 'Unsupported fragment reference.', reference);
      return reference;
    }
    if (/^data:/i.test(reference)) {
      if (!/^data:(?:image\/(?:png|jpeg|gif|webp|avif)|font\/(?:woff2?|ttf|otf));base64,[a-z0-9+/=\r\n]+$/i.test(reference)) {
        fail('HTML_RESOURCE', 'Only base64 raster images and fonts are supported as authored data URLs.');
      }
      return reference;
    }
    const { name, bytes } = resource(reference, from);
    const mime = MIME[path.posix.extname(name).toLowerCase()];
    if (!mime) fail('HTML_RESOURCE', 'Unsupported local asset type; use images or fonts.', name);
    if (mime === 'image/svg+xml') {
      const svg = bytes.toString('utf8');
      // SVG image subdocuments must be inert and self-contained too.
      if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet|<\s*(?:script|foreignObject|iframe|image|use|style|animate|set)\b|\bon[a-z]+\s*=|\b(?:href|src)\s*=|url\s*\(|@import/i.test(svg)) {
        fail('HTML_SVG', 'External SVG assets must be inert and self-contained. Inline complex SVG in the HTML instead.', name);
      }
    }
    return `data:${mime};base64,${bytes.toString('base64')}`;
  }
  function css(input: string, from: string): string {
    // Reject escapes rather than trying to approximate the full CSS tokenizer.
    if (input.includes('\\')) fail('HTML_CSS', 'CSS escapes are unsupported in offline resource packaging.', from);
    let value = input.replace(/\/\*[\s\S]*?\*\//g, '');
    if (/@import\b|@namespace\b|(?:image-set|cross-fade|paint|src)\s*\(|-moz-binding|behavior\s*:/i.test(value)) {
      fail('HTML_CSS', 'Unsupported CSS resource context; inline styles and use url() local assets.', from);
    }
    value = value.replace(/url\s*\(\s*(?:"([^"]*)"|'([^']*)'|([^()\s"']+))\s*\)/gi,
      (_match, double: string | undefined, single: string | undefined, bare: string | undefined) =>
        `AHA_INLINE_URL(${JSON.stringify(dataUrl(double ?? single ?? bare ?? '', from))})`);
    if (/\burl\s*\(/i.test(value)) fail('HTML_CSS', 'Unsupported CSS url() syntax.', from);
    return value.replaceAll('AHA_INLINE_URL(', 'url(').replace(/<\/style/gi, '<\\/style');
  }
  async function visit(node: Node, from: string): Promise<void> {
    if (node.tagName) {
      const tag = node.tagName.toLowerCase();
      if (artifact.language === 'bilingual' && attr(node, 'data-aha-lang') !== undefined) languageRoots.push(node);
      if (UNSUPPORTED.has(tag)) fail('HTML_CONTEXT', `Unsupported offline HTML element: ${tag}.`);
      if (tag === 'meta' && attr(node, 'http-equiv')) fail('HTML_CONTEXT', 'Authored http-equiv metadata is unsupported; Aha supplies offline CSP.');
      let packagedScript: string | undefined;
      if (tag === 'script') {
        const type = (attr(node, 'type') ?? '').trim().toLowerCase();
        if (type && !['text/javascript', 'application/javascript', 'application/json', 'application/ld+json'].includes(type)) {
          fail('HTML_SCRIPT', 'Module/import-map scripts are unsupported. Use a locally bundled classic script.');
        }
        const src = attr(node, 'src');
        if (src) {
          const loaded = resource(src, from);
          if (!/\.(?:js|cjs)$/i.test(loaded.name)) fail('HTML_SCRIPT', 'Local classic scripts must use .js or .cjs.');
          setText(node, loaded.bytes.toString('utf8').replace(/<\/script/gi, '<\\/script'));
          removeAttr(node, 'src');
          removeAttr(node, 'integrity');
          removeAttr(node, 'crossorigin');
          if ((!type || type === 'text/javascript' || type === 'application/javascript')
            && (attr(node, 'defer') !== undefined || attr(node, 'async') !== undefined)) {
            // A real external classic script preserves parser scheduling and the shared global
            // lexical environment; inline defer or callback wrappers cannot preserve either.
            packagedScript = `data:text/javascript;charset=utf-8;base64,${loaded.bytes.toString('base64')}`;
          }
        }
        if (/\bimport\s*(?:\(|["'{*])/.test(text(node))) fail('HTML_SCRIPT', 'JavaScript imports require a prebundled local classic script.');
      }
      if (tag === 'style') setText(node, css(text(node), from));
      if (tag === 'link') {
        const rel = (attr(node, 'rel') ?? '').toLowerCase();
        if (rel !== 'stylesheet') fail('HTML_CONTEXT', 'Only stylesheet link elements are supported; other link contexts can request hidden resources.');
        const loaded = resource(attr(node, 'href') ?? '', from);
        if (!loaded.name.endsWith('.css')) fail('HTML_CSS', 'Stylesheet files must use .css.');
        node.tagName = node.nodeName = 'style';
        node.attrs = node.attrs?.filter(attribute => attribute.name === 'media') ?? [];
        setText(node, css(loaded.bytes.toString('utf8'), loaded.name));
      }
      if (tag === 'pre' && (attr(node, 'class') ?? '').split(/\s+/).includes('mermaid')) mermaid = true;
      for (const attribute of [...(node.attrs ?? [])]) {
        const name = attribute.name.toLowerCase();
        if (['srcset', 'imagesrcset', 'srcdoc', 'ping', 'nonce'].includes(name)) fail('HTML_CONTEXT', `Unsupported resource attribute: ${name}.`);
        if (name === 'style') attribute.value = css(attribute.value, from);
        if (['fill', 'stroke', 'filter', 'clip-path', 'mask', 'cursor'].includes(name) && /url\s*\(/i.test(attribute.value)) {
          attribute.value = css(attribute.value, from);
        }
        if (name === 'href' && (tag === 'a' || tag === 'area')) {
          if (!/^(?:#[^\s]*|https?:\/\/[^\s]+|mailto:[^\s]+)$/i.test(attribute.value)) fail('HTML_LINK', 'Links must be a fragment or an explicit HTTPS/HTTP/mailto citation.');
          setAttr(node, 'rel', 'noopener noreferrer');
          continue;
        }
        if (URL_ATTRIBUTES.has(name)) {
          if (['img', 'image', 'use', 'feimage'].includes(tag) && (name === 'src' || name === 'href')) {
            attribute.value = dataUrl(attribute.value, from);
          } else fail('HTML_CONTEXT', `Unsupported URL attribute ${name} on ${tag}.`);
        }
      }
      if (['animate', 'animatetransform', 'animatemotion', 'set'].includes(tag)) {
        fail('HTML_CONTEXT', 'SVG animation elements are unsupported; author deterministic JavaScript animation instead.');
      }
      if (packagedScript) {
        setText(node, '');
        setAttr(node, 'src', packagedScript);
      }
    }
    for (const child of [...(node.childNodes ?? [])]) await visit(child, from);
    if (node.content) await visit(node.content, from);
  }
  await visit(document, artifact.entry);
  const html = document.childNodes?.find(node => node.tagName === 'html');
  const head = html?.childNodes?.find(node => node.tagName === 'head');
  const body = html?.childNodes?.find(node => node.tagName === 'body');
  if (!head || !body) fail('HTML_DOCUMENT', 'Expected an HTML document.');
  if (artifact.language === 'bilingual') {
    if (languageRoots.length !== 2 || !['en', 'zh'].every(language =>
      languageRoots.filter(node => attr(node, 'data-aha-lang') === language).length === 1)) {
      fail('HTML_LANGUAGE', 'Bilingual HTML needs exactly one en and one zh data-aha-lang root.');
    }
    for (const root of languageRoots) {
      if (root.tagName !== 'section' || (attr(root, 'class') ?? '').split(/\s+/).includes('mermaid')) {
        fail('HTML_LANGUAGE', 'Language roots must be section containers, with diagrams nested inside them.');
      }
      let ancestor = root.parentNode;
      while (ancestor && ancestor !== body) {
        if (languageRoots.includes(ancestor)) fail('HTML_LANGUAGE', 'Language roots cannot be nested.');
        ancestor = ancestor.parentNode;
      }
      if (ancestor !== body || !text(root).trim() || !attr(root, 'data-aha-title')?.trim()) {
        fail('HTML_LANGUAGE', 'Each language root must be inside the body with content and a data-aha-title.');
      }
      setAttr(root, 'lang', attr(root, 'data-aha-lang') === 'zh' ? 'zh-CN' : 'en');
      if (attr(root, 'data-aha-lang') === 'zh') setAttr(root, 'hidden', '');
      else removeAttr(root, 'hidden');
    }
    const styles = fragment(`<style>${languageCss}</style>`);
    for (const node of styles) node.parentNode = head;
    head.childNodes = [...(head.childNodes ?? []), ...styles];
    const scripts = fragment('<script></script>');
    setText(scripts[0]!, languageScript);
    scripts[0]!.parentNode = body;
    body.childNodes = [...(body.childNodes ?? []), ...scripts];
    setAttr(html!, 'lang', 'en');
  } else if (artifact.language) {
    setAttr(html!, 'lang', artifact.language === 'zh' ? 'zh-CN' : 'en');
  }
  const additions = fragment(`<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${OFFLINE_CSP}"><script>${themeScript}</script><style>${themeCss}</style>`);
  for (const node of additions) node.parentNode = head;
  head.childNodes = [...additions, ...(head.childNodes ?? [])];
  if (mermaid) {
    let runtime: Buffer;
    try {
      runtime = await readBounded(fileURLToPath(new URL('../assets/runtime/mermaid.js', import.meta.url)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT' && import.meta.url.endsWith('/artifacts/html.ts')) {
        runtime = await readBounded(fileURLToPath(new URL('../../dist/assets/runtime/mermaid.js', import.meta.url))).catch(() =>
          fail('MERMAID_RUNTIME', 'Canonical local Mermaid runtime is missing; build the Aha bundle, without using a CDN.'));
      } else fail('MERMAID_RUNTIME', 'Canonical local Mermaid runtime is missing; build/install the Aha bundle, without using a CDN.');
    }
    const scripts = fragment('<script></script><script></script>');
    setText(scripts[0]!, runtime.toString('utf8').replace(/<\/script/gi, '<\\/script'));
    setText(scripts[1]!, diagramScript);
    for (const node of scripts) node.parentNode = body;
    body.childNodes = [...(body.childNodes ?? []), ...scripts];
  }
  const output = serialize(document as unknown as DefaultTreeAdapterTypes.Document);
  if (Buffer.byteLength(output) > MAX_SOURCE_BYTES * 2) fail('HTML_SIZE', 'Packaged HTML exceeds 128 MiB.');
  return output;
}
