import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const pairs = ['README', 'docs/README', 'docs/INSTALL', '.github/CONTRIBUTING', '.github/SECURITY', 'docs/USAGE', 'examples/README'];
const withoutFences = (text: string): string => text.replace(/^```[^\n]*\r?\n[\s\S]*?^```[^\n]*$/gm, '');

function anchors(markdown: string): Set<string> {
  const used = new Set<string>();
  for (const match of withoutFences(markdown).matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const base = match[1]!.trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc}\-\s]/gu, '').replace(/ /g, '-');
    let anchor = base;
    for (let count = 1; used.has(anchor); count++) anchor = `${base}-${count}`;
    used.add(anchor);
  }
  return used;
}

test('human entry guides provide reciprocal English and Chinese links', async () => {
  for (const name of pairs) {
    const english = await fs.readFile(path.join(root, `${name}.md`), 'utf8');
    const chinese = await fs.readFile(path.join(root, `${name}.zh-CN.md`), 'utf8');
    assert.ok(english.includes(`(${path.basename(name)}.zh-CN.md)`), `${name}: English guide must link to Chinese`);
    assert.ok(chinese.includes(`(${path.basename(name)}.md)`), `${name}: Chinese guide must link to English`);
    assert.match(english, /English/);
    assert.match(chinese, /简体中文/);
  }
});

test('public documentation local links and Markdown heading anchors resolve', async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'examples', 'delivery-manifest.json'), 'utf8'));
  const topics = [...new Set(manifest.requestedOutputs.map((entry: { topic: string }) => entry.topic))];
  const files = [
    ...(await fs.readdir(root)).filter(file => file.endsWith('.md')),
    ...(await fs.readdir(path.join(root, 'docs'))).filter(file => file.endsWith('.md')).map(file => `docs/${file}`),
    ...(await fs.readdir(path.join(root, '.github'))).filter(file => file.endsWith('.md')).map(file => `.github/${file}`),
    ...(await fs.readdir(path.join(root, '.github', 'ISSUE_TEMPLATE'))).filter(file => file.endsWith('.md')).map(file => `.github/ISSUE_TEMPLATE/${file}`),
    'examples/README.md', 'examples/README.zh-CN.md',
    ...topics.map(topic => `examples/${topic}/README.md`),
  ];
  for (const file of files) {
    const absolute = path.join(root, file);
    const text = withoutFences(await fs.readFile(absolute, 'utf8'));
    const links = [
      ...[...text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)].map(match => match[1]!),
      ...[...text.matchAll(/\b(?:href|src)="([^"]+)"/g)].map(match => match[1]!),
    ];
    for (const link of links) {
      const repositoryLink = /^https:\/\/github\.com\/sawyer0x110\/aha\/(?:blob|tree)\/main\/(.+)$/.exec(link);
      if (!repositoryLink && /^[a-z][a-z0-9+.-]*:/i.test(link)) continue;
      const [name, fragment] = (repositoryLink?.[1] ?? link).split('#');
      const target = name ? path.resolve(repositoryLink ? root : path.dirname(absolute), decodeURIComponent(name)) : absolute;
      assert.ok(!path.relative(root, target).startsWith('..'), `${file}: link escapes repository: ${link}`);
      await assert.doesNotReject(fs.access(target), `${file}: missing link target: ${link}`);
      if (fragment && path.extname(target) === '.md') {
        assert.ok(anchors(await fs.readFile(target, 'utf8')).has(decodeURIComponent(fragment)), `${file}: missing heading: ${link}`);
      }
    }
  }
});

