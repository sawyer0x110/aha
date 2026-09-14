import * as fs from 'node:fs/promises';
import path from 'node:path';
import { Type, type Static } from '@sinclair/typebox';
import { check } from '../core/check.js';
import { fail } from '../core/errors.js';
import { limitedJsonText, writeNewFile } from '../cli/files.js';
import { readDossier, writeDossier } from '../research/dossier.js';
import type { Dossier } from '../research/schema.js';
import { hashFiles, localPath, noLinks, outsideProject, sourceFiles } from './files.js';
import { themeCss, themeScript } from './theme.js';

export const FORMATS = ['html', 'image', 'pptx', 'video'] as const;
export type Format = typeof FORMATS[number];
export const LANGUAGES = ['en', 'zh', 'bilingual'] as const;
export type ArtifactLanguage = typeof LANGUAGES[number];
const id = Type.String({ minLength: 1, maxLength: 160 });
export const ArtifactSchema = Type.Object({
  schemaVersion: Type.Literal('1.0.0'),
  format: Type.Union(FORMATS.map(format => Type.Literal(format))),
  language: Type.Optional(Type.Union(LANGUAGES.map(language => Type.Literal(language)))),
  researchHash: Type.String({ pattern: '^[a-f0-9]{64}$' }),
  title: Type.String({ minLength: 1, maxLength: 1000 }),
  status: Type.Union([Type.Literal('draft'), Type.Literal('authored')]),
  entry: Type.String({ minLength: 1, maxLength: 512 }),
  coverage: Type.Array(Type.Object({
    id, claimIds: Type.Array(id, { minItems: 1, maxItems: 10000, uniqueItems: true }),
  }, { additionalProperties: false }), { maxItems: 10000 }),
  omissions: Type.Array(Type.Object({
    claimId: id, reason: Type.String({ minLength: 1, maxLength: 4000, pattern: '\\S' }),
  }, { additionalProperties: false }), { maxItems: 10000 }),
  width: Type.Integer({ minimum: 320, maximum: 4096 }),
  height: Type.Integer({ minimum: 240, maximum: 16000 }),
}, { additionalProperties: false });
export type Artifact = Static<typeof ArtifactSchema>;
export const SCAFFOLD_MARKER = 'AHA_UNAUTHORED_SCAFFOLD';

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

function scaffold(format: Format, title: string, language: ArtifactLanguage): string {
  if (format === 'pptx') return `// ${SCAFFOLD_MARKER}: replace this example with your authored native slides.
// Runs as arbitrary Node code only after --allow-code. This is NOT a sandbox.
export default async function ({ pptx, research }) {
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Aha';
  pptx.subject = research.question;
  const slide = pptx.addSlide();
  slide.addText(${JSON.stringify(title)}, { x: 0.6, y: 0.6, w: 12, h: 1, fontSize: 32, fontFace: 'Aptos' });
  slide.addText('Author native text, shapes, charts, tables and citations here.', { x: 0.6, y: 2, w: 12, h: 2, fontSize: 22 });
}
`;
  return `<!doctype html>
<html lang="${language === 'zh' ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><script>${themeScript}</script><style>${themeCss}
main { padding: 32px; } h1 { line-height: 1.2; } svg { width: 100%; }
${format === 'video' ? 'html, body { width: 1280px; height: 720px; overflow: hidden; }' : ''}
</style></head><body>
<!-- ${SCAFFOLD_MARKER}: author this source, map claims or explain omissions, remove this marker, then set artifact.json status to authored. -->
<main>${language === 'bilingual' ? `<section data-aha-lang="en" lang="en" data-aha-title="Author the English title"><h1>Author the English explanation</h1><p>Write the complete English argument and its limitations.</p></section>
<section data-aha-lang="zh" lang="zh-CN" data-aha-title="编写中文标题"><h1>编写中文讲解</h1><p>编写完整的中文论证与限定条件。</p></section>` : `<h1>${escapeHtml(title)}</h1><p>Replace this scaffold with an explanation designed for your audience.</p>`}
${format === 'video' ? `<svg viewBox="0 0 1200 360" role="img" aria-label="Replace this sample animation"><circle id="moving-point" cx="80" cy="180" r="48" fill="var(--cp-accent)"/></svg><p id="caption"></p>` : language === 'bilingual' ? '' : '<p>Use any layout, local assets, interactive JavaScript, or &lt;pre class="mermaid"&gt; diagram source.</p>'}
</main>${format === 'video' ? `<script>
window.ahaVideo = { renderFrame({ frame, fps, segmentIndex, segmentFrame, segmentFrames, text }) {
  const progress = segmentFrames > 1 ? segmentFrame / (segmentFrames - 1) : 0;
  document.getElementById('moving-point').setAttribute('cx', String(80 + progress * 1040));
  document.getElementById('caption').textContent = text;
} };
</script>` : ''}
</body></html>
`;
}

