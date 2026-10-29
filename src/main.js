import './main.css';
import { marked } from 'marked';

const TITLES = {
  home: '主页',
  repo: '仓库',
  me: '我的',
};

function parseHash() {
  const tab = location.hash.replace(/^#\/?/, '');
  return Object.hasOwn(TITLES, tab) ? tab : 'home';
}

function apply() {
  const tab = parseHash();

  // 视图切换
  document.querySelectorAll('main > section[data-tab]').forEach((s) => {
    s.classList.toggle('hidden', s.dataset.tab !== tab);
  });

  // 底栏选中态：图标放大变品牌蓝，标签同色；未选中浅灰
  document.querySelectorAll('#bottom-nav [data-tab-link]').forEach((a) => {
    const active = a.dataset.tabLink === tab;
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
    const icon = a.querySelector('.md-icon');
    icon.classList.toggle('nav-icon--active', active);
    const label = a.querySelector('span');
    label.classList.toggle('text-s-blue-300', active);
    label.classList.toggle('text-s-grey-600', !active);
  });

  document.getElementById('appbar-title').textContent = TITLES[tab];
}

window.addEventListener('hashchange', apply);
apply();

// ── 主页数据加载：CDN 与 Actions 缓存互相独立，默认使用缓存 ──
const GH_USER_API = 'https://api.github.com/users/bexino';
const README_MIRRORS = [
  'https://gcore.jsdelivr.net/gh/bexino/bexino@main/README.zh-CN.md',
  'https://testingcf.jsdelivr.net/gh/bexino/bexino@main/README.zh-CN.md',
];
const CACHE_DIR = './cache/';
// 徽章镜像：ghstats.dev 在部分网络下不可达，改用 GitHub Action 抓取后托管在本站的副本
const BADGE_DIR = './cache/badges/';
// 单次数据请求的时间预算；失败时不切换数据来源。
const LOAD_TIMEOUT_MS = 3000;

// fetch 超时包装：AbortController + 计时器
async function fetchWithTimeout(url, timeoutMs, headers) {
  if (timeoutMs <= 0) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers, cache: 'no-store' });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// 依次请求直到成功；全部失败或耗尽截止时间返回 null
async function fetchFirst(urls, deadline) {
  for (const url of urls) {
    const remain = deadline - Date.now();
    if (remain <= 0) return null;
    const text = await fetchWithTimeout(url, remain);
    if (text !== null) return text;
  }
  return null;
}

// 渲染 GitHub 个人信息卡片
function renderProfile(p) {
  document.getElementById('gh-name').textContent = p.name || p.login || '—';
  const loginEl = document.getElementById('gh-login');
  loginEl.textContent = `@${p.login || 'bexino'}`;
  loginEl.href = `https://github.com/${p.login || 'bexino'}`;
  document.getElementById('gh-bio').textContent = p.bio || '';
  const img = document.getElementById('gh-avatar');
  const fallback = document.getElementById('gh-avatar-fallback');
  if (p.avatar_url) {
    img.src = p.avatar_url;
    img.alt = p.name || p.login || '';
    img.hidden = false;
    fallback.hidden = true;
  }
}

// 徽章改写：ghstats.dev 的图片地址 → 本站托管的副本（Action 抓取）。
// 命名规则与 scripts/fetch-home-data.mjs 一致：<metric>.svg 或 <metric>-<label的sha1前8位>.svg
// 文件名只用 ASCII —— label 常含中文，百分号编码后会被部分服务器误解码成路径分隔符。
function rewriteBadgeUrl(url) {
  const m = url.match(/^https?:\/\/ghstats\.dev\/api\/mini\?(.*)$/);
  if (!m) return url;
  let metric;
  let label;
  try {
    const params = new URLSearchParams(m[1]);
    metric = params.get('metric');
    label = params.get('label');
  } catch {
    return url;
  }
  if (!metric) return url;
  const name = label ? `${metric}-${sha1Hex(label).slice(0, 8)}` : metric;
  return `${BADGE_DIR}${name}.svg`;
}

// 同步 SHA-1（与 Node 的 createHash('sha1') 结果一致），用于生成徽章文件名
function sha1Hex(str) {
  const utf8 = new TextEncoder().encode(str);
  const ml = utf8.length;
  const withPad = new Uint8Array((((ml + 8) >> 6) + 1) * 64);
  withPad.set(utf8);
  withPad[ml] = 0x80;
  const view = new DataView(withPad.buffer);
  view.setUint32(withPad.length - 4, ml * 8, false);

  const H = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const w = new Uint32Array(80);
  for (let off = 0; off < withPad.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
    for (let i = 16; i < 80; i++) {
      const v = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (v << 1) | (v >>> 31);
    }
    let a = H[0];
    let b = H[1];
    let c = H[2];
    let d = H[3];
    let e = H[4];
    for (let i = 0; i < 80; i++) {
      let f;
      let k;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const tmp = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = tmp;
    }
    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
  }
  return H.map((h) => h.toString(16).padStart(8, '0')).join('');
}

