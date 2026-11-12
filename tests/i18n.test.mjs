import test from 'node:test';
import assert from 'node:assert/strict';
import { languageFromUrl, languageUrl } from '../src/i18n.js';

test('language is explicit in shareable URLs and defaults to Simplified Chinese', () => {
  for (const query of ['', '?lang=zh-CN', '?lang=unknown']) {
    assert.equal(languageFromUrl(`https://example.com/site/${query}#/me`), 'zh-CN');
  }
  assert.equal(languageFromUrl('https://example.com/site/?lang=en#/repo/web-agent'), 'en');
});

test('changing language preserves deployment path, appearance, source, and repository route', () => {
  const original = 'https://example.com/site/?theme=dark&source=cdn#/repo/web-agent/owner/repo';
  const english = languageUrl(original, 'en');
  assert.equal(english.searchParams.get('lang'), 'en');
  assert.equal(english.searchParams.get('theme'), 'dark');
  assert.equal(english.searchParams.get('source'), 'cdn');
  assert.equal(english.pathname, '/site/');
  assert.equal(english.hash, '#/repo/web-agent/owner/repo');
  assert.equal(languageUrl(english, 'zh-CN').href, original);
});
