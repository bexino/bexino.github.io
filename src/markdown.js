import { t } from './i18n.js';
import { syncGhstatsTheme } from './ghstats-theme.js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const ALERTS = { NOTE: 'note', TIP: 'tip', IMPORTANT: 'important', WARNING: 'warning', CAUTION: 'caution' };

async function copyCode(text) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Older browsers and non-HTTPS previews may not expose the Clipboard API.
  }
  const active = document.activeElement;
  const selection = window.getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
  const field = document.createElement('textarea');
  field.value = text;
  field.readOnly = true;
  field.className = 'markdown-copy-field';
  document.body.append(field);
  try {
    field.focus({ preventScroll: true });
    field.select();
    if (!document.execCommand('copy')) throw new Error('Copy failed');
  } finally {
    field.remove();
    active?.focus({ preventScroll: true });
    if (selection) {
      selection.removeAllRanges();
      ranges.forEach(range => selection.addRange(range));
    }
  }
}

function addCodeCopyButtons(content) {
  content.querySelectorAll('pre').forEach(pre => {
    const code = pre.querySelector('code') || pre;
    const text = code.textContent;
    const block = document.createElement('div');
    block.className = 'markdown-code-block';
    const toolbar = document.createElement('div');
    toolbar.className = 'markdown-code-toolbar';
    const language = document.createElement('span');
    language.className = 'markdown-code-language';
    language.textContent = Array.from(code.classList).find(name => name.startsWith('language-'))?.slice(9) || t('纯文本');
    language.title = language.textContent;
    const status = document.createElement('span');
    status.className = 'markdown-copy-status';
    status.setAttribute('role', 'status');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'markdown-copy-button';
    button.textContent = t('复制');
    button.setAttribute('aria-label', t('复制代码'));
    let resetTimer;
    let copying = false;
    button.addEventListener('click', async () => {
      if (copying) return;
      clearTimeout(resetTimer);
      copying = true;
      button.setAttribute('aria-busy', 'true');
      status.textContent = '';
      try {
        await copyCode(text);
        button.textContent = t('已复制');
        status.textContent = t('代码已复制');
      } catch {
        button.textContent = t('重试');
        status.textContent = t('复制失败，请重试或手动选择代码复制');
      } finally {
        copying = false;
        button.removeAttribute('aria-busy');
        resetTimer = setTimeout(() => {
          button.textContent = t('复制');
          status.textContent = '';
        }, 2500);
      }
    });
    pre.replaceWith(block);
    toolbar.append(language, status, button);
    block.append(toolbar, pre);
  });
}

function isShieldsUrl(value) {
  try {
    const hostname = new URL(value, 'https://localhost/').hostname.toLowerCase().replace(/\.$/, '');
    return hostname === 'shields.io' || hostname.endsWith('.shields.io');
  } catch {
    return false;
  }
}

function removeBadge(element) {
  let parent = element.parentElement;
  element.remove();
  while (parent && parent.matches('a, p, span, div, picture') &&
    !parent.textContent.trim() && !parent.querySelector('img, source, video, audio, svg, iframe, input, hr')) {
    const next = parent.parentElement;
    parent.remove();
    parent = next;
  }
}

