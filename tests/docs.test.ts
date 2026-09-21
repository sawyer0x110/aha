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
  const publication = JSON.parse(await fs.readFile(path.join(root, 'examples', 'pptx-publication.json'), 'utf8'));
  assert.equal(new Set(manifest.requestedOutputs.map((entry: { topic: string }) => entry.topic)).size, 6);
  assert.equal(manifest.requestedOutputs.length, 16);
  assert.equal(publication.outputs.length, 4);
  assert.equal(publication.outputs.reduce((total: number, deck: { slides: number }) => total + deck.slides, 0), 30);
  const english = await fs.readFile(path.join(root, 'examples', 'README.md'), 'utf8');
  const chinese = await fs.readFile(path.join(root, 'examples', 'README.zh-CN.md'), 'utf8');
  assert.match(english, /six example groups and sixteen artifacts/);
  assert.match(english, /All four current PPTX decks/);
  assert.match(chinese, /六组示例、十六份作品/);
  assert.match(chinese, /四份当前 PPTX/);
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
