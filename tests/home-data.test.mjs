import test from 'node:test';
import assert from 'node:assert/strict';
import { isReadme, parseProfile } from '../src/home-data.js';

test('rejects SPA fallback documents, including cached and partial HTML', () => {
  for (const text of ['<!doctype html><html></html>', '<!-- fetchedAt: now -->\n<html></html>', '<meta charset="UTF-8" />\n<main>app</main>', '', null]) {
    assert.equal(isReadme(text), false);
  }
  assert.equal(isReadme('# error', 'text/html; charset=utf-8'), false);
  assert.equal(isReadme('<html></html>', 'application/xhtml+xml'), false);
});

test('accepts Markdown containing legitimate embedded HTML and cache metadata', () => {
  for (const text of ['# 你好 👋，<br>北新', '<!-- fetchedAt: now -->\n# 你好', '<div align="center">\n<img src="badge.svg" />\n</div>']) {
    assert.equal(isReadme(text), true);
  }
});

test('requires a valid profile rather than an API error or fallback HTML', () => {
  for (const text of [null, '<html></html>', '{"message":"rate limit exceeded"}', '{"profile":{}}']) {
    assert.equal(parseProfile(text), null);
  }
  assert.equal(parseProfile('{"login":"bexino"}').login, 'bexino');
  assert.equal(parseProfile('{"fetchedAt":"now","profile":{"login":"bexino"}}').login, 'bexino');
});


test('rejects unresolved merge conflicts without rejecting Markdown heading underlines', () => {
  assert.equal(isReadme('<<<<<<< HEAD\n# Old\n=======\n# New\n>>>>>>> branch'), false);
  assert.equal(isReadme('<!-- fetchedAt: now -->\n# Intro\n>>>>>>> branch'), false);
  assert.equal(isReadme('Title\n=======\nDescription'), true);
});

test('checked-in homepage caches are valid and contain no unresolved conflict markers', async () => {
  const { readFile } = await import('node:fs/promises');
  const profile = await readFile(new URL('../public/cache/github-user.json', import.meta.url), 'utf8');
  assert.ok(parseProfile(profile));
  for (const language of ['zh', 'en']) {
    const markdown = await readFile(new URL(`../public/cache/readme-${language}.md`, import.meta.url), 'utf8');
    assert.ok(isReadme(markdown), `Invalid ${language} homepage cache`);
  }
});
