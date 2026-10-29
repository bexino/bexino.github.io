import test from 'node:test';
import assert from 'node:assert/strict';
import { graphql, paginate, selectReadme, collectRepos, fetchDetail, main } from '../scripts/fetch-repo-data.mjs';

const page = (nodes, next = false, cursor = null) => ({ nodes, pageInfo: { hasNextPage: next, endCursor: cursor } });

test('missing credentials fail before touching the cache', async () => {
  await assert.rejects(main({ token: '', output: 'must-not-be-touched' }), /GH_TOKEN is required; no cache was changed/);
});

test('pagination collects every page and rejects stalled cursors', async () => {
  assert.deepEqual(await paginate(async after => after ? page([2]) : page([1], true, 'next')), [1, 2]);
  await assert.rejects(paginate(async () => page([], true, 'same')), /cursor/);
  await assert.rejects(paginate(async () => null), /Incomplete/);
});

test('Chinese README wins across directories; default README respects directory order', () => {
  const entries = paths => paths.map(path => ({ path, type: 'blob' }));
  assert.equal(selectReadme(entries(['README.md', 'docs/README.ZH-CN.md'])), 'docs/README.ZH-CN.md');
  assert.equal(selectReadme(entries(['docs/README.md', 'README.markdown'])), 'README.markdown');
  assert.equal(selectReadme(entries(['.github/README.zh-CN.md', 'docs/README.zh-CN.md', 'README.zh-CN.md'])), 'README.zh-CN.md');
  assert.equal(selectReadme([{ path: 'README.md', type: 'tree' }]), null);
});

test('GraphQL propagates transport and partial-data errors', async () => {
  await assert.rejects(graphql('', {}, 'test', async () => ({ ok: false, status: 403 })), /403/);
  await assert.rejects(graphql('', {}, 'test', async () => ({ ok: true, json: async () => ({ data: {}, errors: [{ message: 'denied' }] }) })), /denied/);
  await assert.rejects(graphql('', {}, 'test', async () => ({ ok: true, json: async () => ({}) })), /no data/);
});

test('list and item pagination excludes private records and deduplicates shared repositories', async () => {
  const repo = { name: 'app', nameWithOwner: 'owner/app', description: null, isPrivate: false };
  const run = async (query, variables) => {
    if (query.includes('user(login:')) return { user: { lists: variables.after ? page([{ id: 'b', name: 'Other', slug: 'other' }, { id: 'private', isPrivate: true }]) : page([{ id: 'a', name: 'Web & Agent', slug: 'web-and-agent' }], true, 'lists2') } };
    if (variables.id === 'a' && !variables.after) return { node: { items: page([repo], true, 'items2') } };
    return { node: { items: page([repo, { ...repo, nameWithOwner: 'secret/repo', isPrivate: true }]) } };
  };
  const result = await collectRepos(run);
  assert.equal(result.categories.length, 2);
  assert.equal(result.repositories.size, 1);
  assert.deepEqual(result.categories.map(c => c.repositories), [['owner/app'], ['owner/app']]);
});

test('empty repositories have zero commits and no README tree request', async () => {
  let calls = 0;
  const result = await fetchDetail('owner/empty', async () => {
    calls++;
    return { repository: { name: 'empty', nameWithOwner: 'owner/empty', defaultBranchRef: null, licenseInfo: null } };
  });
  assert.equal(calls, 1);
  assert.equal(result.commitCount, 0);
  assert.equal(result.readme, null);
  assert.equal(result.license, null);
});

test('README and metadata use one pinned default-branch revision', async () => {
  const calls = [];
  const result = await fetchDetail('owner/app', async (query, variables) => {
    calls.push(variables);
    if (query.includes('licenseInfo')) return { repository: { name: 'app', nameWithOwner: 'owner/app', defaultBranchRef: { name: 'main', target: { oid: 'abc', history: { totalCount: 42 } } } } };
    if (query.includes('$root:')) return { repository: { root: { entries: [{ name: 'README.md', type: 'blob' }] }, docs: { entries: [{ name: 'README.zh-CN.md', type: 'blob' }] } } };
    return { repository: { object: { text: '# 中文', isBinary: false } } };
  });
  assert.equal(result.commitCount, 42);
  assert.deepEqual(result.readme, { path: 'docs/README.zh-CN.md', ref: 'abc', markdown: '# 中文' });
  assert.equal(calls[2].expression, 'abc:docs/README.zh-CN.md');
});

test('inaccessible repositories fail explicitly', async () => {
  await assert.rejects(fetchDetail('owner/missing', async () => ({ repository: null })), /unavailable/);
  await assert.rejects(fetchDetail('owner/private', async () => ({ repository: { isPrivate: true } })), /unavailable/);
});
