import { renderMarkdown } from './markdown.js';
import { mountRepoOutline } from './repo-outline.js';

const content = document.getElementById('repo-content');
const categories = document.getElementById('repo-categories');
const scroll = document.getElementById('repo-scroll');
const back = document.getElementById('repo-back');
const shell = document.querySelector('.repo-shell');
const positions = new Map();
const details = new Map();
let indexPromise;
let generation = 0;
let currentList = null;
let selectedRepo = null;
let clearOutline;

// Keep the app-bar action on the summary card's edge, including intrinsic width changes.
const appbarContent = back.parentElement.parentElement;
function alignBack() {
  const card = content.querySelector('.repo-profile > .repo-summary');
  if (!card || back.hidden) return;
  const left = card.getBoundingClientRect().left - appbarContent.getBoundingClientRect().left;
  back.style.setProperty('--repo-back-left', `${left}px`);
}
const layoutObserver = new ResizeObserver(alignBack);
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
  if (!response.ok) throw new Error('缓存暂不可用');
  return response.json();
}
function loadIndex() {
  return indexPromise ||= loadJson('index.json').then(data => {
    if (!Array.isArray(data.categories) || !data.repositories) throw new Error('缓存格式无效');
    return data;
  }).catch(error => { indexPromise = null; throw error; });
}
function loadDetail(fullName) {
  if (!details.has(fullName)) {
    details.set(fullName, loadJson(`${fullName.split('/').map(encodeURIComponent).join('/')}.json`).then(data => {
      if (data.fullName !== fullName || typeof data.name !== 'string') throw new Error('详情缓存无效');
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
    const button = element('button', 'repo-button', '重试');
    button.addEventListener('click', () => renderRepos());
    box.append(button);
  }
  if (returnUrl) {
    const link = element('a', 'repo-button', '返回仓库分类');
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
  clearOutline?.();
  clearOutline = null;
  saveList();
  generation++;
}

function renderCategories(data, slug) {
  const tabs = element('div', 'repo-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', '仓库分类');
  for (const category of data.categories) {
    const tab = element('button', 'repo-tab', category.name);
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
    message('暂无仓库', '这个分类还没有公开仓库。');
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
    text.append(element('h2', 'repo-name', repo.name), element('p', 'repo-description', repo.description || '暂无简介'));
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
  card.append(element('h1', 'repo-summary-title', repo.name), element('p', 'repo-description', repo.description || '暂无简介'));
  const metaCard = element('section', 'repo-meta-card');
  const metaTitle = element('h2', 'repo-meta-title', '仓库信息');
  metaTitle.id = 'repo-meta-title';
  metaCard.setAttribute('aria-labelledby', metaTitle.id);
  const meta = element('dl', 'repo-meta');
  const entries = [['许可证', repo.license?.spdxId && repo.license.spdxId !== 'NOASSERTION' ? repo.license.spdxId : repo.license?.name || '保留所有权利', 'balance'], ['Commits', String(repo.commitCount), 'commit']];
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
  outline.append(icon('format_list_bulleted'), element('span', '', '自述文件大纲'));
  const github = element('a', 'repo-github');
  github.append(icon('open_in_new'), element('span', '', '在 GitHub 中查看'));
  github.href = `https://github.com/${repo.fullName}`;
  github.target = '_blank';
  github.rel = 'noopener noreferrer';
  action.append(outline, github);
  metaCard.append(metaTitle, meta, action);
  const profile = element('div', 'repo-profile');
  profile.append(card, metaCard);
  const readmeColumn = element('div', 'repo-readme-column');
  const readme = element('div', 'repo-readme-body flex min-w-0 flex-col gap-3');
  readmeColumn.append(readme);
  content.replaceChildren(profile, readmeColumn);
  shell.classList.add('repo-shell--detail');
  layoutObserver.observe(card);
  alignBack();
  if (repo.readme) renderMarkdown(readme, repo.readme.markdown, { repository: repo.fullName, readmePath: repo.readme.path, ref: repo.readme.ref, splitAtRules: false });
  else readme.append(element('p', 'repo-summary text-s-14 text-s-text-desc', '暂无自述文件'));
  scroll.scrollTop = 0;
  clearOutline = mountRepoOutline(outline, readme, readmeColumn, scroll);
}

export async function renderRepos() {
  clearOutline?.();
  clearOutline = null;
  saveList();
  const id = ++generation;
  content.setAttribute('aria-busy', 'true');
  content.removeAttribute('role');
  content.removeAttribute('aria-labelledby');
  let parts;
  try { parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent); }
  catch { message('地址无效', '无法解析仓库地址。', false, '#/repo'); content.setAttribute('aria-busy', 'false'); return; }
  const [, slug, owner, name] = parts;
  const isDetail = parts.length === 4;
  categories.hidden = isDetail;
  if (isDetail) {
    back.hidden = false;
    back.href = categoryUrl(slug);
  }
  message('加载中…', '正在读取仓库缓存');
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
      message('分类不存在', '请选择上方分类，或返回默认分类。', false, '#/repo');
      return;
    }
    if (!isDetail) {
      renderCategories(data, slug);
      showList(data, category);
      return;
    }
    const fullName = `${owner}/${name}`;
    if (!category.repositories.includes(fullName)) {
      message('仓库不存在', '该仓库不在当前分类中。', false, categoryUrl(slug));
      return;
    }
    const repo = await loadDetail(fullName);
    if (id !== generation) return;
    document.getElementById('appbar-title').textContent = repo.name;
    showDetail(repo);
  } catch {
    if (id === generation) message('暂时无法加载', '仓库缓存尚未生成或读取失败，请稍后重试。', true, isDetail ? categoryUrl(slug) : undefined);
  } finally {
    if (id === generation) content.setAttribute('aria-busy', 'false');
  }
}