// 渲染 README：CDN 模式使用原始徽章，其余模式使用 Actions 副本。
// GitHub 严格换行：单换行不换行，行尾两空格才换行；链接统一新窗口打开。
function renderReadme(md, mode) {
  // 去掉缓存文件首行的 fetchedAt 注释（不进入渲染）
  const cleaned = md.replace(/^<!--\s*fetchedAt:.*?-->\s*/, '');
  const html = marked.parse(cleaned, { breaks: false, gfm: true });
  const body = document.getElementById('readme-body');
  body.innerHTML = html;
  const badgeVersion = Date.now();
  body.querySelectorAll('img[src]').forEach((img) => {
    if (mode !== 'cdn') {
      const badgeUrl = rewriteBadgeUrl(img.src);
      // 手动查看缓存时也刷新徽章，避免浏览器沿用上次部署的图片。
      img.src = mode === 'cache' && badgeUrl.startsWith(BADGE_DIR)
        ? `${badgeUrl}?v=${badgeVersion}`
        : badgeUrl;
    }
    img.loading = 'lazy';
    img.onerror = () => {
      // 副本也没有 → 隐藏破图
      img.style.display = 'none';
    };
  });
  body.querySelectorAll('a[href]').forEach((a) => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener');
  });
}

// 加载完成 → 展示内容、隐藏转圈
function showHomeContent() {
  document.getElementById('home-loading').classList.add('hidden');
  document.getElementById('home-content').classList.remove('hidden');
}

// 每次切换重新请求；过期请求完成后不能覆盖新模式。
let homeLoadId = 0;

async function loadHomeData(mode = 'cache') {
  const loadId = ++homeLoadId;
  document.getElementById('home-loading').classList.remove('hidden');
  document.getElementById('home-content').classList.add('hidden');
  document.getElementById('home-content').setAttribute('aria-busy', 'true');

  const deadline = Date.now() + LOAD_TIMEOUT_MS;
  const [profileText, readmeText] = await Promise.all(mode === 'cdn' ? [
    fetchFirst([GH_USER_API], deadline),
    fetchFirst(README_MIRRORS, deadline),
  ] : [
    fetchWithTimeout(`${CACHE_DIR}github-user.json`, LOAD_TIMEOUT_MS),
    fetchWithTimeout(`${CACHE_DIR}readme-zh.md`, LOAD_TIMEOUT_MS),
  ]);
  if (loadId !== homeLoadId) return;

  // 清空旧模式的数据，单一来源失败时也不会残留其它来源的内容。
  document.getElementById('gh-name').textContent = '—';
  document.getElementById('gh-login').textContent = '';
  document.getElementById('gh-bio').textContent = '';
  const avatar = document.getElementById('gh-avatar');
  avatar.hidden = true;
  avatar.removeAttribute('src');
  document.getElementById('gh-avatar-fallback').hidden = false;
  document.getElementById('readme-body').replaceChildren();

  if (profileText) {
    let obj = null;
    try {
      obj = JSON.parse(profileText);
    } catch {
      obj = null;
    }
    if (obj && obj.fetchedAt && obj.profile) {
      obj = obj.profile;
    }
    if (obj) {
      renderProfile(obj);
    }
  }

  if (readmeText) {
    renderReadme(readmeText, mode);
  }

  document.getElementById('home-content').setAttribute('aria-busy', 'false');
  showHomeContent();
}

const sourceControl = document.getElementById('home-data-source');
let homeSource;

function syncHomeSource() {
  const mode = new URL(location.href).searchParams.get('source') === 'cdn' ? 'cdn' : 'cache';
  sourceControl.querySelectorAll('input[name="data-source"]').forEach((input) => {
    input.checked = input.value === mode;
  });
  if (mode === homeSource) return;
  homeSource = mode;
  loadHomeData(mode);
}

sourceControl.addEventListener('change', (event) => {
  if (event.target.matches('input[name="data-source"]')) {
    const url = new URL(location.href);
    if (event.target.value === 'cdn') url.searchParams.set('source', 'cdn');
    else url.searchParams.delete('source');
    history.pushState(null, '', url);
    syncHomeSource();
  }
});

window.addEventListener('popstate', syncHomeSource);
syncHomeSource();
