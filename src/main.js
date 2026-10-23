import './main.css';

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
  const [tab, query] = raw.split('?');
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
    const target = url && isSafeChildUrl(url, tab) ? url : iframe.dataset.src;
    if (iframe.src !== target) iframe.src = target;
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
