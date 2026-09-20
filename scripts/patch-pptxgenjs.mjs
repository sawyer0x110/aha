import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// PptxGenJS 4.0.1 allocates tables, media and slide numbers independently.
// Patch the producer, not serialized XML: relationship IDs and media object IDs
// stay unchanged. Ordinary objects retain idx+2 unless a media ID reserves it.
// Raw XML/custom timing or connector references into these private allocations
// are not supported; this is not a reference-remapping or PPTX repair facility.
const allocation = `    const objectIds = [];
    const usedObjectIds = new Set([1]);
    for (const object of slide._slideObjects) {
        if (object._type !== SLIDE_OBJECT_TYPES.media) continue;
        const id = object.mediaRid + 2;
        if (!Number.isSafeInteger(id) || id < 2 || usedObjectIds.has(id))
            throw new Error('PPTX_OBJECT_ID: invalid or duplicate reserved media ID on slide ' + slide._slideNum);
        usedObjectIds.add(id);
    }
    let nextObjectId = slide._slideObjects.length + 2;
    for (const id of usedObjectIds) nextObjectId = Math.max(nextObjectId, id + 1);
    slide._slideObjects.forEach((object, idx) => {
        if (object._type === SLIDE_OBJECT_TYPES.media) {
            objectIds.push(object.mediaRid + 2);
        } else {
            const id = usedObjectIds.has(idx + 2) ? nextObjectId++ : idx + 2;
            usedObjectIds.add(id);
            objectIds.push(id);
        }
    });`;

const edits = [
  ['    let intTableNum = 1;', allocation, 1],
  ['<p:cNvPr id="${idx + 2}"', '<p:cNvPr id="${objectIds[idx]}"', 3],
  ['<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${intTableNum * slide._slideNum + 1}"',
    '<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${objectIds[idx]}"', 1],
  ['                intTableNum++;', '', 1],
  [`        strSlideXml += '  <p:cNvPr id="25" name="Slide Number Placeholder 0"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>';`,
    '        strSlideXml += `  <p:cNvPr id="${nextObjectId}" name="Slide Number Placeholder 0"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>`;', 1],
];
const fingerprints = {
  'pptxgen.cjs.js': '873d182a8e2e1c0b5e522ef146117936b96b9b2024667bd4c1de59e2b031d27a',
  'pptxgen.es.js': '05844c5625e2cda3b449eb967c2246dd57ca57341886a7c28eeebca263b29bd4',
};
const hash = source => createHash('sha256').update(source).digest('hex');

function replace(source, before, after, count) {
  if (source.split(before).length - 1 !== count) throw new Error(`PptxGenJS patch context changed: ${before}`);
  return source.split(before).join(after);
}

export async function patchPptxGenJS() {
  const root = fileURLToPath(new URL('../node_modules/pptxgenjs/', import.meta.url));
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  if (manifest.version !== '4.0.1') throw new Error('Review the PptxGenJS object-ID patch before changing version 4.0.1.');
  const pending = [];
  for (const [file, fingerprint] of Object.entries(fingerprints)) {
    const target = path.join(root, 'dist', file);
    const source = await readFile(target, 'utf8');
    // Recover the original only to verify an already-patched installation.
    // A nonempty marker makes reversal unambiguous and detects partial patches.
    const reversible = edits.map(([before, after, count]) => [before, after || '                // Aha: table IDs use the shared object allocation.', count]);
    if (hash(source) !== fingerprint) {
      let original = source;
      for (const [before, after, count] of [...reversible].reverse()) original = replace(original, after, before, count);
      if (hash(original) !== fingerprint) throw new Error(`Unrecognized PptxGenJS source: ${file}; refusing an unreviewed patch.`);
      continue;
    }
    let patched = source;
    for (const [before, after, count] of reversible) patched = replace(patched, before, after, count);
    pending.push([target, patched]);
  }
  for (const [target, patched] of pending) await writeFile(target, patched);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await patchPptxGenJS();
