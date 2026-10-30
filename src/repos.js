import { t, getLanguage } from './i18n.js';
import { renderMarkdown } from './markdown.js';
import { mountRepoOutline } from './repo-outline.js';
import { dataSource, directSummary, directDetail } from './github-data.js';

const content = document.getElementById('repo-content');
const categories = document.getElementById('repo-categories');
const scroll = document.getElementById('repo-scroll');
const back = document.getElementById('repo-back');
const github = document.getElementById('repo-github-link');
const shell = document.querySelector('.repo-shell');
const positions = new Map();
const details = new Map();
let indexPromise;
let generation = 0;
let currentList = null;
let selectedRepo = null;
let clearOutline;

// Align both app-bar actions with the detail columns, including intrinsic width changes.
const appbarContent = back.parentElement.parentElement;
function alignActions() {
  const card = content.querySelector('.repo-profile > .repo-summary');
  if (!card || back.hidden) return;
  const left = card.getBoundingClientRect().left - appbarContent.getBoundingClientRect().left;
  back.style.setProperty('--repo-back-left', `${left}px`);
  const readme = content.querySelector('.repo-readme-body');
  if (readme && !github.hidden) {
    const right = appbarContent.getBoundingClientRect().right - readme.getBoundingClientRect().right;
    github.style.setProperty('--repo-github-right', `${right}px`);
  }
}
const layoutObserver = new ResizeObserver(alignActions);
layoutObserver.observe(shell);
layoutObserver.observe(appbarContent);

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function icon(name) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  node.classList.add('md-icon');
  node.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `./icons-sprite.svg#si-${name}`);
  node.append(use);
  return node;
}
const categoryUrl = slug => `#/repo/${encodeURIComponent(slug)}`;
const detailUrl = (slug, name) => `${categoryUrl(slug)}/${name.split('/').map(encodeURIComponent).join('/')}`;

