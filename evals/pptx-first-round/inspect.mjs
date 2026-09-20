import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { readRegular, safePath, safeRelative, sha256 } from './prepare.mjs';

const MAX_PACKAGE = 64 * 1024 * 1024;
const MAX_EXPANDED = 128 * 1024 * 1024;
const MAX_XML = 16 * 1024 * 1024;
const EMU_PER_INCH = 914400;

function decode(value) {
  if (/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);)/.test(value)) throw new Error('Unsupported XML entity');
  return value.replace(/&([^;]+);/g, (_, entity) => {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (named[entity]) return named[entity];
    const code = entity.startsWith('#x') ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    if (!Number.isInteger(code) || code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
      throw new Error('Invalid XML character entity');
    }
    return String.fromCodePoint(code);
  });
}

// A bounded, non-resolving XML reader. No DTD, entity expansion, XInclude or external reads.
export function parseXml(xml) {
  if (Buffer.byteLength(xml) > MAX_XML || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Unsupported/oversized XML');
  const document = { name: '#document', local: '#document', attrs: {}, children: [] };
  const stack = [document];
  const token = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<\/?[A-Za-z_][\w:.-]*(?:\s+[A-Za-z_][\w:.-]*\s*=\s*(?:"[^"<]*"|'[^'<]*'))*\s*\/?>|[^<]+/gy;
  let offset = 0;
  let nodes = 0;
  while (offset < xml.length) {
    token.lastIndex = offset;
    const match = token.exec(xml);
    if (!match) throw new Error(`Malformed XML at ${offset}`);
    const value = match[0];
    offset = token.lastIndex;
    const parent = stack.at(-1);
    if (value.startsWith('<!--') || value.startsWith('<?')) continue;
    if (value.startsWith('<![CDATA[')) {
      parent.children.push(value.slice(9, -3));
    } else if (value.startsWith('</')) {
      if (stack.length === 1 || value.slice(2, -1).trim() !== parent.name) throw new Error('Mismatched XML close tag');
      stack.pop();
    } else if (value.startsWith('<')) {
      const name = /^<([\w:.-]+)/.exec(value)[1];
      const attrs = Object.create(null);
      for (const attribute of value.slice(name.length + 1).matchAll(/([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
        if (Object.hasOwn(attrs, attribute[1])) throw new Error('Duplicate XML attribute');
        attrs[attribute[1]] = decode(attribute[3] ?? attribute[4]);
      }
      const node = { name, local: name.split(':').at(-1), attrs, children: [] };
      parent.children.push(node);
      if (++nodes > 200000) throw new Error('XML node budget exceeded');
      if (!value.endsWith('/>')) stack.push(node);
      if (stack.length > 128) throw new Error('XML depth budget exceeded');
    } else {
      parent.children.push(decode(value));
    }
  }
  const roots = document.children.filter(child => typeof child !== 'string');
  if (stack.length !== 1 || roots.length !== 1 ||
      document.children.some(child => typeof child === 'string' && child.trim())) throw new Error('Malformed XML document');
  return roots[0];
}

const children = (node, local) => node.children.filter(child => typeof child !== 'string' && (!local || child.local === local));
function descendants(node, local) {
  return children(node).flatMap(child => [...(child.local === local ? [child] : []), ...descendants(child, local)]);
}
const first = (node, local) => descendants(node, local)[0];
const text = node => node.children.map(child => typeof child === 'string' ? child : text(child)).join('');
const attribute = (node, name) => node?.attrs[name] ?? null;
const number = value => value !== null && value !== undefined && value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null;

export function paragraphs(node) {
  return descendants(node, 'p').map(paragraph => {
    function content(current) {
      if (current.local === 't') return text(current);
      if (current.local === 'br') return '\n';
      if (current.local === 'tab') return '\t';
      return children(current).map(content).join('');
    }
    return {
      text: content(paragraph),
      properties: children(paragraph, 'pPr')[0]?.attrs ?? {},
      runs: children(paragraph).filter(child => ['r', 'fld', 'br'].includes(child.local)).map(run => ({
        kind: run.local, text: content(run),
        properties: children(run, 'rPr')[0]?.attrs ?? {},
        fonts: children(run, 'rPr').flatMap(properties => children(properties)
          .filter(font => ['latin', 'ea', 'cs'].includes(font.local))
          .map(font => ({ kind: font.local, ...font.attrs }))),
      })),
    };
  });
}

export function extractTable(table) {
  return {
    columns_emu: descendants(table, 'gridCol').map(column => number(column.attrs.w)),
    rows: children(table, 'tr').map(row => ({
      height_emu: number(row.attrs.h),
      cells: children(row, 'tc').map(cell => ({
        text: paragraphs(cell).map(paragraph => paragraph.text).join('\n'),
        paragraphs: paragraphs(cell), attributes: cell.attrs,
        properties: children(cell, 'tcPr')[0]?.attrs ?? {},
      })),
    })),
  };
}

export function extractChart(chart) {
  return {
    title: descendants(chart, 'title').flatMap(paragraphs),
    types: [...new Set(descendants(chart, 'plotArea').flatMap(area => children(area))
      .filter(node => /Chart$/.test(node.local)).map(node => node.local))],
    series: descendants(chart, 'ser').map(series => ({
      index: attribute(children(series, 'idx')[0], 'val'),
      order: attribute(children(series, 'order')[0], 'val'),
      data: children(series).filter(node => ['tx', 'cat', 'val', 'xVal', 'yVal', 'bubbleSize'].includes(node.local)).map(data => ({
        role: data.local,
        formulas: descendants(data, 'f').map(text),
        direct_values: children(data, 'v').map(text),
        caches: ['strCache', 'numCache', 'strLit', 'numLit', 'multiLvlStrCache'].flatMap(kind =>
          descendants(data, kind).map(cache => ({
            kind, point_count: attribute(children(cache, 'ptCount')[0], 'val'),
            format_code: children(cache, 'formatCode').map(text),
            points: descendants(cache, 'pt').map(point => ({
              index: attribute(point, 'idx'), value: children(point, 'v').map(text).join(''),
            })),
            levels: children(cache, 'lvl').map(level => children(level, 'pt').map(point => ({
              index: attribute(point, 'idx'), value: children(point, 'v').map(text).join(''),
            }))),
          }))),
      })),
    })),
    text_values: descendants(chart, 't').map(text),
    cache_warning: 'Cached values are observations, not proof of source accuracy or workbook editability. Embedded workbooks are inventoried, not executed or recalculated.',
  };
}

function geometry(object, grouped, page) {
  const transform = children(object, 'xfrm')[0] ?? children(object, 'spPr').flatMap(properties => children(properties, 'xfrm'))[0];
  const off = transform && children(transform, 'off')[0];
  const ext = transform && children(transform, 'ext')[0];
  const x = number(attribute(off, 'x'));
  const y = number(attribute(off, 'y'));
  const width = number(attribute(ext, 'cx'));
  const height = number(attribute(ext, 'cy'));
  const rotated = transform && number(transform.attrs.rot ?? '0') !== 0;
  const flipped = transform && ['flipH', 'flipV'].some(key => ['1', 'true'].includes(transform.attrs[key]));
  const reliable = !grouped && !rotated && !flipped &&
    [x, y, width, height].every(value => value !== null) && width >= 0 && height >= 0;
  return {
    status: reliable ? 'simple-unrotated-frame-only' : 'unsupported-or-inherited-not-verified',
    raw_transform: transform ? { attributes: transform.attrs, offset: off?.attrs ?? null, extent: ext?.attrs ?? null } : null,
    frame_inches: reliable ? { x: x / EMU_PER_INCH, y: y / EMU_PER_INCH, width: width / EMU_PER_INCH, height: height / EMU_PER_INCH } : null,
    outside_page_frame: reliable && page ? x < 0 || y < 0 || x + width > page.cx || y + height > page.cy : null,
    text_fit: 'not-verified',
  };
}

function extractObjects(slide, relationships, page) {
  const tree = first(slide, 'spTree');
  const objects = [];
  function visit(parent, grouped) {
    for (const node of children(parent)) {
      if (!['sp', 'cxnSp', 'pic', 'graphicFrame', 'grpSp'].includes(node.local)) continue;
      const identity = first(node, 'cNvPr');
      const relIds = descendants(node, 'chart').map(chart => chart.attrs['r:id']).filter(Boolean);
      const imageIds = descendants(node, 'blip').flatMap(blip => [blip.attrs['r:embed'], blip.attrs['r:link']]).filter(Boolean);
      const paras = node.local === 'grpSp' ? [] : paragraphs(node);
      objects.push({
        kind: node.local, id: attribute(identity, 'id'), name: attribute(identity, 'name'),
        description: attribute(identity, 'descr'), grouped,
        preset_geometry: attribute(first(node, 'prstGeom'), 'prst'),
        geometry: geometry(node, grouped || node.local === 'grpSp', page),
        paragraphs: paras, text: paras.map(paragraph => paragraph.text).join('\n'),
        text_body_properties: descendants(node, 'bodyPr').map(properties => properties.attrs),
        tables: node.local === 'grpSp' ? [] : descendants(node, 'tbl').map(extractTable),
        charts: node.local === 'grpSp' ? [] : relIds.map(id => ({ id, relationship: relationships.find(rel => rel.id === id) ?? null })),
        pictures: node.local === 'grpSp' ? [] : imageIds.map(id => ({ id, relationship: relationships.find(rel => rel.id === id) ?? null })),
      });
      if (node.local === 'grpSp') visit(node, true);
    }
  }
  if (tree) visit(tree, false);
  return objects;
}

export async function inspectPptxBytes(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length > MAX_PACKAGE) throw new Error('Invalid/oversized PPTX bytes');
  const zip = await JSZip.loadAsync(bytes);
  const entries = Object.values(zip.files);
  if (entries.length > 10000) throw new Error('ZIP entry budget exceeded');
  let expanded = 0;
  for (const entry of entries) {
    const name = entry.dir ? entry.name.replace(/\/$/, '') : entry.name;
    safeRelative(name);
    if (entry.unsafeOriginalName && entry.unsafeOriginalName !== entry.name) throw new Error('Unsafe normalized ZIP path');
    // JSZip exposes central-directory sizes here; check before decompressing any part.
    const size = entry._data?.uncompressedSize ?? 0;
    if (size > MAX_EXPANDED || (expanded += size) > MAX_EXPANDED) throw new Error('Expanded ZIP budget exceeded');
  }
  const xmlCache = new Map();
  async function xml(name) {
    safeRelative(name);
    if (xmlCache.has(name)) return xmlCache.get(name);
    const entry = zip.file(name);
    if (!entry) throw new Error(`Missing package part: ${name}`);
    if ((entry._data?.uncompressedSize ?? 0) > MAX_XML) throw new Error(`Oversized XML: ${name}`);
    const root = parseXml(await entry.async('string'));
    xmlCache.set(name, root);
    return root;
  }
  async function relationships(part, required = false) {
    const relName = part ? path.posix.join(path.posix.dirname(part), '_rels', `${path.posix.basename(part)}.rels`) : '_rels/.rels';
    if (!zip.file(relName) && !required) return [];
    const root = await xml(relName);
    if (root.local !== 'Relationships') throw new Error(`Invalid relationships: ${relName}`);
    const ids = new Set();
    return children(root, 'Relationship').map(rel => {
      const { Id: id, Type: type, Target: target, TargetMode: mode } = rel.attrs;
      if (!id || ids.has(id) || !type || !target) throw new Error(`Invalid relationship: ${relName}`);
      ids.add(id);
      if (mode === 'External') return { id, type, target, external: true, part: null };
      if (mode && mode !== 'Internal') throw new Error('Invalid relationship mode');
      if (/[\\:%?#]/.test(target)) throw new Error(`Unsafe relationship target: ${target}`);
      const resolved = path.posix.normalize(target.startsWith('/') ? target.slice(1) : path.posix.join(path.posix.dirname(part), target));
      safeRelative(resolved);
      if (!zip.file(resolved)) throw new Error(`Missing relationship target: ${resolved}`);
      return { id, type, target, external: false, part: resolved };
    });
  }
  const types = await xml('[Content_Types].xml');
  if (types.local !== 'Types' || !children(types, 'Override').some(type =>
    type.attrs.PartName === '/ppt/presentation.xml' &&
    type.attrs.ContentType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml')) {
    throw new Error('Not a standard non-macro PPTX package');
  }
  const packageRels = await relationships('', true);
  if (!packageRels.some(rel => rel.type.endsWith('/officeDocument') && rel.part === 'ppt/presentation.xml')) {
    throw new Error('Missing presentation relationship');
  }
  const presentation = await xml('ppt/presentation.xml');
  if (presentation.local !== 'presentation') throw new Error('Invalid presentation part');
  const presentationRels = await relationships('ppt/presentation.xml', true);
  const size = children(presentation, 'sldSz')[0];
  const cx = number(attribute(size, 'cx'));
  const cy = number(attribute(size, 'cy'));
  const page = cx > 0 && cy > 0 ? { cx, cy, width_inches: cx / EMU_PER_INCH, height_inches: cy / EMU_PER_INCH } : null;
  const slides = [];
  const referencedNotes = new Set();
  for (const slideId of descendants(presentation, 'sldId')) {
    const rel = presentationRels.find(item => item.id === slideId.attrs['r:id']);
    if (!rel?.part || !rel.type.endsWith('/slide')) throw new Error('Invalid slide relationship');
    const root = await xml(rel.part);
    if (root.local !== 'sld') throw new Error('Invalid slide XML');
    const rels = await relationships(rel.part);
    const notes = [];
    for (const noteRel of rels.filter(item => item.type.endsWith('/notesSlide'))) {
      if (!noteRel.part) throw new Error('External notes are unsupported');
      referencedNotes.add(noteRel.part);
      const note = await xml(noteRel.part);
      if (note.local !== 'notes') throw new Error('Invalid notes XML');
      notes.push({
        part: noteRel.part, paragraphs: paragraphs(note),
        placeholders: descendants(note, 'sp').map(shape => ({
          type: attribute(first(shape, 'ph'), 'type'), paragraphs: paragraphs(shape),
        })),
      });
    }
    slides.push({
      number: slides.length + 1, part: rel.part, relationships: rels,
      paragraphs: paragraphs(root), objects: extractObjects(root, rels, page), notes,
    });
  }
  if (!slides.length) throw new Error('PPTX contains no slides');
  const charts = {};
  const orphanNotes = {};
  const binaryParts = {};
  for (const entry of entries.filter(entry => !entry.dir)) {
    if (/^ppt\/charts\/[^/]+\.xml$/.test(entry.name)) {
      const chart = await xml(entry.name);
      if (chart.local === 'chartSpace') charts[entry.name] = { ...extractChart(chart), relationships: await relationships(entry.name) };
    }
    if (/^ppt\/notesSlides\/[^/]+\.xml$/.test(entry.name) && !referencedNotes.has(entry.name)) {
      orphanNotes[entry.name] = paragraphs(await xml(entry.name));
    }
    if (/^ppt\/(?:media|embeddings)\//.test(entry.name)) {
      const data = await entry.async('nodebuffer');
      binaryParts[entry.name] = { bytes: data.length, sha256: sha256(data) };
    }
  }
  return {
    schema_version: 1, inspection: 'static-ooxml-only', package_sha256: sha256(bytes), package_bytes: bytes.length,
    page, slides, charts, orphan_notes: orphanNotes, binary_parts: binaryParts,
    package_parts: entries.filter(entry => !entry.dir).map(entry => entry.name).sort(),
    limitations: [
      'No rendering, source-module import, execution, network fetch, semantic grading or automatic pass/fail.',
      'OOXML object counts do not establish semantic quality, native editing usability, or data correctness.',
      'Text fit, CJK shaping/font substitution, clipping, overlap, contrast and visual readability are NOT VERIFIED.',
      'Only explicit unrotated, unflipped, ungrouped frames are checked against page bounds; strokes, effects, custom paths and inherited/group geometry are not verified.',
      'Slide/notes text is distinct. Master/layout-inherited text and effective styling, SmartArt, equations, chartEx and alternate-content rendering are not resolved.',
      'Chart caches are extracted without recalculation; embedded workbook contents, actual editing and formulas need independent application review.',
      'XML extraction uses local names and conventional OOXML r:id/r:embed/r:link attributes; it is not a complete OOXML/schema validator.',
    ],
    judgments: null, powerpoint_review: null,
  };
}

export async function inspectPptx(input, output) {
  const source = await safePath(input);
  const destination = await safePath(output);
  if (path.extname(source).toLowerCase() !== '.pptx' || path.extname(destination).toLowerCase() !== '.json') {
    throw new Error('Expected a .pptx input and a new .json output');
  }
  if (await fs.lstat(destination).then(() => true, error => {
    if (error.code !== 'ENOENT') throw error;
    return false;
  })) throw new Error(`Output already exists: ${destination}`);
  if ((await fs.stat(source)).size > MAX_PACKAGE) throw new Error('Oversized PPTX file');
  const report = await inspectPptxBytes(await readRegular(source));
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4) throw new Error('Usage: node evals\\pptx-first-round\\inspect.mjs <deck.pptx> <new-report.json>');
    const report = await inspectPptx(process.argv[2], process.argv[3]);
    console.log(JSON.stringify({ slides: report.slides.length, inspection: report.inspection, output: path.resolve(process.argv[3]) }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
