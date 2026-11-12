import test from 'node:test';
import assert from 'node:assert/strict';
import { dataSource, directDetail } from '../src/github-data.js';

test('source URL recognizes direct and CDN and defaults to cache', () => {
  for (const [query, expected] of [['', 'cache'], ['?source=direct', 'direct'], ['?source=cdn', 'cdn'], ['?source=unknown', 'cache']]) {
    assert.equal(dataSource(`https://example.com/${query}#/repo`), expected);
  }
});

test('direct details use GitHub only, select localized README and count paginated commits', async t => {
  const requests = [];
  let language = 'zh-CN';
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push(url);
    assert.ok(url.startsWith('https://api.github.com/repos/owner/repo'));
    assert.equal(options.cache, 'no-store');
    if (options.headers.Accept === 'application/vnd.github.raw+json') {
      assert.ok(url.includes(language === 'en' ? 'README.en.md' : 'README.zh-CN.md'));
      return new Response('# Live README');
    }
    if (url.endsWith('/owner/repo')) return Response.json({ name: 'repo', full_name: 'owner/repo', description: 'Live', default_branch: 'main', license: { spdx_id: 'MIT' } });
    if (url.includes('/commits?')) return Response.json([{ sha: 'current-sha' }], { headers: { link: '<https://api.github.com/repos/owner/repo/commits?per_page=1&page=42>; rel="last"' } });
    if (url.includes('/releases?')) return Response.json([{ id: 1 }]);
    if (url.includes('/contents/docs?')) return Response.json([{ type: 'file', name: 'README.zh-CN.md', path: 'docs/README.zh-CN.md' }, { type: 'file', name: 'README.en.md', path: 'docs/README.en.md' }]);
    if (url.includes('/contents/.github?')) return new Response(null, { status: 404 });
    if (url.includes('/contents/?')) return Response.json([{ type: 'file', name: 'README.md', path: 'README.md' }]);
    assert.fail(`Unexpected request: ${url}`);
  });
  const repo = await directDetail('owner/repo', language);
  assert.equal(repo.description, 'Live');
  assert.equal(repo.license.spdxId, 'MIT');
  assert.equal(repo.commitCount, 42);
  assert.equal(repo.hasReleases, true);
  assert.equal(repo.readme.path, 'docs/README.zh-CN.md');
  assert.equal(repo.readme.ref, 'current-sha');
  language = 'en';
  const english = await directDetail('owner/repo', language);
  assert.equal(english.readmeEn.path, 'docs/README.en.md');
  assert.equal(requests.filter(url => url.endsWith('/owner/repo')).length, 2);
});

test('direct API failures propagate without falling back to cache', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    assert.ok(url.startsWith('https://api.github.com/'));
    return new Response(null, { status: 403 });
  });
  await assert.rejects(directDetail('owner/repo', 'en'), /GitHub HTTP 403/);
});

test('empty repositories have zero commits and no README', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.includes('/commits?')) return new Response(null, { status: 409 });
    if (url.includes('/releases?')) return Response.json([]);
    return Response.json({ name: 'empty', full_name: 'owner/empty' });
  });
  const repo = await directDetail('owner/empty', 'en');
  assert.equal(repo.commitCount, 0);
  assert.equal(repo.readme, null);
  assert.equal(repo.hasReleases, false);
});