export function renderMarkdown(body, markdown, { repository, readmePath, ref, transformImage, splitAtRules = true, hideShields = true } = {}) {
  const cleaned = markdown.replace(/^<!--\s*fetchedAt:.*?-->\s*/, '');
  const template = document.createElement('template');
  template.innerHTML = DOMPurify.sanitize(marked.parse(cleaned, { breaks: false, gfm: true }), {
    USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'button'], FORBID_ATTR: ['style', 'srcset'],
    SANITIZE_NAMED_PROPS: true, ALLOW_DATA_ATTR: false,
  });
  const content = template.content;
  const headings = new Map();
  content.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(heading => {
    const base = heading.textContent.toLowerCase().replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '').replace(/ /g, '-');
    const count = headings.get(base) || 0;
    headings.set(base, count + 1);
    heading.id = `readme-${base}${count ? `-${count}` : ''}`;
  });
  content.querySelectorAll('blockquote').forEach(quote => {
    const first = quote.firstElementChild;
    const marker = first?.firstChild;
    if (marker?.nodeType !== Node.TEXT_NODE) return;
    const match = marker.textContent.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s|$)/i);
    if (!match) return;
    const type = match[1].toUpperCase();
    marker.textContent = marker.textContent.slice(match[0].length);
    const variant = ALERTS[type];
    quote.className = `markdown-alert markdown-alert--${variant}`;
    const title = document.createElement('p');
    title.className = 'markdown-alert-title';
    title.append(type[0] + type.slice(1).toLowerCase());
    quote.prepend(title);
    if (!first.textContent.trim() && !first.querySelector('img')) first.remove();
  });

  const basePath = readmePath?.includes('/') ? readmePath.slice(0, readmePath.lastIndexOf('/') + 1) : '';
  const revision = encodeURIComponent(ref || 'HEAD');
  const repoBase = repository ? `https://github.com/${repository}/blob/${revision}/` : null;
  const rawBase = repository ? `https://raw.githubusercontent.com/${repository}/${revision}/` : null;
  function relativeUrl(value, base) {
    if (!base || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) return value;
    return new URL(value.replace(/^\//, ''), base + (value.startsWith('/') ? '' : basePath)).href;
  }
  content.querySelectorAll('img[src],source[src],video[src],audio[src]').forEach(element => {
    element.setAttribute('src', relativeUrl(element.getAttribute('src'), rawBase));
    // Filter before cache rewriting unless the page explicitly keeps Shields badges.
    if (hideShields && isShieldsUrl(element.getAttribute('src'))) {
      removeBadge(element);
      return;
    }
    if (element.tagName === 'IMG') {
      if (transformImage) element.setAttribute('src', transformImage(element.getAttribute('src')));
      if (hideShields && isShieldsUrl(element.getAttribute('src'))) {
        removeBadge(element);
        return;
      }
      element.loading = 'lazy';
      element.onerror = () => { element.hidden = true; };
    }
  });
  content.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (href.startsWith('#')) {
      link.addEventListener('click', event => {
        event.preventDefault();
        let id;
        try { id = decodeURIComponent(href.slice(1)); } catch { return; }
        const target = Array.from(body.querySelectorAll('[id],[name]')).find(el => el.id === `readme-${id}` || el.id === `user-content-${id}` || el.getAttribute('name') === `user-content-${id}`);
        target?.scrollIntoView({ block: 'start' });
      });
    } else {
      link.setAttribute('href', relativeUrl(href, repoBase));
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
  });
  content.querySelectorAll('table').forEach(table => {
    const scroller = document.createElement('div');
    scroller.className = 'markdown-table';
    scroller.tabIndex = 0;
    scroller.setAttribute('role', 'region');
    scroller.setAttribute('aria-label', t('表格，可横向滚动'));
    table.replaceWith(scroller);
    scroller.append(table);
  });
  addCodeCopyButtons(content);
  const cards = document.createDocumentFragment();
  let card;
  const start = () => {
    card = document.createElement('article');
    card.className = 'markdown-s min-w-0 rounded-s-lg border-s-sm border-s-grey-400 bg-s-white p-4 text-s-14 leading-relaxed text-s-grey-900 shadow-s-card';
  };
  const finish = () => {
    if (Array.from(card.childNodes).some(node => node.nodeType === Node.ELEMENT_NODE || node.textContent.trim())) cards.append(card);
  };
  start();
  for (const node of Array.from(content.childNodes)) {
    if (splitAtRules && node.nodeName === 'HR') { finish(); start(); }
    else card.append(node);
  }
  finish();
  syncGhstatsTheme(cards);
  body.replaceChildren(cards);
}
