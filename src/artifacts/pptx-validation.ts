import JSZip from 'jszip';
import { SaxesParser, type SaxesTagNS } from 'saxes';
import { fail } from '../core/errors.js';

const MAX_OUTPUT_BYTES = 128 * 1024 * 1024;
const P = new Set(['http://schemas.openxmlformats.org/presentationml/2006/main', 'http://purl.oclc.org/ooxml/presentationml/main']);
const A = new Set(['http://schemas.openxmlformats.org/drawingml/2006/main', 'http://purl.oclc.org/ooxml/drawingml/main']);
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
const MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
const MAIN_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml';
const HYPERLINKS = new Set([
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
  'http://purl.oclc.org/ooxml/officeDocument/relationships/hyperlink',
]);

interface Element {
  tag: SaxesTagNS;
  path: string;
  counts: Map<string, number>;
}

function attribute(node: Element, name: string): string | undefined {
  return Object.values(node.tag.attributes).find(attr => attr.uri === '' && attr.local === name)?.value;
}

function scanXml(xml: string, part: string, visit: (node: Element, ancestors: Element[]) => void): void {
  const parser = new SaxesParser({ xmlns: true });
  const stack: Element[] = [];
  parser.on('doctype', () => fail('PPTX_XML', 'DOCTYPE is not supported in PowerPoint package XML.', part));
  parser.on('error', error => fail('PPTX_XML', `Malformed PowerPoint XML: ${error.message}`, `${part}${stack.at(-1)?.path ?? ''}`));
  parser.on('opentag', tag => {
    const parent = stack.at(-1);
    const key = `{${tag.uri}}${tag.local}`;
    const index = (parent?.counts.get(key) ?? 0) + 1;
    parent?.counts.set(key, index);
    const prefix = P.has(tag.uri) ? 'p' : A.has(tag.uri) ? 'a' : tag.prefix;
    const node: Element = { tag, path: `${parent?.path ?? ''}/${prefix ? `${prefix}:` : ''}${tag.local}[${index}]`, counts: new Map() };
    visit(node, stack);
    stack.push(node);
  });
  parser.on('closetag', () => { stack.pop(); });
  parser.write(xml).close();
}

interface SlideObject {
  element: Element;
  id?: string;
  name?: string;
}
const NONVISUAL: Record<string, string> = {
  spTree: 'nvGrpSpPr', grpSp: 'nvGrpSpPr', sp: 'nvSpPr',
  cxnSp: 'nvCxnSpPr', pic: 'nvPicPr', graphicFrame: 'nvGraphicFramePr',
};

function validateSlide(xml: string, part: string): void {
  const owners = new WeakMap<Element, SlideObject>();
  const ids = new Map<string, string>();
  let native = false;
  let slideRoot = false;
  scanXml(xml, part, (node, ancestors) => {
    const { uri, local } = node.tag;
    const parent = ancestors.at(-1);
    const grandparent = ancestors.at(-2);
    const inherited = parent && owners.get(parent);
    const rootTree = P.has(uri) && local === 'spTree' && ancestors.length === 2
      && parent?.tag.local === 'cSld' && P.has(parent.tag.uri)
      && grandparent?.tag.local === 'sld' && P.has(grandparent.tag.uri);
    const childObject = P.has(uri) && Object.hasOwn(NONVISUAL, local) && local !== 'spTree'
      && parent !== undefined && inherited?.element === parent && ['spTree', 'grpSp'].includes(parent.tag.local);
    if (!ancestors.length) slideRoot = P.has(uri) && local === 'sld';
    const owner = rootTree || childObject ? { element: node } : inherited;
    if (owner) owners.set(node, owner);
    if (childObject && ['sp', 'graphicFrame', 'cxnSp'].includes(local)) native = true;
    const locator = (): string => `${part}${node.path}${owner ? ` (object ${JSON.stringify(owner.name ?? owner.element.tag.local)}, id=${owner.id ?? 'unknown'})` : ''}`;

    // Choice/fallback branches may deliberately reuse IDs. PptxGenJS does not
    // emit these shape trees; reject rather than guess which branch is active.
    if (owner && uri === MC && local === 'AlternateContent') {
      fail('PPTX_UNSUPPORTED', 'AlternateContent inside a slide shape tree is not supported by this validator.', locator());
    }
    if (owner && P.has(uri) && local === 'cNvPr' && grandparent === owner.element
      && parent !== undefined && parent.tag.local === NONVISUAL[owner.element.tag.local] && P.has(parent.tag.uri)) {
      const id = attribute(node, 'id')?.trim();
      owner.name = attribute(node, 'name') ?? '';
      if (!id || !/^\+?\d+$/.test(id) || BigInt(id) > 4294967295n) {
        fail('PPTX_OBJECT_ID', 'Nonvisual object ID must be an unsigned 32-bit integer.', locator());
      }
      owner.id = id;
      const normalized = BigInt(id).toString();
      const previous = ids.get(normalized);
      if (previous) fail('PPTX_DUPLICATE_ID', `Duplicate nonvisual object ID ${normalized}; first occurrence: ${previous}. IDs are scoped to one slide, including groups.`, locator());
      ids.set(normalized, locator());
    }
    if (A.has(uri) && (local === 'tcPr' || local === 'bodyPr')) {
      const anchor = attribute(node, 'anchor');
      if (anchor !== undefined && !['t', 'ctr', 'b', 'just', 'dist'].includes(anchor.trim())) {
        fail('PPTX_ANCHOR', `Invalid DrawingML anchor ${JSON.stringify(anchor)}; expected t, ctr, b, just or dist. Use valign: 'middle', not 'mid', for PptxGenJS tables.`, locator());
      }
    }
    // a:ext also names extension payloads; only geometry extents have cx/cy.
    if (A.has(uri) && (local === 'ext' || local === 'chExt')) {
      for (const name of ['cx', 'cy']) {
        const value = attribute(node, name);
        if (value !== undefined && (!/^[+-]?\d+$/.test(value.trim()) || BigInt(value.trim()) < 0n)) {
          fail('PPTX_EXTENT', `Invalid DrawingML extent ${name}=${JSON.stringify(value)}; extents must be nonnegative integers. Normalize line endpoints and use flipH/flipV rather than negative width/height.`, locator());
        }
      }
    }
  });
  if (!slideRoot) fail('PPTX_OUTPUT', 'Invalid PowerPoint slide root element.', part);
  if (!native) fail('PPTX_NATIVE', 'Each slide must contain native text, shapes, charts or tables; screenshot-only slides are not accepted.', part);
}

