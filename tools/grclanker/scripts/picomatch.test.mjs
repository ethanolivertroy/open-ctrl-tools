import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

// Resolve from a website consumer, so a nested registry copy also fails this check.
const require = createRequire(import.meta.url);
const fromTinyglobby = createRequire(require.resolve('tinyglobby'));
const picomatch = fromTinyglobby('picomatch');

test('documentation globs compile the repeat once and keep filename matching', () => {
  const rule = picomatch.makeRe('docs/+(page-*.md)');
  assert.doesNotMatch(rule.source, /\)\+/, 'the wildcard group must not be repeated');
  assert.ok(rule.test('docs/page-index.md'));
  assert.ok(rule.test('docs/page-one.mdpage-two.md'));
  assert.equal(rule.test('docs/page-index.ts'), false);
  assert.equal(rule.test('docs/archive/page-index.md'), false);
});
