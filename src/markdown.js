import { marked } from 'marked';
import DOMPurify from 'dompurify';

const ALERTS = { NOTE: ['info', 'note'], TIP: ['lightbulb', 'tip'], IMPORTANT: ['announcement', 'important'], WARNING: ['warning', 'warning'], CAUTION: ['report', 'caution'] };

export function renderMarkdown(body, markdown, { repository, readmePath, ref, transformImage } = {}) {
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
    const [icon, variant] = ALERTS[type];
    quote.className = `markdown-alert markdown-alert--${variant}`;
    const title = document.createElement('p');
    title.className = 'markdown-alert-title';
    title.innerHTML = `<svg class="md-icon" aria-hidden="true"><use href="./icons-sprite.svg#si-${icon}"/></svg>`;
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
    if (element.tagName === 'IMG') {
      if (transformImage) element.setAttribute('src', transformImage(element.getAttribute('src')));
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
    scroller.setAttribute('aria-label', '表格，可横向滚动');
    table.replaceWith(scroller);
    scroller.append(table);
  });
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
    if (node.nodeName === 'HR') { finish(); start(); }
    else card.append(node);
  }
  finish();
  body.replaceChildren(cards);
}
