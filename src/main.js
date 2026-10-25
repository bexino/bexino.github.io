import './main.css';
import { marked } from 'marked';

const TITLES = {
  home: '主页',
  repo: '仓库',
  pt: '提示词',
  sched: '智能排班',
  me: '我的',
};
// iframe 页不显示自有 App Bar
const IFRAME_TABS = new Set(['pt', 'sched']);

// 两个子站的 origin 白名单（安全：防止恶意 u= 参数造成 open-redirect / 钓鱼）
const CHILD_ORIGINS = {
  pt: 'https://pt.bexino.dpdns.org',
  sched: 'https://sched.bexino.dpdns.org',
};

// iframe 页地址同步：地址栏形如 #/pt?u=<encodeURIComponent(完整子站 URL)>
// 子站 embed-report.js 把地址变化 postMessage 上来，实时回写地址栏；
// 打开带 u= 的链接时还原成 iframe src，保证复制地址在别处打开同一子页面。
// 子站默认 src 由 index.html 的 data-src 提供，u= 缺失或非法时回退。
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const i = raw.indexOf('?');
  const tab = i === -1 ? raw : raw.slice(0, i);
  const query = i === -1 ? '' : raw.slice(i + 1);
  const u = query ? new URLSearchParams(query).get('u') : null;
  return { tab: tab in TITLES ? tab : 'home', url: u };
}

function encodeHash(tab, url) {
  const qs = url ? `?u=${encodeURIComponent(url)}` : '';
  return `#/${tab}${qs}`;
}

// 只接受对应子站 origin 的地址
function isSafeChildUrl(url, tab) {
  try {
    return new URL(url).origin === CHILD_ORIGINS[tab];
  } catch {
    return false;
  }
}

// 本地调试：子站的 embed-report.js 只认生产 origin（https://bexino.github.io），
// localhost 下 postMessage 双向丢弃，地址栏永远拿不到 u= 参数。
// 开发时用 vite 反代把子站挂到 /child-pt/ 、/child-sched/，与父页同源，
// 即可直接读子站真实地址（含 ?step= 、# 路由），换算回生产地址写进 u=。
const IS_LOCAL_DEV = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

