import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeReadability, htmlCopy, lintHtml, lintText, lintNarration, READABILITY_LIMITS, type CopyBlock } from '../src/artifacts/readability.js';

const words = (count: number) => Array.from({ length: count }, () => 'word').join(' ');
const block = (text: string, role: CopyBlock['role'] = 'body'): CopyBlock => ({
  text, role, location: { file: 'copy.txt', locator: 'paragraph', line: 2, column: 1 },
});

test('each medium warns strictly above its English and Chinese thresholds, without gating', () => {
  for (const format of ['html', 'image', 'pptx', 'video'] as const) {
    const limits = READABILITY_LIMITS[format];
    for (const [role, english, chinese] of [
      ['body', limits.en, limits.zh], ['label', limits.labelEn, limits.labelZh],
    ] as const) {
      for (const [text, long] of [[words(english), words(english + 1)], ['字'.repeat(chinese), '字'.repeat(chinese + 1)]]) {
        assert.equal(analyzeReadability([block(text!, role)], format).warnings.length, 0);
        const result = analyzeReadability([block(long!, role)], format);
        assert.equal(result.status, 'checked');
        assert.equal(result.mode, 'advisory');
        assert.equal(result.warnings.length, 1);
        assert.equal(result.warnings[0]!.rule, 'sentence-length');
        assert.deepEqual(result.warnings[0]!.location, block('').location);
        assert.match(result.warnings[0]!.suggestion, /causal link, conditions, negation, units and evidence uncertainty/);
        assert.match(result.verification, /not ASD-STE100 compliance/);
      }
    }
  }
  assert.equal(analyzeReadability([block(words(30))], 'html').warnings.length, 0);
  assert.equal(analyzeReadability([block(words(30))], 'image').warnings.length, 1);
});

test('paragraph hints vary by medium and do not impose paragraph limits on labels', () => {
  for (const format of ['html', 'image', 'pptx', 'video'] as const) {
    const count = READABILITY_LIMITS[format].paragraph;
    assert.equal(analyzeReadability([block('It waits. '.repeat(count))], format).warningCount, 0);
    const long = analyzeReadability([block('It waits. '.repeat(count + 1))], format);
    assert.deepEqual(long.warnings.map(item => item.rule), ['paragraph-length']);
    assert.equal(analyzeReadability([block('Wait. '.repeat(count + 1), 'label')], format).warningCount, 0);
  }
});

test('HTML extraction keeps bilingual branches, SVG/accessibility labels and source positions without executing code', () => {
  const source = `<html lang="en"><body>
<section data-aha-lang="en"><p id="english">${words(36)}.</p></section>
<section data-aha-lang="zh" lang="zh-CN" hidden><p id="chinese">${'字'.repeat(61)}。</p></section>
<h2>${words(13)}</h2>
<svg><text>${words(13)}</text></svg>
<button aria-label="${words(13)}">Open</button>
<script>throw new Error("utilize");</script>
<style>.utilize{}</style><pre class="mermaid">utilize</pre><code>utilize</code>
<blockquote>utilize</blockquote><q>utilize</q><template><p>utilize</p></template>
<p>Reader &amp; server use <em>one</em> name.</p>
</body></html>`;
  const original = source;
  const result = lintHtml(source, 'html', 'html\\index.html');
  assert.equal(result.warnings.length, 5);
  assert.deepEqual(result.warnings.slice(0, 2).map(item => item.language), ['en', 'zh']);
  assert.deepEqual(result.warnings[1]!.location, {
    file: 'html\\index.html', locator: 'p#chinese', line: 3, column: source.split('\n')[2]!.indexOf('<p') + 1,
  });
  assert.ok(result.warnings.some(item => item.location.locator === 'button[aria-label]'));
  assert.equal(result.codeExecuted, false);
  assert.equal(source, original);
  assert.ok(htmlCopy(source, 'source.html').some(item => item.text === 'Reader & server use one name.'));
  assert.doesNotMatch(result.warnings.map(item => item.excerpt).join(' '), /utilize/);
});