export async function initArtifact(researchDirectory: string, format: Format, destination: string, language: ArtifactLanguage = format === 'html' ? 'bilingual' : 'en'): Promise<object> {
  if (!FORMATS.includes(format)) fail('ARTIFACT_FORMAT', 'Unsupported artifact format.');
  if (!LANGUAGES.includes(language) || (language === 'bilingual' && format !== 'html')) {
    fail('ARTIFACT_LANGUAGE', 'Choose en or zh; bilingual is supported only for HTML.');
  }
  const dossier = await readDossier(researchDirectory);
  const output = await outsideProject(researchDirectory, destination);
  await noLinks(output, true);
  const entry = format === 'pptx' ? 'pptx/main.mjs' : 'html/index.html';
  const artifact: Artifact = {
    schemaVersion: '1.0.0', format, language, researchHash: dossier.manifest.contentHash,
    title: dossier.research.title, status: 'draft', entry, coverage: [], omissions: [],
    width: format === 'image' ? 1080 : 1280, height: format === 'image' ? 1600 : 720,
  };
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.mkdir(output);
  await writeDossier(path.join(output, 'research'), dossier);
  await writeNewFile(path.join(output, entry), scaffold(format, artifact.title, language));
  await writeNewFile(path.join(output, 'artifact.json'), limitedJsonText(artifact, 'artifact.json'));
  return { directory: output, format, language, status: 'draft', entry, researchHash: artifact.researchHash };
}

export async function readArtifact(directory: string): Promise<{ root: string; artifact: Artifact; dossier: Dossier }> {
  const root = path.resolve(directory);
  const files = await sourceFiles(root);
  const metadata = files.get('artifact.json');
  if (!metadata) fail('ARTIFACT_MISSING', 'Missing artifact.json.', root);
  let value: unknown;
  try { value = JSON.parse(metadata.toString('utf8').replace(/^\uFEFF/, '')); }
  catch { fail('JSON_SYNTAX', 'Invalid artifact.json.'); }
  const artifact = check(ArtifactSchema, value);
  if (artifact.language === 'bilingual' && artifact.format !== 'html') {
    fail('ARTIFACT_LANGUAGE', 'Bilingual output is supported only for HTML.');
  }
  localPath(artifact.entry);
  if (!files.has(artifact.entry)) fail('ARTIFACT_ENTRY', 'Authored entry does not exist.', artifact.entry);
  if (artifact.format === 'pptx' ? !artifact.entry.endsWith('.mjs') : !/\.html?$/i.test(artifact.entry)) {
    fail('ARTIFACT_ENTRY', 'Use an .mjs entry for PPTX or an HTML entry for visual formats.');
  }
  if (artifact.format !== 'image' && artifact.height > 4096) fail('ARTIFACT_SIZE', 'Only image projects support heights above 4096.');
  if (artifact.format === 'video' && (artifact.width !== 1280 || artifact.height !== 720)) fail('ARTIFACT_SIZE', 'Video projects must be 1280 × 720.');
  const dossier = await readDossier(path.join(root, 'research'));
  if (artifact.researchHash !== dossier.manifest.contentHash) fail('RESEARCH_MISMATCH', 'Artifact researchHash does not match its research snapshot.');
  const claims = new Set(dossier.research.claims.map(claim => claim.id));
  const ids = new Set<string>();
  const covered = new Set<string>();
  for (const item of artifact.coverage) {
    if (ids.has(item.id)) fail('COVERAGE_DUPLICATE', 'Coverage IDs must be unique.', item.id);
    ids.add(item.id);
    for (const claimId of item.claimIds) {
      if (!claims.has(claimId)) fail('COVERAGE_UNKNOWN', 'Coverage references an unknown claim.', claimId);
      covered.add(claimId);
    }
  }
  const omitted = new Set<string>();
  for (const omission of artifact.omissions) {
    if (!claims.has(omission.claimId)) fail('COVERAGE_UNKNOWN', 'Omission references an unknown claim.', omission.claimId);
    if (omitted.has(omission.claimId) || covered.has(omission.claimId)) fail('COVERAGE_DUPLICATE', 'Claims cannot be omitted twice or both covered and omitted.', omission.claimId);
    omitted.add(omission.claimId);
  }
  return { root, artifact, dossier };
}

export async function assertAuthored(directory: string): Promise<Awaited<ReturnType<typeof readArtifact>>> {
  const result = await readArtifact(directory);
  const files = await sourceFiles(result.root);
  if (result.artifact.status !== 'authored' || [...files.values()].some(bytes => bytes.includes(SCAFFOLD_MARKER))) {
    fail('ARTIFACT_DRAFT', 'Incomplete scaffold: author the source, remove its scaffold marker, and set status to authored.');
  }
  const mapped = new Set([...result.artifact.coverage.flatMap(item => item.claimIds), ...result.artifact.omissions.map(item => item.claimId)]);
  for (const claim of result.dossier.research.claims) {
    if (!mapped.has(claim.id)) fail('COVERAGE_MISSING', 'Every research claim needs a coverage mapping or explicit omission.', claim.id);
  }
  return result;
}

export async function sourceHash(directory: string): Promise<string> {
  await readArtifact(directory);
  return hashFiles(await sourceFiles(directory));
}

export async function checkArtifact(directory: string): Promise<object> {
  const { artifact, dossier } = await assertAuthored(directory);
  if (artifact.format !== 'pptx') {
    const { prepareHtml } = await import('./html.js');
    await prepareHtml(directory);
  }
  return {
    ok: true, ready: true, format: artifact.format, researchId: dossier.manifest.researchId,
    researchHash: artifact.researchHash, sourceHash: await sourceHash(directory),
    coverage: artifact.coverage.length, omissions: artifact.omissions.length,
    verification: 'Structural provenance and declared coverage only; not semantic or visual verification. No authored code executed.',
  };
}