test('entry guides describe the current gallery without advertising the retired project tour', async () => {
  for (const file of ['README.md', 'README.zh-CN.md', 'examples/README.md', 'examples/README.zh-CN.md']) {
    const text = await fs.readFile(path.join(root, file), 'utf8');
    assert.match(text, /aha-introduction/);
    assert.doesNotMatch(text, /project-overview|historical project tour|历史快照项目导览/);
  }
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'examples', 'delivery-manifest.json'), 'utf8'));
  const decks = manifest.requestedOutputs.filter((entry: { format: string }) => entry.format === 'pptx');
  assert.equal(new Set(manifest.requestedOutputs.map((entry: { topic: string }) => entry.topic)).size, 5);
  assert.equal(manifest.requestedOutputs.length, 21);
  assert.equal(decks.length, 5);
  assert.equal(decks.reduce((total: number, deck: { slides: number }) => total + deck.slides, 0), 36);
  const english = await fs.readFile(path.join(root, 'examples', 'README.md'), 'utf8');
  const chinese = await fs.readFile(path.join(root, 'examples', 'README.zh-CN.md'), 'utf8');
  assert.match(english, /five example groups and twenty-one artifacts/);
  assert.match(english, /All five PPTX decks are Chinese/);
  assert.match(chinese, /五组示例、二十一份作品/);
  assert.match(chinese, /五份 PPTX 均为中文/);
});

test('README illustration is a standalone project introduction, not a gallery example', async () => {
  for (const [file, language] of [['README.md', 'en'], ['README.zh-CN.md', 'zh-CN']] as const) {
    const text = await fs.readFile(path.join(root, file), 'utf8');
    const images = [...text.matchAll(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/g)];
    assert.equal(images.length, 1);
    assert.equal(images[0]![1], `docs/assets/readme-intro.${language}.png`);
    assert.match(images[0]![0], /width="800"/);
    const png = await fs.readFile(path.join(root, 'docs', 'assets', `readme-intro.${language}.png`));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 1600);
    assert.equal(png.readUInt32BE(20), 1040);
  }
  const source = await fs.readFile(path.join(root, 'docs', 'assets', 'readme-intro.html'), 'utf8');
  for (const term of ['aha-research', 'aha-explain', 'HTML', 'PNG', 'PPTX', 'VIDEO', 'Not an automatic pipeline']) {
    assert.ok(source.includes(term), `Missing project concept: ${term}`);
  }
  assert.doesNotMatch(source, /examples[\\/]|Greenland|CPython|Docker|Git merge|格陵兰|降噪/i);
  assert.doesNotMatch(source, /<(?:img|iframe)\b|<script\b[^>]*\bsrc=|<link\b[^>]*\bhref=/i);
  await fs.access(path.join(root, 'docs', 'assets', 'render-readme-intro.mjs'));
});

test('install guides only use local links that survive release extraction', async () => {
  const packagedDocs = new Set(['INSTALL.md', 'INSTALL.zh-CN.md', 'LICENSE', 'LICENSE-SCOPE.md']);
  for (const file of packagedDocs) {
    const text = withoutFences(await fs.readFile(path.join(root, file === 'LICENSE' ? '' : 'docs', file), 'utf8'));
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const link = match[1]!;
      if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(link)) continue;
      assert.ok(packagedDocs.has(link.split('#')[0]!), `${file}: source-only relative link in portable docs: ${link}`);
    }
  }
});

test('root entry documents exclude relocated guides and compatibility pointers', async () => {
  for (const name of ['INSTALL.md', 'INSTALL.zh-CN.md', 'CONTRIBUTING.md', 'CONTRIBUTING.zh-CN.md', 'SECURITY.md', 'SECURITY.zh-CN.md', 'LICENSE-SCOPE.md']) {
    await assert.rejects(fs.access(path.join(root, name)), { code: 'ENOENT' });
  }
});

test('MIT metadata is consistent without treating npm privacy as GitHub visibility', async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(await fs.readFile(path.join(root, 'package-lock.json'), 'utf8'));
  assert.equal(manifest.license, 'MIT');
  assert.equal(lock.packages[''].license, 'MIT');
  assert.equal(manifest.private, true);
  const license = await fs.readFile(path.join(root, 'LICENSE'), 'utf8');
  assert.match(license, /^MIT License/);
  assert.match(license, /Permission is hereby granted, free of charge/);
  assert.match(license, /THE SOFTWARE IS PROVIDED "AS IS"/);
});
