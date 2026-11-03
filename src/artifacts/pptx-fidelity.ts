import path from 'node:path';
import { createHash } from 'node:crypto';
import type JSZip from 'jszip';
import { fail } from '../core/errors.js';
import { readBounded } from './files.js';
import { A, P, attribute, loadPptxPackage, scanXml, type Element } from './pptx-validation.js';

const C = new Set(['http://schemas.openxmlformats.org/drawingml/2006/chart', 'http://purl.oclc.org/ooxml/drawingml/chart']);
const R = new Set(['http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'http://purl.oclc.org/ooxml/officeDocument/relationships']);
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const GRAPHICS = new Set([...C, 'http://schemas.openxmlformats.org/drawingml/2006/table', 'http://purl.oclc.org/ooxml/drawingml/table']);

interface Node extends Element { children: Node[]; text: string }
export interface ContentItem {
  key: string;
  slide: number;
  channel: 'slide' | 'notes';
  kind: string;
  locator: string;
  reference?: string;
  value: string;
}
export interface ContentInventory {
  sha256: string;
  slides: number;
  items: ContentItem[];
  diagnostics: { slide?: number; locator: string; message: string }[];
}
const hash = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
const is = (node: Node, namespaces: Set<string>, local: string): boolean => namespaces.has(node.tag.uri) && node.tag.local === local;
function descendants(node: Node, predicate: (node: Node) => boolean): Node[] {
  return node.children.flatMap(child => [...(predicate(child) ? [child] : []), ...descendants(child, predicate)]);
}
function tree(xml: string, part: string): Node {
  const nodes = new WeakMap<Element, Node>();
  let root: Node | undefined;
  let count = 0;
  scanXml(xml, part, (element, ancestors) => {
    if (++count > 200000 || ancestors.length > 128) fail('PPTX_SIZE', 'Content XML exceeds 200000 elements or 128 levels.', part);
    const node: Node = { ...element, children: [], text: '' };
    nodes.set(element, node);
    const parent = ancestors.at(-1);
    if (parent) nodes.get(parent)!.children.push(node);
    else root = node;
  }, (value, ancestors) => {
    const parent = ancestors.at(-1);
    if (parent) nodes.get(parent)!.text += value;
  });
  if (!root) fail('PPTX_XML', 'Empty XML part.', part);
  return root;
}
function paragraph(node: Node): string {
  return descendants(node, child => is(child, A, 't') || is(child, A, 'br'))
    .map(child => child.tag.local === 'br' ? '\n' : child.text).join('');
}
async function xmlPart(zip: JSZip, part: string): Promise<Node> {
  const file = zip.file(part);
  if (!file) fail('PPTX_PART', 'Missing referenced PowerPoint part.', part);
  return tree(await file.async('string'), part);
}
interface Relationship { id: string; type: string; target: string }
async function relationships(zip: JSZip, part: string): Promise<Relationship[]> {
  const file = path.posix.join(path.posix.dirname(part), '_rels', `${path.posix.basename(part)}.rels`);
  if (!zip.file(file)) return [];
  const root = await xmlPart(zip, file);
  const ids = new Set<string>();
  return descendants(root, node => node.tag.uri === REL && node.tag.local === 'Relationship').flatMap(node => {
    const id = attribute(node, 'Id') ?? '';
    if (!id || ids.has(id)) fail('PPTX_RELATIONSHIP', 'Missing or duplicate relationship ID.', file);
    ids.add(id);
    if (attribute(node, 'TargetMode') === 'External') return [];
    const target = attribute(node, 'Target') ?? '';
    if (!target || /[\\?#%:\u0000-\u001f]/.test(target)) fail('PPTX_RELATIONSHIP', 'Unsupported relationship target.', file);
    const resolved = target.startsWith('/') ? path.posix.normalize(target.slice(1)) : path.posix.join(path.posix.dirname(part), target);
    if (resolved.startsWith('../') || !zip.file(resolved)) fail('PPTX_PART', 'Missing or unsafe relationship target.', file);
    return [{ id, type: attribute(node, 'Type') ?? '', target: resolved }];
  });
}
function relationshipId(node: Node): string | undefined {
  return Object.values(node.tag.attributes).find(attr => R.has(attr.uri) && attr.local === 'id')?.value;
}

/** Read-only OOXML inventory; never imports author modules or opens embedded content. */
export async function inventoryPptx(bytes: Buffer): Promise<ContentInventory> {
  const zip = await loadPptxPackage(bytes);
  const inventory: ContentInventory = { sha256: hash(bytes), slides: 0, items: [], diagnostics: [] };
  const presentation = await xmlPart(zip, 'ppt/presentation.xml');
  const rels = await relationships(zip, 'ppt/presentation.xml');
  const slideIds = descendants(presentation, node => is(node, P, 'sldId'));
  if (!slideIds.length) fail('PPTX_EMPTY', 'Presentation has no ordered slides.');
  const seen = new Set<string>();
  for (const [index, id] of slideIds.entries()) {
    const slide = index + 1;
    const relation = rels.find(rel => rel.id === relationshipId(id) && rel.type.endsWith('/slide'));
    if (!relation || seen.has(relation.target)) fail('PPTX_RELATIONSHIP', 'Missing or duplicate ordered slide relationship.', 'ppt/presentation.xml');
    seen.add(relation.target);
    const part = relation.target;
    const root = await xmlPart(zip, part);
    if (!is(root, P, 'sld')) fail('PPTX_OUTPUT', 'Invalid slide root.', part);
    inventory.slides++;
    const warn = (locator: string, message: string): void => { inventory.diagnostics.push({ slide, locator, message }); };
    const add = (node: Node, channel: ContentItem['channel'], kind: string, value: string, source = part, reference?: string): void => {
      inventory.items.push({
        key: `${slide}:${channel}:${kind}:${reference ?? ''}:${source}${node.path}`,
        slide, channel, kind, locator: `${source}${node.path}`, value, ...(reference ? { reference } : {}),
      });
    };
    add(root, 'slide', 'slide-state', attribute(root, 'show') ?? '1');
    function inspectContent(content: Node, channel: ContentItem['channel'], source: string): void {
      const walk = (node: Node): void => {
        if (node.tag.uri === 'http://schemas.openxmlformats.org/markup-compatibility/2006' && node.tag.local === 'AlternateContent') {
          fail('PPTX_UNSUPPORTED', 'AlternateContent cannot be reliably inventoried.', `${source}${node.path}`);
        }
        if (is(node, P, 'cNvPr') && ['1', 'true'].includes(attribute(node, 'hidden') ?? '')) warn(`${source}${node.path}`, 'Hidden object: slide-channel text is not proof of rendered visibility.');
        if (is(node, P, 'pic') || is(node, P, 'oleObj') || is(node, A, 'graphicData')
          && !GRAPHICS.has(attribute(node, 'uri') ?? '')) {
          warn(`${source}${node.path}`, 'Image, embedded object or unsupported graphic content is not extracted; review separately.');
        }
        if (is(node, A, 'tbl')) {
          const rows = node.children.filter(child => is(child, A, 'tr'));
          const grid = descendants(node, child => is(child, A, 'gridCol')).map(child => attribute(child, 'w'));
          add(node, channel, 'table-structure', JSON.stringify({ columns: grid.length, rows: rows.map(row =>
            row.children.filter(cell => is(cell, A, 'tc')).map(cell =>
              Object.fromEntries(['gridSpan', 'rowSpan', 'hMerge', 'vMerge'].map(name => [name, attribute(cell, name) ?? ''])))) }), source);
          for (const row of rows) for (const cell of row.children.filter(child => is(child, A, 'tc'))) {
            add(cell, channel, 'table-cell', descendants(cell, child => is(child, A, 'p')).map(paragraph).join('\n'), source);
          }
          return;
        }
        if (is(node, A, 'p')) {
          const value = paragraph(node);
          if (value.trim()) add(node, channel, 'text', value, source);
          return;
        }
        node.children.forEach(walk);
      };
      walk(content);
    }
    inspectContent(root, 'slide', part);
    const slideRels = await relationships(zip, part);
    for (const chartRef of descendants(root, node => is(node, C, 'chart'))) {
      const chartRel = slideRels.find(rel => rel.id === relationshipId(chartRef) && rel.type.endsWith('/chart'));
      if (!chartRel) fail('PPTX_RELATIONSHIP', 'Missing chart relationship.', `${part}${chartRef.path}`);
      const chart = await xmlPart(zip, chartRel.target);
      if (!is(chart, C, 'chartSpace')) fail('PPTX_UNSUPPORTED', 'Only standard DrawingML charts are supported.', chartRel.target);
      const chartNodes = descendants(chart, () => true);
      for (const node of chartNodes) {
        if (is(node, C, 'v') || is(node, C, 'f') || is(node, C, 'formatCode') || is(node, A, 'p')) {
          const role = /\/[^/]*:title\[/.test(node.path) ? 'title'
            : /\/[^/]*:(?:cat|xVal)\[/.test(node.path) ? 'category'
            : /\/[^/]*:(?:val|yVal|bubbleSize)\[/.test(node.path) ? 'value' : 'label';
          add(node, 'slide', `chart-${role}`, is(node, A, 'p') ? paragraph(node) : node.text,
            chartRel.target, `${part}${chartRef.path}`);
        }
        if (is(node, C, 'pt') || is(node, C, 'ptCount')) {
          add(node, 'slide', 'chart-index', attribute(node, node.tag.local === 'pt' ? 'idx' : 'val') ?? '',
            chartRel.target, `${part}${chartRef.path}`);
        }
      }
      for (const ref of chartNodes.filter(node => is(node, C, 'numRef') || is(node, C, 'strRef'))) {
        if (!descendants(ref, node => is(node, C, 'v')).length) warn(chartRel.target + ref.path, 'Chart reference has no cached values; workbook content is not extracted.');
      }
      if (chartNodes.some(node => is(node, C, 'externalData'))) warn(chartRel.target, 'Chart caches only: embedded workbook/formula results are not recalculated or reconciled.');
    }
    if (descendants(root, node => node.tag.local === 'chart' && !C.has(node.tag.uri)).length) {
      fail('PPTX_UNSUPPORTED', 'Extended chart types are not supported.', part);
    }
    for (const rel of slideRels.filter(rel => rel.type.endsWith('/notesSlide'))) {
      const notes = await xmlPart(zip, rel.target);
      if (!is(notes, P, 'notes')) fail('PPTX_OUTPUT', 'Invalid notes root.', rel.target);
      inspectContent(notes, 'notes', rel.target);
    }
    // Inherited template text must not silently disappear from the scope report.
    for (const layout of slideRels.filter(rel => rel.type.endsWith('/slideLayout'))) {
      const inherited = [layout, ...(await relationships(zip, layout.target)).filter(rel => rel.type.endsWith('/slideMaster'))];
      for (const rel of inherited) {
        const template = await xmlPart(zip, rel.target);
        if (descendants(template, node => is(node, A, 't')).some(node => node.text.trim())) {
          warn(rel.target, 'Layout/master text is not resolved into slide content; review inherited text separately.');
        }
      }
    }
  }
  return inventory;
}

export async function comparePptx(beforeBytes: Buffer, afterBytes: Buffer, accepted: unknown = { changes: [] }) {
  const before = await inventoryPptx(beforeBytes);
  const after = await inventoryPptx(afterBytes);
  const old = new Map(before.items.map(item => [item.key, item]));
  const current = new Map(after.items.map(item => [item.key, item]));
  const changes = [...new Set([...old.keys(), ...current.keys()])].flatMap(key => {
    const previous = old.get(key);
    const next = current.get(key);
    if (previous?.value === next?.value) return [];
    const change = { kind: previous ? next ? 'changed' : 'removed' : 'added', before: previous ?? null, after: next ?? null };
    return [{ id: hash(JSON.stringify({ beforeHash: before.sha256, afterHash: after.sha256, ...change })), ...change, accepted: false, reason: '' }];
  });
  if (!accepted || typeof accepted !== 'object' || Array.isArray(accepted)
    || Object.keys(accepted).some(key => key !== 'changes') || !('changes' in accepted) || !Array.isArray(accepted.changes)) {
    fail('PPTX_ACCEPTANCE', 'Expected { "changes": [{ "id": "...", "reason": "..." }] }.');
  }
  for (const entry of accepted.changes as unknown[]) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !('id' in entry) || !('reason' in entry)
      || Object.keys(entry).some(key => !['id', 'reason'].includes(key))
      || typeof entry.id !== 'string' || typeof entry.reason !== 'string' || !entry.reason.trim()) {
      fail('PPTX_ACCEPTANCE', 'Each accepted change needs an exact ID and a nonempty reason.');
    }
    const change = changes.find(change => change.id === entry.id);
    if (!change || change.accepted) fail('PPTX_ACCEPTANCE', 'Unknown, stale or duplicate accepted change ID.', entry.id);
    change.accepted = true;
    change.reason = entry.reason;
  }
  return {
    schemaVersion: '1.0.0', status: changes.some(change => !change.accepted) || before.diagnostics.length || after.diagnostics.length ? 'review-required' : 'compared',
    scope: 'OOXML content comparison, not fact verification, rendered visibility, visual acceptance or editability certification.',
    codeExecuted: false, externalTruthVerified: false, visualReviewPerformed: false,
    matching: 'Slide order and XML location; moves, renumbering and reflow may appear as removals/additions. Exact decoded text is retained; no semantic paraphrase matching.',
    limitations: ['No OCR, image/media/SmartArt/OLE extraction or font/layout/clipping review.',
      'No inherited layout/master visibility resolution, animation evaluation, workbook reconciliation or formula execution.',
      'Slide-channel content is a candidate for visible content, not proof it is on-screen; notes never satisfy slide-channel retention.',
      'Qualifiers are preserved as complete extracted text, not semantically identified or validated.'],
    before, after, changes,
  };
}

export async function readPptx(file: string): Promise<Buffer> {
  if (path.extname(file).toLowerCase() !== '.pptx') fail('PPTX_INPUT', 'Expected a local .pptx file.', file);
  return readBounded(file);
}