// 生产地址 ⇄ 本地反代地址
function toProdUrl(devUrl, tab) {
  try {
    const u = new URL(devUrl, location.href);
    const path = u.pathname.replace(/^\/child-(pt|sched)\/?/, '/') || '/';
    return `${CHILD_ORIGINS[tab]}${path}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

function toDevUrl(prodUrl, tab) {
  try {
    const u = new URL(prodUrl);
    const path = u.pathname === '/' ? '/' : u.pathname;
    return `/child-${tab}${path}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

function iframeOf(tab) {
  return document.querySelector(`section[data-tab="${tab}"] iframe`);
}

function apply() {
  const { tab, url } = parseHash();

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

  // App Bar：iframe 页隐藏
  document.getElementById('appbar').classList.toggle('hidden', IFRAME_TABS.has(tab));
  document.getElementById('appbar-title').textContent = TITLES[tab];

  // iframe src：深度链接 u= 优先（校验 origin），否则回默认页
  if (IFRAME_TABS.has(tab)) {
    const iframe = iframeOf(tab);
    const prod = url && isSafeChildUrl(url, tab) ? url : iframe.dataset.src;
    // 本地开发：改用 vite 反代地址（与父页同源），生产地址映射到 /child-*/
    const target = IS_LOCAL_DEV ? toDevUrl(prod, tab) : prod;
    if (iframe.src !== new URL(target, location.href).href) iframe.src = target;
  }
}

window.addEventListener('hashchange', apply);

// 子站上报：iframe 内地址变化 → 编码进地址栏。
// replaceState 不触发 hashchange，不会回到 apply 形成回环。
window.addEventListener('message', (e) => {
  const tab = Object.keys(CHILD_ORIGINS).find((t) => CHILD_ORIGINS[t] === e.origin);
  if (!tab || e.data?.source !== 'bexino-hub') return;
  if (!isSafeChildUrl(e.data.url, tab)) return;
  // 该子站 iframe 未在当前视图时忽略上报（避免另一 iframe 的初始地址覆盖地址栏）
  if (parseHash().tab !== tab) return;
  history.replaceState(null, '', encodeHash(tab, e.data.url));
});

apply();

// 本地开发：子站与父页同源（vite 反代），直接读 iframe 内的真实地址，
// 换算成生产地址写进 u=，让本地调试也能看到/复制完整的页面参数。
// 生产环境靠子站的 postMessage 上报即可，无需此段。
if (IS_LOCAL_DEV) {
  const syncFromChild = (tab) => {
    if (parseHash().tab !== tab) return;
    const iframe = iframeOf(tab);
    let childUrl;
    try {
      childUrl = iframe.contentWindow?.location.href;
    } catch {
      return; // 跨域（未走反代）读不到，忽略
    }
    const prod = childUrl && toProdUrl(childUrl, tab);
    if (!prod) return;
    if (parseHash().url !== prod) history.replaceState(null, '', encodeHash(tab, prod));
  };

  for (const tab of IFRAME_TABS) {
    const iframe = iframeOf(tab);
    iframe.addEventListener('load', () => syncFromChild(tab));
    // 子站内部路由变化（hash / replaceState）不会触发父页 load，
    // 轮询子站地址；同源读取很轻量，仅本地开发启用。
    setInterval(() => syncFromChild(tab), 400);
  }
}

// 子站初始上报可能早于本 listener 注册（时序不定）而丢失，
// listener 就绪后向两个 iframe 发 ping，子站收到会补报一次当前地址
for (const tab of IFRAME_TABS) {
  iframeOf(tab).addEventListener('load', () => {
    iframeOf(tab).contentWindow.postMessage({ source: 'bexino-hub-ping' }, CHILD_ORIGINS[tab]);
  });
}

// ── 主页数据加载：GitHub 个人信息 + README.zh-CN.md（实时优先，Action 缓存回退） ──
const GH_USER_API = 'https://api.github.com/users/bexino';
const README_MIRRORS = [
  'https://gcore.jsdelivr.net/gh/bexino/bexino@main/README.zh-CN.md',
  'https://testingcf.jsdelivr.net/gh/bexino/bexino@main/README.zh-CN.md',
];
const CACHE_DIR = './cache/';
// 徽章镜像：ghstats.dev 在部分网络下不可达，改用 GitHub Action 抓取后托管在本站的副本
const BADGE_DIR = './cache/badges/';
// 实时请求总预算：超时后直接回退到本站部署的缓存副本
const LOAD_TIMEOUT_MS = 3000;

// fetch 超时包装：AbortController + 计时器
async function fetchWithTimeout(url, timeoutMs, headers) {
  if (timeoutMs <= 0) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers });
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

// 渲染 README：marked 转 HTML（GitHub 严格换行：单换行不换行，行尾两空格才换行），
// 徽章地址改写到本站副本，链接统一新窗口打开
function renderReadme(md) {
  // 去掉缓存文件首行的 fetchedAt 注释（不进入渲染）
  const cleaned = md.replace(/^<!--\s*fetchedAt:.*?-->\s*/, '');
  const html = marked.parse(cleaned, { breaks: false, gfm: true });
  const body = document.getElementById('readme-body');
  body.innerHTML = html;
  body.querySelectorAll('img[src]').forEach((img) => {
    img.src = rewriteBadgeUrl(img.src);
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

// 状态小字：按实时/回退组合显示
function renderStatus(profileLive, readmeLive, fetchedAt) {
  const el = document.getElementById('home-data-status');
  const time = fetchedAt ? new Date(fetchedAt).toLocaleString('zh-CN') : '';
  let text;
  if (profileLive && readmeLive) {
    text = '您所见的都是实时最新数据';
  } else if (profileLive) {
    text = `简介已于 ${time} 更新，其余为实时最新数据`;
  } else if (readmeLive) {
    text = `个人信息已于 ${time} 更新，其余为实时最新数据`;
  } else {
    text = `所有信息已于 ${time} 更新`;
  }
  el.textContent = text;
}

// 缓存文件的 fetchedAt：md 首行注释 `<!-- fetchedAt: ... -->`
function parseMdFetchedAt(md) {
  const m = md.match(/^<!--\s*fetchedAt:\s*(.+?)\s*-->/);
  return m ? m[1] : null;
}

// 加载完成 → 展示内容、隐藏转圈
function showHomeContent() {
  document.getElementById('home-loading').classList.add('hidden');
  document.getElementById('home-content').classList.remove('hidden');
}

// 主页数据只加载一次
let homeDataLoaded = false;

async function loadHomeData() {
  if (homeDataLoaded) return;
  homeDataLoaded = true;

  // 全局截止时间：实时链与缓存并行，缓存（同源、体积小）几乎瞬时拿到。
  // 两条实时链各自独立计时，避免其中一条慢把另一条饿死。
  const profileDeadline = Date.now() + LOAD_TIMEOUT_MS;
  const readmeDeadline = Date.now() + LOAD_TIMEOUT_MS;
  const [liveProfile, liveReadme, cachedProfile, cachedReadme] = await Promise.all([
    fetchFirst([GH_USER_API], profileDeadline),
    fetchFirst(README_MIRRORS, readmeDeadline),
    fetchWithTimeout(`${CACHE_DIR}github-user.json`, LOAD_TIMEOUT_MS),
    fetchWithTimeout(`${CACHE_DIR}readme-zh.md`, LOAD_TIMEOUT_MS),
  ]);

  // 个人信息：实时失败 → 用缓存
  let profileLive = false;
  let profileFetchedAt = null;
  const profileText = liveProfile || cachedProfile;
  if (profileText) {
    let obj = null;
    try {
      obj = JSON.parse(profileText);
    } catch {
      obj = null;
    }
    if (obj && obj.fetchedAt && obj.profile) {
      profileFetchedAt = obj.fetchedAt; // 缓存 JSON：带抓取时间
      obj = obj.profile;
    }
    if (obj) {
      profileLive = Boolean(liveProfile);
      renderProfile(obj);
    }
  }

  // README：实时失败 → 用缓存
  let readmeLive = false;
  let readmeFetchedAt = null;
  const readmeText = liveReadme || cachedReadme;
  if (readmeText) {
    readmeFetchedAt = parseMdFetchedAt(readmeText);
    readmeLive = Boolean(liveReadme);
    renderReadme(readmeText);
  }

  renderStatus(profileLive, readmeLive, profileFetchedAt || readmeFetchedAt);
  showHomeContent();
}

loadHomeData();
