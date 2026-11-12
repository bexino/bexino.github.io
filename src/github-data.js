// Direct mode never reuses response data or falls back to the Actions cache.
export function dataSource(url = location.href) {
  const source = new URL(url).searchParams.get('source');
  return ['cdn', 'direct'].includes(source) ? source : 'cache';
}

export async function githubRequest(path, { raw = false, missing = false, empty = false } = {}) {
  const response = await fetch(`https://api.github.com/${path}`, {
    cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json' },
  });
  if ((missing && response.status === 404) || (empty && response.status === 409)) return null;
  if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
  return raw ? response.text() : { data: await response.json(), link: response.headers.get('link') };
}

const repoPath = fullName => `repos/${fullName.split('/').map(encodeURIComponent).join('/')}`;

export async function directSummary(fullName) {
  const { data } = await githubRequest(repoPath(fullName));
  return {
    name: data.name, fullName: data.full_name, description: data.description,
    url: data.html_url, homepageUrl: data.homepage || null,
    defaultBranch: data.default_branch,
    license: data.license ? { name: data.license.name, spdxId: data.license.spdx_id, url: data.license.url } : null,
  };
}

export async function directDetail(fullName, language) {
  const base = repoPath(fullName);
  const [repo, commits, releases] = await Promise.all([
    directSummary(fullName),
    githubRequest(`${base}/commits?per_page=1`, { empty: true }),
    githubRequest(`${base}/releases?per_page=1`),
  ]);
  const last = commits?.link?.split(',').find(part => /rel="last"/.test(part));
  const commitCount = last ? Number(new URL(last.match(/<([^>]+)>/)[1]).searchParams.get('page')) : commits?.data.length || 0;
  const ref = commits?.data[0]?.sha;
  let readme = null;
  if (ref) {
    const query = `?ref=${encodeURIComponent(ref)}`;
    // Match the cache generator's language and directory priorities.
    const directories = await Promise.all(['', 'docs', '.github'].map(async directory => {
      const result = await githubRequest(`${base}/contents/${directory}${query}`, { missing: true });
      return Array.isArray(result?.data) ? result.data.filter(entry => entry.type === 'file') : [];
    }));
    const filenames = language === 'en'
      ? [['readme.en.md', 'readme.en-us.md'], ['readme.md', 'readme.markdown', 'readme']]
      : [['readme.zh-cn.md'], ['readme.md', 'readme.markdown', 'readme']];
    let entry;
    for (const group of filenames) {
      for (const entries of directories) {
        for (const filename of group) {
          entry = entries.find(item => item.name.toLowerCase() === filename);
          if (entry) break;
        }
        if (entry) break;
      }
      if (entry) break;
    }
    if (entry) {
      const path = entry.path.split('/').map(encodeURIComponent).join('/');
      readme = { path: entry.path, ref, markdown: await githubRequest(`${base}/contents/${path}${query}`, { raw: true }) };
    }
  }
  return { ...repo, commitCount, hasReleases: releases.data.length > 0, readme, readmeEn: readme };
}