test('length checks handle mixed script, abbreviations and decimal numbers without treating them as separate sentences', () => {
  const mixed = analyzeReadability([block(`${'字'.repeat(59)} TCP ACK。`)], 'html');
  assert.match(mixed.warnings[0]!.message, /61 Han characters plus other words/);
  assert.equal(analyzeReadability([block('The value is 1.25 ms. Use e.g. a timer.')], 'html').warningCount, 0);
});

test('wording and naming hints preserve technical vocabulary, quotes and evidence uncertainty', () => {
  const source = [
    'The cache may return an older response for approximately 5 ms.',
    'The SYN-ACK was stored. Check foo_bar and p99.',
    'Utilize the cache in order to help the reader log in.',
    'The reader can sign in.',
  ].join('\n\n');
  const result = lintText(source, 'html', 'copy.txt');
  assert.deepEqual(result.warnings.map(item => item.rule), ['wording', 'wording', 'term-consistency']);
  assert.match(result.warnings[2]!.suggestion, /If they are distinct/);
  assert.equal(result.warnings[2]!.location.line, 7);
  const chinese = lintText('可能约需 5 毫秒，不保证每次相同。\n\n进行检查，但不能显著提升未经测量的性能。\n\n点击按钮。\n\n单击按钮。', 'html', 'copy.txt');
  assert.deepEqual(chinese.warnings.map(item => item.rule), ['wording', 'wording', 'term-consistency']);
  assert.match(chinese.warnings[1]!.suggestion, /do not invent a measurement/);
  assert.equal(source.includes('approximately'), true);
});

test('Markdown checks copy, not frontmatter, fences, inline code or block quotations', () => {
  const source = [
    '---', 'title: utilize', '---', '# Utilize a cache',
    'The `utilize()` call waits.', '', '> Utilize the stored text.',
    '````js', 'utilize();', '```', 'utilize();', '````',
    '~~~html', 'utilize', '~~~', '', 'Use [the source](https://example.com/utilize).',
    '', '- Utilize one action.', '', '| Description | Meaning |', '| --- | --- |', '| Utilize | use |',
  ].join('\r\n');
  const result = lintText(source, 'html', 'copy.md', true);
  assert.deepEqual(result.warnings.map(item => item.location.line), [4, 19, 23]);
  assert.ok(result.warnings.every(item => item.rule === 'wording'));
  assert.equal(lintText('```js\nutilize();\n```', 'html', 'code.md', true).status, 'not-checked');
});

test('unsupported declared languages do not receive English/Chinese vocabulary rewrites', () => {
  const result = lintHtml('<html lang="fr"><body><p>utilize</p><p>赋能</p></body></html>', 'html', 'copy.html');
  assert.equal(result.warningCount, 0);
  const long = lintHtml(`<p lang="fr">${words(36)}</p>`, 'html', 'copy.html');
  assert.equal(long.warnings[0]!.language, 'other');
  assert.equal(long.warnings[0]!.rule, 'sentence-length');
});

test('video narration warnings point to segment text rather than pretending to inspect audio or frames', () => {
  const result = lintNarration([{ id: 'beat-one', text: `${words(29)}.` }, { id: 'beat-two', text: 'It may fail.' }], 'plan.json');
  assert.equal(result.format, 'video');
  assert.deepEqual(result.warnings[0]!.location, { file: 'plan.json', locator: '/segments/0/text (beat-one)' });
  assert.equal(result.blocksChecked, 2);
  assert.match(result.extraction, /no synthesized audio/);
});

test('warning output is bounded and reports omissions instead of silently truncating', () => {
  const result = analyzeReadability(Array.from({ length: 205 }, () => block('Utilize the cache.')), 'html');
  assert.equal(result.warningCount, 205);
  assert.equal(result.warnings.length, 200);
  assert.equal(result.truncated, true);
  assert.equal(analyzeReadability([], 'html').status, 'not-checked');
});
