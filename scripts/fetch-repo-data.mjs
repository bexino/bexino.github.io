import { mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';

const OUTPUT = fileURLToPath(new URL('../public/cache/repos/', import.meta.url));

export async function graphql(query, variables, token, request = fetch) {
  const response = await request('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`GitHub GraphQL HTTP ${response.status}`);
  const result = await response.json();
  if (result.errors?.length) throw new Error(result.errors.map(e => e.message).join('; '));
  if (!result.data) throw new Error('GitHub GraphQL returned no data');
  return result.data;
}

export async function paginate(readPage) {
  const nodes = [];
  let after = null;
  do {
    const page = await readPage(after);
    if (!page || !Array.isArray(page.nodes) || !page.pageInfo) throw new Error('Incomplete connection');
    nodes.push(...page.nodes.filter(Boolean));
    if (!page.pageInfo.hasNextPage) return nodes;
    if (!page.pageInfo.endCursor || page.pageInfo.endCursor === after) throw new Error('Invalid pagination cursor');
    after = page.pageInfo.endCursor;
  } while (true);
}

export function selectReadme(entries, language = 'zh-CN') {
  for (const filenames of (language === 'en' ? [['readme.en.md', 'readme.en-us.md'], ['readme.md', 'readme.markdown', 'readme']] : [['readme.zh-cn.md'], ['readme.md', 'readme.markdown', 'readme']])) {
    for (const directory of ['', 'docs/', '.github/']) {
      for (const filename of filenames) {
        const match = entries.find(e => e.type === 'blob' && e.path.toLowerCase() === directory + filename);
        if (match) return match.path;
      }
    }
  }
  return null;
}

export async function collectRepos(run) {
  const lists = await paginate(async after => (await run(`query($after:String){user(login:"bexino"){lists(first:100,after:$after){nodes{id name slug isPrivate} pageInfo{hasNextPage endCursor}}}}`, { after })).user?.lists);
  const repositories = new Map();
  const categories = [];
  for (const list of lists.filter(list => !list.isPrivate)) {
    const items = await paginate(async after => (await run(`query($id:ID!,$after:String){node(id:$id){... on UserList{items(first:100,after:$after){nodes{... on Repository{name nameWithOwner description isPrivate}} pageInfo{hasNextPage endCursor}}}}}`, { id: list.id, after })).node?.items);
    const visible = items.filter(repo => repo.nameWithOwner && !repo.isPrivate);
    visible.forEach(repo => repositories.set(repo.nameWithOwner, { name: repo.name, fullName: repo.nameWithOwner, description: repo.description }));
    categories.push({ id: list.id, name: list.name, slug: list.slug, repositories: [...new Set(visible.map(repo => repo.nameWithOwner))] });
  }
  return { categories, repositories };
}

export async function fetchDetail(fullName, run) {
  const [owner, name] = fullName.split('/');
  const data = await run(`query($owner:String!,$name:String!){repository(owner:$owner,name:$name){name nameWithOwner description url homepageUrl isPrivate licenseInfo{name spdxId url} defaultBranchRef{name target{... on Commit{oid history{totalCount}}}}}}`, { owner, name });
  const repo = data.repository;
  if (!repo || repo.isPrivate) throw new Error(`Repository unavailable: ${fullName}`);
  const ref = repo.defaultBranchRef?.target?.oid;
  let path = null;
  let englishPath = null;
  if (ref) {
    const trees = (await run(`query($owner:String!,$name:String!,$root:String!,$docs:String!,$github:String!){repository(owner:$owner,name:$name){root:object(expression:$root){... on Tree{entries{name type}}} docs:object(expression:$docs){... on Tree{entries{name type}}} github:object(expression:$github){... on Tree{entries{name type}}}}}`, { owner, name, root: `${ref}:`, docs: `${ref}:docs`, github: `${ref}:.github` })).repository;
    if (!trees?.root) throw new Error(`Repository tree unavailable: ${fullName}`);
    const entries = [['', trees.root], ['docs/', trees.docs], ['.github/', trees.github]].flatMap(([prefix, tree]) => (tree?.entries || []).map(e => ({ ...e, path: prefix + e.name })));
    path = selectReadme(entries);
    englishPath = selectReadme(entries, 'en');
  }
  let readme = null;
  if (path && ref) {
    const result = await run(`query($owner:String!,$name:String!,$expression:String!){repository(owner:$owner,name:$name){object(expression:$expression){... on Blob{text isBinary}}}}`, { owner, name, expression: `${ref}:${path}` });
    const blob = result.repository?.object;
    if (!blob || blob.isBinary || typeof blob.text !== 'string') throw new Error(`README unavailable: ${fullName}/${path}`);
    readme = { path, ref, markdown: blob.text };
  }
  let readmeEn = readme?.path === englishPath ? readme : null;
  if (englishPath && ref && !readmeEn) {
    const result = await run(`query($owner:String!,$name:String!,$expression:String!){repository(owner:$owner,name:$name){object(expression:$expression){... on Blob{text isBinary}}}}`, { owner, name, expression: `${ref}:${englishPath}` });
    const blob = result.repository?.object;
    if (!blob || blob.isBinary || typeof blob.text !== 'string') throw new Error(`README unavailable: ${fullName}/${englishPath}`);
    readmeEn = { path: englishPath, ref, markdown: blob.text };
  }
  return { name: repo.name, fullName: repo.nameWithOwner, description: repo.description, url: repo.url, homepageUrl: repo.homepageUrl || null, license: repo.licenseInfo, defaultBranch: repo.defaultBranchRef?.name || null, commitCount: repo.defaultBranchRef?.target?.history?.totalCount ?? 0, readme, readmeEn };
}

export async function main({ token = process.env.GH_TOKEN, output = OUTPUT, run } = {}) {
  if (!token && !run) throw new Error('GH_TOKEN is required; no cache was changed');
  const resolved = resolve(output);
  if (resolved !== resolve(OUTPUT)) throw new Error('Unexpected cache directory');
  await rm(resolved, { recursive: true, force: true });
  await mkdir(resolved, { recursive: true });
  run ||= (query, variables) => graphql(query, variables, token);
  const fetchedAt = new Date().toISOString();
  const { categories, repositories } = await collectRepos(run);
  for (const fullName of repositories.keys()) {
    const detail = await fetchDetail(fullName, run);
    const file = join(resolved, ...fullName.split('/')) + '.json';
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ fetchedAt, ...detail }, null, 2) + '\n');
    console.log(`Cached ${fullName}`);
  }
  // Publish the index only when every detail has been fetched successfully.
  await writeFile(join(resolved, 'index.json'), JSON.stringify({ fetchedAt, categories, repositories: Object.fromEntries(repositories) }, null, 2) + '\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
