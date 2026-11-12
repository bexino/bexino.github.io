import { t, getLanguage } from './i18n.js';
import { renderMarkdown } from './markdown.js';
import { mountRepoOutline } from './repo-outline.js';
import { dataSource, directSummary, directDetail, githubRequest } from './github-data.js';

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
let listSource;
let listLanguage;
let scrollFrame;
let categoryJump;

async function orderedCategories(data) {
  let order = [];
  try {
    const response = await fetch('./repo-order.txt', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (response.ok) order = (await response.text()).split(/\r?\n/).map(line => line.trim().toLowerCase()).filter(line => line && !line.startsWith('#'));
  } catch { /* 配置不可用时保留原始顺序。 */ }
  const rank = name => {
    const index = order.indexOf(name.trim().toLowerCase());
    return index < 0 ? Infinity : index;
  };
  return [...data.categories].sort((a, b) => rank(a.name) - rank(b.name));
}

function markCategory(slug) {
  for (const link of categories.querySelectorAll('.repo-tab')) {
    if (link.dataset.category === slug) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
  const active = categories.querySelector('[aria-current]');
  if (active) categories.scrollLeft = Math.max(0, active.offsetLeft - categories.clientWidth / 2 + active.clientWidth / 2);
}

function jumpToCategory(slug) {
  const group = [...content.querySelectorAll('.repo-group')].find(group => group.dataset.category === slug);
  if (!group) return;
  scroll.scrollTop += group.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 12;
  // Near the end, scrolling stops at the natural bottom. Keep the clicked
  // category selected until the user actually scrolls to another position.
  categoryJump = { slug, top: scroll.scrollTop };
  markCategory(slug);
}

scroll.addEventListener('scroll', () => {
  cancelAnimationFrame(scrollFrame);
  scrollFrame = requestAnimationFrame(() => {
    if (!currentList) return;
    if (categoryJump && Math.abs(scroll.scrollTop - categoryJump.top) < 1) {
      markCategory(categoryJump.slug);
      return;
    }
    categoryJump = null;
    const groups = [...content.querySelectorAll('.repo-group')];
    // Move the reading position through the viewport as scrolling progresses.
    // Short trailing groups cannot reach the top without artificial bottom space.
    const range = scroll.scrollHeight - scroll.clientHeight;
    const progress = range > 0 ? Math.min(1, Math.max(0, scroll.scrollTop / range)) : 0;
    const top = scroll.getBoundingClientRect().top + 18 + progress * Math.max(0, scroll.clientHeight - 36);
    let active = groups[0];
    for (const group of groups) {
      if (group.getBoundingClientRect().top <= top) active = group;
    }
    if (active) markCategory(active.dataset.category);
  });
});

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
const projectView = () => location.hash.replace(/^#\/?/, '').split('/')[0] === 'site' ? 'site' : 'repo';
const categoryUrl = slug => `#/${projectView()}/${encodeURIComponent(slug)}`;
const detailUrl = (slug, name) => `${categoryUrl(slug)}/${name.split('/').map(encodeURIComponent).join('/')}`;

function websiteUrl(repo) {
  try {
    const url = new URL(repo?.homepageUrl);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function programCategories(data) {
  return data.categories.map(category => ({
    ...category,
    repositories: category.repositories.filter(fullName => data.repositories[fullName] && !websiteUrl(data.repositories[fullName])),
  })).filter(category => category.repositories.length);
}

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
  categoryJump = null;
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
  for (const category of data.categories) {
    const tab = element('a', 'repo-tab', t(category.name));
    tab.id = `category-${category.slug}`;
    tab.href = categoryUrl(category.slug);
    tab.dataset.category = category.slug;
    tab.setAttribute('aria-controls', `repo-group-${category.slug}`);
    tab.addEventListener('click', event => {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (location.hash === categoryUrl(category.slug)) jumpToCategory(category.slug);
      else location.hash = categoryUrl(category.slug);
    });
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
  markCategory(slug);
  const active = tabs.querySelector('[aria-current]');
  if (hadFocus) active?.focus({ preventScroll: true });
  if (active) categories.scrollLeft = Math.max(0, active.offsetLeft - categories.clientWidth / 2 + active.clientWidth / 2);
}

function showList(data, slug) {
  const sites = projectView() === 'site';
  currentList = projectView();
  listSource = dataSource();
  listLanguage = getLanguage();
  selectedRepo = null;
  const groups = [];
  for (const category of data.categories) {
    const group = element('section', 'repo-group');
    group.id = `repo-group-${category.slug}`;
    group.dataset.category = category.slug;
    const heading = element('h2', 'repo-group-title', t(category.name));
    heading.id = `repo-group-title-${category.slug}`;
    if (!sites) group.setAttribute('aria-labelledby', heading.id);
    const list = element('div', 'repo-list');
    for (const fullName of category.repositories) {
      const repo = data.repositories[fullName];
      if (!repo) continue;
      const website = websiteUrl(repo);
      const row = element(website ? 'div' : 'a', 'repo-row s-list-item');
      const detail = website ? element('a', 'repo-detail-link') : row;
      detail.href = detailUrl(category.slug, fullName);
      row.dataset.repository = fullName;
      const text = element('div', 'min-w-0 flex-1');
      const name = element('h3', 'repo-name', repo.name);
      const badges = element('span', 'flex shrink-0 items-center gap-3 text-2xl text-s-icon');
      for (const [visible, glyph, label] of [
        [website, 'language', t('在线体验')],
        [repo.hasReleases, 'download', t('下载')],
      ]) {
        if (!visible) continue;
        const badge = element(glyph === 'language' ? 'a' : 'span', glyph === 'language' ? 'repo-website inline-flex' : 'inline-flex');
        if (glyph === 'language') {
          badge.href = website;
          badge.target = '_blank';
          badge.rel = 'noopener noreferrer';
        }
        badge.title = label;
        badge.append(icon(glyph), element('span', 'sr-only', label));
        if (glyph === 'download') {
          badge.classList.add('ml-1.5', 'align-middle', 'text-s-16', 'text-s-icon');
          name.append(badge);
        } else badges.append(badge);
      }
      if (badges.childElementCount) row.append(badges);
      text.append(name, element('p', 'repo-description', t(repo.description) || t('暂无简介')));
      detail.append(text, icon('chevron_right'));
      detail.addEventListener('click', () => { selectedRepo = fullName; });
      if (website) row.append(detail);
      list.append(row);
    }
    if (!sites) group.append(heading);
    group.append(list);
    if (!list.childElementCount) group.append(element('p', 'repo-group-empty', t('这个分类还没有公开仓库。')));
    groups.push(group);
  }
  content.replaceChildren(...groups);
  const saved = positions.get(currentList);
  scroll.scrollTop = saved?.top || 0;
  const row = saved?.repo && [...content.querySelectorAll('.repo-row')].find(row => row.dataset.repository === saved.repo && (!slug || row.closest('.repo-group').dataset.category === slug));
  if (row) {
    (row.querySelector('.repo-detail-link') || row).focus({ preventScroll: true });
    categoryJump = { slug: row.closest('.repo-group').dataset.category, top: scroll.scrollTop };
  } else if (slug) jumpToCategory(slug);
  markCategory(slug || data.categories[0]?.slug);
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
  const outline = element('button', 'repo-outline-trigger repo-readme-button repo-button');
  outline.type = 'button';
  outline.append(icon('format_list_bulleted'), element('span', '', t('目录')));
  github.href = `https://github.com/${repo.fullName}`;
  github.hidden = false;
  if (repo.hasReleases) {
    const download = element('a', 'repo-github');
    download.append(icon('download'), element('span', '', t('下载')));
    download.href = `https://github.com/${repo.fullName}/releases`;
    download.target = '_blank';
    download.rel = 'noopener noreferrer';
    action.append(download);
  }
  const website = websiteUrl(repo);
  if (website) {
    const demo = element('a', 'repo-github');
    demo.append(icon('public'), element('span', '', t('在线体验')));
    demo.href = website;
    demo.target = '_blank';
    demo.rel = 'noopener noreferrer';
    action.append(demo);
  }
  metaCard.append(metaTitle, meta);
  if (action.childElementCount) metaCard.append(action);
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
  const view = projectView();
  const sites = view === 'site';
  // Category links move within the mounted list without refetching or replacing it.
  if (currentList === view && listSource === dataSource() && listLanguage === getLanguage()) {
    try {
      const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
      const slug = parts[1] === 'web-and-agent' ? 'web-agent' : parts[1];
      if (parts.length <= 2 && (!slug || [...categories.querySelectorAll('.repo-tab')].some(link => link.dataset.category === slug))) {
        categories.hidden = sites || !categories.querySelector('.repo-tab');
        if (slug) jumpToCategory(slug);
        else scroll.scrollTop = 0;
        return;
      }
    } catch { /* Let normal route validation show the error. */ }
  }
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
  categories.hidden = true;
  if (isDetail) {
    back.hidden = false;
    back.href = sites ? '#/site' : categoryUrl(slug);
  }
  const direct = dataSource() === 'direct';
  message(t('加载中…'), t(direct ? '正在连接 GitHub' : '正在读取仓库缓存'));
  try {
    const index = await loadIndex();
    const data = { ...index, categories: await orderedCategories(index) };
    if (sites && isDetail && slug === 'sites') {
      data.categories = [{
        slug: 'sites', name: '站点',
        repositories: Object.keys(index.repositories).filter(fullName => websiteUrl(index.repositories[fullName])),
      }];
    }
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
    if ((!category && (slug || isDetail)) || ![1, 2, 4].includes(parts.length)) {
      back.hidden = true;
      const visibleData = { ...data, categories: sites ? [] : programCategories(data) };
      categories.hidden = sites || !visibleData.categories.length;
      renderCategories(visibleData, slug || visibleData.categories[0]?.slug);
      message(t('分类不存在'), t('请选择上方分类，或返回默认分类。'), false, '#/repo');
      return;
    }
    if (!isDetail) {
      // GitHub Lists have no unauthenticated public endpoint; only membership
      // comes from the index cache. Fetch displayed metadata directly.
      const fullNames = [...new Set(data.categories.flatMap(category => category.repositories))];
      const repositories = direct ? Object.fromEntries(await Promise.all(fullNames.map(async fullName => {
        const [summary, releases] = await Promise.all([directSummary(fullName), githubRequest(`repos/${fullName.split('/').map(encodeURIComponent).join('/')}/releases?per_page=1`)]);
        return [fullName, { ...summary, hasReleases: releases.data.length > 0 }];
      }))) : data.repositories;
      if (id !== generation) return;
      const siteRepositories = Object.keys(repositories).filter(fullName => websiteUrl(repositories[fullName]));
      const visibleCategories = sites
        ? (siteRepositories.length ? [{ slug: 'sites', name: '站点', repositories: siteRepositories }] : [])
        : programCategories({ ...data, repositories });
      const visibleData = { ...data, repositories, categories: visibleCategories };
      categories.hidden = sites || !visibleCategories.length;
      renderCategories(visibleData, slug || visibleCategories[0]?.slug);
      if (!visibleCategories.length) {
        message(t(sites ? '暂无站点' : '暂无仓库'), t(sites ? '还没有填写 website 的仓库。' : '暂无可显示的程序。'));
        return;
      }
      showList(visibleData, visibleCategories.some(category => category.slug === slug) ? slug : undefined);
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