/** Targeted generated-output checks, not ECMA schema validation or XML repair. */
export async function validatePptx(bytes: Buffer): Promise<number> {
  if (bytes.length < 4 || bytes.length > MAX_OUTPUT_BYTES || bytes.readUInt32LE(0) !== 0x04034b50) fail('PPTX_OUTPUT', 'Expected a true PPTX ZIP file.');
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(bytes); }
  catch { fail('PPTX_OUTPUT', 'Invalid PowerPoint ZIP package.'); }
  const entries = Object.values(zip.files);
  if (entries.length > 10000) fail('PPTX_SIZE', 'PPTX package exceeds 10000 entries.');
  let expanded = 0;
  for (const entry of entries) {
    const original = (entry as unknown as { unsafeOriginalName?: string }).unsafeOriginalName ?? entry.name;
    if ([entry.name, original].some(name => name.startsWith('/') || name.includes('\\') || name.split('/').includes('..'))) {
      fail('PPTX_OUTPUT', 'PowerPoint package contains an unsafe member path.');
    }
    expanded += (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    if (expanded > MAX_OUTPUT_BYTES) fail('PPTX_SIZE', 'Expanded PPTX package exceeds 128 MiB.');
  }
  if (!zip.file('[Content_Types].xml') || !zip.file('ppt/presentation.xml')) fail('PPTX_OUTPUT', 'Missing PowerPoint package parts.');
  let contentType = false;
  scanXml(await zip.file('[Content_Types].xml')!.async('string'), '[Content_Types].xml', (node, ancestors) => {
    if (node.tag.uri === CT && node.tag.local === 'Override' && ancestors.length === 1
      && ancestors[0]!.tag.uri === CT && ancestors[0]!.tag.local === 'Types'
      && attribute(node, 'PartName') === '/ppt/presentation.xml' && attribute(node, 'ContentType') === MAIN_TYPE) contentType = true;
  });
  let presentation = false;
  scanXml(await zip.file('ppt/presentation.xml')!.async('string'), 'ppt/presentation.xml', (node, ancestors) => {
    if (!ancestors.length && P.has(node.tag.uri) && node.tag.local === 'presentation') presentation = true;
  });
  if (!contentType || !presentation) fail('PPTX_OUTPUT', 'Invalid native PowerPoint presentation content type.');
  for (const entry of entries.filter(item => item.name.endsWith('.rels'))) {
    scanXml(await entry.async('string'), entry.name, (node) => {
      if (node.tag.uri === REL && node.tag.local === 'Relationship' && attribute(node, 'TargetMode') === 'External'
        && !HYPERLINKS.has(attribute(node, 'Type') ?? '')) {
        fail('PPTX_EXTERNAL', 'PowerPoint media and other dependencies must be embedded, not externally linked.', `${entry.name}${node.path}`);
      }
    });
  }
  const slides = entries.filter(entry => /^ppt\/slides\/slide\d+\.xml$/.test(entry.name));
  if (!slides.length) fail('PPTX_EMPTY', 'Author at least one native PowerPoint slide.');
  for (const slide of slides) validateSlide(await slide.async('string'), slide.name);
  return slides.length;
}