async function loadJson(path) {
  const response = await fetch(`./cache/repos/${path}`, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
  if (!response.ok) throw new Error(t('缓存暂不可用'));
  return response.json();
}
function loadIndex() {
  return indexPromise ||= loadJson('index.json').then(data => {
    if (!Array.isArray(data.categories) || !data.repositories) throw new Error(t('缓存格式无效'));
    return data;
  }).catch(error => { indexPromise = null; throw error; });
}
function loadDetail(fullName) {
  if (dataSource() === 'direct') return directDetail(fullName, getLanguage());
  if (!details.has(fullName)) {
    details.set(fullName, loadJson(`${fullName.split('/').map(encodeURIComponent).join('/')}.json`).then(data => {
      if (data.fullName !== fullName || typeof data.name !== 'string') throw new Error(t('详情缓存无效'));
      return data;
    }).catch(error => { details.delete(fullName); throw error; }));
  }
  return details.get(fullName);
}
function message(title, description, retry = false, returnUrl) {
  shell.classList.remove('repo-shell--detail');
  const box = element('div', 'repo-state');
  box.append(element('p', 'text-s-16 font-bold text-s-grey-800', title), element('p', 'text-s-14 text-s-text-desc', description));
  if (retry) {
    const button = element('button', 'repo-button', t('重试'));
    button.addEventListener('click', () => renderRepos());
    box.append(button);
  }
  if (returnUrl) {
    const link = element('a', 'repo-button', t('返回仓库分类'));
    link.href = returnUrl;
    box.append(link);
  }
  content.replaceChildren(box);
}
function saveList() {
  if (currentList) positions.set(currentList, { top: scroll.scrollTop, repo: selectedRepo });
  currentList = null;
}
export function leaveRepos() {
  github.hidden = true;
  github.removeAttribute('href');
  clearOutline?.();
  clearOutline = null;
  saveList();
  generation++;
}

function renderCategories(data, slug) {
  const tabs = element('div', 'repo-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', t('仓库分类'));
  for (const category of data.categories) {
    const tab = element('button', 'repo-tab', t(category.name));
    tab.id = `category-${category.slug}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', 'repo-content');
    tab.setAttribute('aria-selected', String(category.slug === slug));
    tab.tabIndex = category.slug === slug ? 0 : -1;
    tab.addEventListener('click', () => { location.hash = categoryUrl(category.slug); });
    tabs.append(tab);
  }
  tabs.addEventListener('keydown', event => {
    const buttons = [...tabs.children];
    const index = buttons.indexOf(document.activeElement);
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else return;
    event.preventDefault();
    buttons[next]?.focus();
    buttons[next]?.click();
  });
  const hadFocus = categories.contains(document.activeElement);
  categories.replaceChildren(tabs);
  const active = tabs.querySelector('[aria-selected="true"]');
  if (hadFocus) active?.focus({ preventScroll: true });
  if (active) categories.scrollLeft = Math.max(0, active.offsetLeft - categories.clientWidth / 2 + active.clientWidth / 2);
}

function showList(data, category) {
  content.setAttribute('role', 'tabpanel');
  content.setAttribute('aria-labelledby', `category-${category.slug}`);
  currentList = category.slug;
  selectedRepo = null;
  if (!category.repositories.length) {
    message(t('暂无仓库'), t('这个分类还没有公开仓库。'));
    return;
  }
  const list = element('div', 'repo-list');
  for (const fullName of category.repositories) {
    const repo = data.repositories[fullName];
    if (!repo) continue;
    const row = element('a', 'repo-row s-list-item');
    row.href = detailUrl(category.slug, fullName);
    row.dataset.repository = fullName;
    const text = element('div', 'min-w-0 flex-1');
    text.append(element('h2', 'repo-name', repo.name), element('p', 'repo-description', t(repo.description) || t('暂无简介')));
    row.append(text, icon('chevron_right'));
    row.addEventListener('click', () => { selectedRepo = fullName; });
    list.append(row);
  }
  content.replaceChildren(list);
  const saved = positions.get(category.slug);
  scroll.scrollTop = saved?.top || 0;
  if (saved?.repo) {
    const row = [...list.children].find(row => row.dataset.repository === saved.repo);
    row?.focus({ preventScroll: true });
  }
}

function showDetail(repo) {
  layoutObserver.disconnect();
  layoutObserver.observe(shell);
  layoutObserver.observe(appbarContent);
  const card = element('article', 'repo-summary');
  card.append(element('h1', 'repo-meta-title', repo.name), element('p', 'repo-summary-description', t(repo.description) || t('暂无简介')));
  const metaCard = element('section', 'repo-meta-card');
  const metaTitle = element('h2', 'repo-meta-title', t('仓库信息'));
  metaTitle.id = 'repo-meta-title';
  metaCard.setAttribute('aria-labelledby', metaTitle.id);
  const meta = element('dl', 'repo-meta');
  const entries = [[t('许可证'), repo.license?.spdxId && repo.license.spdxId !== 'NOASSERTION' ? repo.license.spdxId : repo.license?.name || t('保留所有权利'), 'balance'], ['Commits', String(repo.commitCount), 'commit']];
  for (const [label, value, glyph] of entries) {
    const item = element('div', 'repo-stat');
    const term = element('dt', 'repo-stat-label', label);
    term.prepend(icon(glyph));
    const description = element('dd', 'repo-stat-value', value);
    description.title = value;
    item.append(term, description);
    meta.append(item);
  }
  const action = element('div', 'repo-action');
  const outline = element('button', 'repo-outline-trigger repo-github');
  outline.type = 'button';
  outline.append(icon('format_list_bulleted'), element('span', '', t('目录')));
  github.href = `https://github.com/${repo.fullName}`;
  github.hidden = false;
  action.append(outline);
  if (repo.hasReleases) {
    const download = element('a', 'repo-github');
    download.append(icon('download'), element('span', '', t('下载')));
    download.href = `https://github.com/${repo.fullName}/releases`;
    download.target = '_blank';
    download.rel = 'noopener noreferrer';
    action.append(download);
  }
  let website;
  try { website = new URL(repo.homepageUrl); } catch { /* Missing or invalid Website. */ }
  if (website && ['https:', 'http:'].includes(website.protocol)) {
    const demo = element('a', 'repo-github');
    demo.append(icon('public'), element('span', '', t('在线体验')));
    demo.href = website.href;
    demo.target = '_blank';
    demo.rel = 'noopener noreferrer';
    action.append(demo);
  }
  metaCard.append(metaTitle, meta, action);
  const profile = element('div', 'repo-profile');
  profile.append(card, metaCard);
  const readmeColumn = element('div', 'repo-readme-column');
  const readme = element('div', 'repo-readme-body flex min-w-0 flex-col gap-3');
  readmeColumn.append(readme);
  content.replaceChildren(profile, readmeColumn);
  shell.classList.add('repo-shell--detail');
  layoutObserver.observe(card);
  layoutObserver.observe(readme);
  alignActions();
  const readmeDocument = getLanguage() === 'en' ? repo.readmeEn : repo.readme;
  if (readmeDocument) renderMarkdown(readme, readmeDocument.markdown, { repository: repo.fullName, readmePath: readmeDocument.path, ref: readmeDocument.ref, splitAtRules: false });
  else readme.append(element('p', 'repo-summary text-s-14 text-s-text-desc', t('暂无自述文件')));
  scroll.scrollTop = 0;
  clearOutline = mountRepoOutline(outline, readme, readmeColumn, scroll);
}

export async function renderRepos() {
  github.hidden = true;
  github.removeAttribute('href');
  clearOutline?.();
  clearOutline = null;
  saveList();
  const id = ++generation;
  content.setAttribute('aria-busy', 'true');
  content.removeAttribute('role');
  content.removeAttribute('aria-labelledby');
  let parts;
  try { parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent); }
  catch { message(t('地址无效'), t('无法解析仓库地址。'), false, '#/repo'); content.setAttribute('aria-busy', 'false'); return; }
  const [, slug, owner, name] = parts;
  const isDetail = parts.length === 4;
  categories.hidden = isDetail;
  if (isDetail) {
    back.hidden = false;
    back.href = categoryUrl(slug);
  }
  const direct = dataSource() === 'direct';
  message(t('加载中…'), t(direct ? '正在连接 GitHub' : '正在读取仓库缓存'));
  try {
    const data = await loadIndex();
    if (id !== generation) return;
    let category = data.categories.find(category => category.slug === slug);
    // Keep the default entry usable if GitHub spells the list slug differently.
    if (!category && slug === 'web-and-agent' && [2, 4].includes(parts.length)) {
      category = data.categories.find(category => category.name.toLowerCase().trim() === 'web & agent');
      if (category) {
        const hash = isDetail ? detailUrl(category.slug, `${owner}/${name}`) : categoryUrl(category.slug);
        history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
        return renderRepos();
      }
    }
    if (!category || ![2, 4].includes(parts.length)) {
      categories.hidden = false;
      renderCategories(data, slug);
      message(t('分类不存在'), t('请选择上方分类，或返回默认分类。'), false, '#/repo');
      return;
    }
    if (!isDetail) {
      renderCategories(data, slug);
      // GitHub Lists have no unauthenticated public endpoint; only membership
      // comes from the index cache. Fetch displayed metadata directly.
      const repositories = direct ? Object.fromEntries(await Promise.all(category.repositories.map(async fullName => [fullName, await directSummary(fullName)]))) : data.repositories;
      if (id !== generation) return;
      showList({ ...data, repositories }, category);
      return;
    }
    const fullName = `${owner}/${name}`;
    if (!category.repositories.includes(fullName)) {
      message(t('仓库不存在'), t('该仓库不在当前分类中。'), false, categoryUrl(slug));
      return;
    }
    const repo = await loadDetail(fullName);
    if (id !== generation) return;
    document.getElementById('appbar-title').textContent = repo.name;
    showDetail(repo);
  } catch {
    if (id === generation) message(t('暂时无法加载'), t(direct ? 'GitHub 请求失败或已达到访问频率限制，请稍后重试。' : '仓库缓存尚未生成或读取失败，请稍后重试。'), true, isDetail ? categoryUrl(slug) : undefined);
  } finally {
    if (id === generation) content.setAttribute('aria-busy', 'false');
  }
}
