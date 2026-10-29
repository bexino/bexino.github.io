// 抓取主页所需的 GitHub 数据到 public/cache/：
//   - github-user.json：个人资料（含 fetchedAt）
//   - avatar-<内容指纹>.webp：压缩后的 128×128 头像
//   - readme-zh.md：README.zh-CN.md 原文（首行插入 fetchedAt 注释）
//   - badges/*.svg：README 里 ghstats.dev 徽章的本地副本
//
// 徽章副本存在的原因：ghstats.dev 在部分网络（含中国大陆）不可达，
// 第三方服务不可控；由 GitHub Action（海外 runner）抓取后托管到本站，
// 客户端把 README 里的徽章地址改写到本站副本。
//
// 用法：node scripts/fetch-home-data.mjs

import { mkdir, rm, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = join(ROOT, 'public', 'cache');
const BADGE_DIR = join(CACHE_DIR, 'badges');

const USER_API = 'https://api.github.com/users/bexino';
const README_REPO_API = 'https://api.github.com/repos/bexino/bexino/contents/README.zh-CN.md?ref=main';
// README 原文的备源：raw.githubusercontent 在部分网络不可达
const README_SOURCES = [
  'https://raw.githubusercontent.com/bexino/bexino/main/README.zh-CN.md',
  'https://gcore.jsdelivr.net/gh/bexino/bexino@main/README.zh-CN.md',
  'https://testingcf.jsdelivr.net/gh/bexino/bexino@main/README.zh-CN.md',
];

const GH_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

// 复用 GitHub Action 的凭证；没有时用匿名请求（限流更严，但够用）
function ghHeaders(extra = {}) {
  return {
    'User-Agent': 'bexino-github-io-cache',
    'Accept': 'application/vnd.github+json',
    ...(GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}` } : {}),
    ...extra,
  };
}

async function get(url, { headers = {}, raw = false, timeout = 20000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
    return raw ? Buffer.from(await res.arrayBuffer()) : await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// 徽章文件名规则（必须与 src/main.js 的 rewriteBadgeUrl 严格一致）：
//   <metric>.svg 或 <metric>-<label的sha1前8位>.svg
// 文件名只用 ASCII：label 常含中文，百分号编码后会被部分服务器误解码成路径分隔符
function badgeFileName(url) {
  const m = url.match(/^https?:\/\/ghstats\.dev\/api\/mini\?(.*)$/);
  if (!m) return null;
  let metric;
  let label;
  try {
    const params = new URLSearchParams(m[1]);
    metric = params.get('metric');
    label = params.get('label');
  } catch {
    return null;
  }
  if (!metric) return null;
  const name = label ? `${metric}-${shortHash(label)}` : metric;
  return `${name}.svg`;
}

// label 的短哈希（sha1 前 8 位十六进制），脚本与客户端共用同一实现
function shortHash(str) {
  return createHash('sha1').update(str, 'utf8').digest('hex').slice(0, 8);
}

// 从 README 里找出所有 ghstats.dev 徽章
function findBadges(markdown) {
  const urls = new Set();
  const re = /https?:\/\/ghstats\.dev\/api\/mini\?[^\s)"'<>]+/g;
  for (const m of markdown.matchAll(re)) {
    // 去掉 markdown 里可能粘连的尾部标点
    const url = m[0].replace(/[.,;:]+$/, '');
    if (badgeFileName(url)) urls.add(url);
  }
  return [...urls];
}

// 优先 Contents API，准确获取中文文件，避免分支 CDN 缓存延迟。
async function fetchReadme() {
  try {
    const json = JSON.parse(await get(README_REPO_API, { headers: ghHeaders() }));
    if (json.encoding !== 'base64' || typeof json.content !== 'string' || !json.content.trim()) {
      throw new Error('GitHub API did not return base64 README content');
    }
    console.log(`  readme from GitHub Contents API (blob ${json.sha})`);
    return Buffer.from(json.content, 'base64').toString('utf8');
  } catch (e) {
    console.warn(`  GitHub Contents API failed: ${e.message}`);
  }
  for (const url of README_SOURCES) {
    try {
      // GitHub 凭证只发送给 api.github.com，不发送到镜像或图片服务。
      const text = await get(url);
      if (!text.trim() || /^\s*(?:<!doctype html|<html\b)/i.test(text)) {
        throw new Error('source returned an empty README or HTML error page');
      }
      if (url.includes('jsdelivr.net')) console.warn('  warning: CDN fallback may lag behind GitHub');
      console.log(`  readme from ${url}`);
      return text;
    } catch (e) {
      console.warn(`  readme source failed ${url}: ${e.message}`);
    }
  }
  throw new Error('Unable to fetch README.zh-CN.md from GitHub or any fallback source');
}

// 徽章字节：优先直连 ghstats.dev；不可达时用 GitHub 渲染 README 后的
// camo 快照（GitHub 自己抓到并缓存的同一张图，仍是活数据，只是更新稍慢）
async function fetchBadge(url) {
  try {
    return await get(url, { raw: true });
  } catch (e) {
    console.warn(`  direct failed, trying camo: ${e.message}`);
  }
  // camo 路径第二段是原图 URL 的 hex 编码。GitHub 对非 ASCII 查询参数用百分号编码
  // （UTF-8 字节），因此原文 URL 与百分号编码形态都要试。
  const html = await get(
    README_REPO_API,
    { headers: ghHeaders({ Accept: 'application/vnd.github.html' }) },
  );
  const pct = url.replace(/[^\x21-\x7e]/g, (c) =>
    [...new TextEncoder().encode(c)].map((b) => `%${b.toString(16).toUpperCase().padStart(2, '0')}`).join(''),
  );
  for (const variant of [url, pct]) {
    const hex = Buffer.from(variant, 'utf8').toString('hex');
    const re = new RegExp(`https://camo\\.githubusercontent\\.com/[0-9a-f]{64}/${hex}`, 'i');
    const m = html.match(re);
    if (!m) continue;
    console.log('  badge from camo');
    return await get(m[0], { raw: true });
  }
  throw new Error('camo snapshot not found');
}

async function main() {
  // 每次全量重建主页文件：删除上次的资料、头像、README 和所有徽章，失败也不回用旧数据。
  await mkdir(CACHE_DIR, { recursive: true });
  // Only remove homepage-owned files; repo snapshots have their own lifecycle.
  for (const entry of await readdir(CACHE_DIR)) {
    if (entry === 'github-user.json' || entry === 'readme-zh.md' || entry === 'badges' || /^avatar-[a-f0-9]+\.webp$/.test(entry)) {
      await rm(join(CACHE_DIR, entry), { recursive: true, force: true });
    }
  }
  await mkdir(BADGE_DIR, { recursive: true });
  const fetchedAt = new Date().toISOString();

  // 1. 个人资料
  const user = JSON.parse(await get(USER_API, { headers: ghHeaders() }));
  // 64 CSS px 的头像保留两倍像素；下载时也限制尺寸，减少原图传输。
  // 每次主动刷新上游，产物按内容命名，换头像后不会命中浏览器里的旧副本。
  const avatarUrl = new URL(user.avatar_url);
  avatarUrl.searchParams.set('s', '256');
  avatarUrl.searchParams.set('_refresh', fetchedAt);
  const originalAvatar = await get(avatarUrl.href, { raw: true });
  const avatar = await sharp(originalAvatar)
    .rotate()
    .resize(128, 128, { fit: 'cover' })
    .webp({ quality: 80, effort: 6 })
    .toBuffer();
  const avatarName = `avatar-${createHash('sha256').update(avatar).digest('hex').slice(0, 16)}.webp`;
  await writeFile(join(CACHE_DIR, avatarName), avatar);
  console.log(`✓ ${avatarName}  128×128  ${originalAvatar.length} → ${avatar.length} bytes`);
  await writeFile(
    join(CACHE_DIR, 'github-user.json'),
    `${JSON.stringify(
      {
        fetchedAt,
        profile: {
          login: user.login,
          name: user.name,
          avatar_url: `./cache/${avatarName}`,
          bio: user.bio,
        },
      },
      null,
      2,
    )}\n`,
  );
  console.log(`✓ github-user.json  ${user.login}`);

  // 2. README 原文（首行插入 fetchedAt 注释，客户端据此判断是否为缓存）
  const markdown = await fetchReadme();
  await writeFile(join(CACHE_DIR, 'readme-zh.md'), `<!-- fetchedAt: ${fetchedAt} -->\n${markdown}`);
  console.log(`✓ readme-zh.md      ${markdown.length} bytes`);

  // 3. 徽章副本（失败不阻断整体流程）
  const badges = findBadges(markdown);
  let ok = 0;
  for (const url of badges) {
    const name = badgeFileName(url);
    try {
      const buf = await fetchBadge(url);
      await writeFile(join(BADGE_DIR, name), buf);
      ok++;
      console.log(`✓ badge ${name}`);
    } catch (e) {
      console.warn(`✗ badge ${name}: ${e.message}`);
    }
  }
  console.log(`badges: ${ok}/${badges.length}`);
  console.log(`Cache written to ${CACHE_DIR}`);
  console.log('Refresh the local dev page, or build and deploy this website to publish the snapshot.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
