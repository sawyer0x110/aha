import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { themeScript } from '../src/artifacts/theme.js';

test('theme preference uses a valid query, then authored mode, then system preference', () => {
  const cases = [
    { query: '', authored: undefined, dark: false, expected: 'light' },
    { query: '', authored: undefined, dark: true, expected: 'dark' },
    { query: '', authored: 'light', dark: true, expected: 'light' },
    { query: '', authored: 'dark', dark: false, expected: 'dark' },
    { query: '?scoutTheme=light', authored: 'dark', dark: true, expected: 'light' },
    { query: '?scoutTheme=dark', authored: 'light', dark: false, expected: 'dark' },
    { query: '?scoutTheme=invalid', authored: 'light', dark: true, expected: 'light' },
    { query: '?scoutTheme=', authored: undefined, dark: false, expected: 'light' },
    { query: '?scoutTheme=invalid', authored: 'invalid', dark: false, expected: 'light' },
    { query: '', authored: 'invalid', dark: true, expected: 'dark' },
  ];
  for (const scenario of cases) {
    let mode = scenario.authored;
    const context = {
      URLSearchParams,
      window: {
        location: { search: scenario.query },
        matchMedia: (query: string) => {
          assert.equal(query, '(prefers-color-scheme: dark)');
          return { matches: scenario.dark };
        },
      },
      document: {
        documentElement: {
          getAttribute: (name: string) => { assert.equal(name, 'data-theme'); return mode ?? null; },
          setAttribute: (name: string, value: string) => { assert.equal(name, 'data-theme'); mode = value; },
        },
      },
    };
    runInNewContext(themeScript, context);
    assert.equal(mode, scenario.expected, JSON.stringify(scenario));
    runInNewContext(themeScript, context);
    assert.equal(mode, scenario.expected, 'packaging and scaffold initialization must agree');
  }
});
