import { t, getLanguage } from './i18n.js';
// Build navigation from the rendered README so labels and anchors always agree.
export function mountRepoOutline(trigger, readme, column, pageScroll) {
  const headings = [...readme.querySelectorAll('h1,h2,h3,h4,h5,h6')];
  const toolbar = document.createElement('div');
  toolbar.className = 'repo-readme-toolbar';
  toolbar.append(trigger);
  const footer = document.createElement('div');
  footer.className = 'repo-readme-footer';
  footer.hidden = true;
  function floatingButton(glyph, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'repo-readme-button repo-button';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('md-icon');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(svg.namespaceURI, 'use');
    use.setAttribute('href', `./icons-sprite.svg#si-${glyph}`);
    svg.append(use);
    const text = document.createElement('span');
    text.textContent = label;
    button.append(svg, text);
    return button;
  }
  const chineseHeading = headings.find(heading => heading.tagName === 'H1' && heading.textContent.trim() === '简体中文');
  if (chineseHeading && getLanguage() !== 'en') {
    const chinese = floatingButton('public', '简体中文');
    chinese.lang = 'zh-CN';
    chinese.addEventListener('click', () => select(chineseHeading));
    toolbar.append(chinese);
  }
  const backToTop = floatingButton('vertical_align_top', t('回到顶部'));
  backToTop.addEventListener('click', () => {
    const scroller = root();
    scroller.scrollTo({ top: documentTop(), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    trigger.focus({ preventScroll: true });
  });
  footer.append(backToTop);
  column.append(toolbar, footer);

  const dialog = document.createElement('dialog');
  dialog.id = 'repo-outline-dialog';
  dialog.className = 'repo-outline-dialog';
  dialog.setAttribute('aria-labelledby', 'repo-outline-title');
  const header = document.createElement('header');
  header.className = 'repo-outline-header';
  const dialogTitle = document.createElement('h2');
  dialogTitle.id = 'repo-outline-title';
  dialogTitle.textContent = t('目录');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'repo-button';
  close.textContent = t('关闭');
  header.append(dialogTitle, close);
  dialog.append(header);
  document.body.append(dialog);

  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', dialog.id);
  trigger.setAttribute('aria-expanded', 'false');

  const media = matchMedia('(min-width: 960px)');
  const buttons = new Map(headings.map(heading => [heading, []]));
  const baseLevel = Math.min(...headings.map(heading => Number(heading.tagName[1])));
  let closeTimer;
  let frame;
  let active;
  const root = () => media.matches ? column : pageScroll;
  const documentTop = () => media.matches ? 0 : Math.max(0, pageScroll.scrollTop + column.getBoundingClientRect().top - pageScroll.getBoundingClientRect().top);
  function closeDialog(immediate = false) {
    if (!dialog.open) return;
    clearTimeout(closeTimer);
    const finish = () => {
      dialog.close();
      dialog.classList.remove('is-closing');
      trigger.setAttribute('aria-expanded', 'false');
    };
    if (immediate) finish();
    else {
      dialog.classList.add('is-closing');
      closeTimer = setTimeout(finish, media.matches ? 100 : 250);
    }
  }
  function select(heading) {
    // Headings inside collapsed README sections must become visible first.
    for (let ancestor = heading.parentElement; ancestor && ancestor !== readme; ancestor = ancestor.parentElement) {
      if (ancestor.tagName === 'DETAILS') ancestor.open = true;
    }
    closeDialog(true);
    const scroller = root();
    scroller.scrollTo({ top: scroller.scrollTop + heading.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 50 });
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    update();
  }
  function navigation() {
    const nav = document.createElement('nav');
    nav.className = 'repo-outline-list';
    nav.setAttribute('aria-label', t('目录'));
    if (!headings.length) {
      const empty = document.createElement('p');
      empty.className = 'repo-outline-empty';
      empty.textContent = t('自述文件暂无标题');
      nav.append(empty);
    }
    for (const heading of headings) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'repo-outline-item s-list-item';
      button.textContent = heading.textContent.trim() || heading.querySelector('img')?.alt || t('未命名章节');
      button.style.setProperty('--outline-level', Number(heading.tagName[1]) - baseLevel);
      button.addEventListener('click', () => select(heading));
      buttons.get(heading).push(button);
      nav.append(button);
    }
    return nav;
  }
  dialog.append(navigation());
  function update() {
    const scroller = root();
    const bounds = readme.firstElementChild.getBoundingClientRect();
    const lastBounds = readme.lastElementChild.getBoundingClientRect();
    const viewport = scroller.getBoundingClientRect();
    const topEdge = Math.max(bounds.top + 1, viewport.top);
    const bottomEdge = Math.min(lastBounds.bottom - 1, viewport.bottom);
    const scrolled = scroller.scrollTop > documentTop() + 1;
    toolbar.hidden = !column.getClientRects().length || bottomEdge - topEdge < 96;
    toolbar.classList.toggle('is-scrolled', scrolled);
    footer.hidden = toolbar.hidden || !scrolled;
    for (const overlay of [toolbar, footer]) {
      overlay.style.left = `${bounds.left + 1}px`;
      overlay.style.width = `${Math.max(0, bounds.width - 2)}px`;
    }
    toolbar.style.top = `${topEdge}px`;
    footer.style.top = `${bottomEdge - 96}px`;
    const visible = headings.filter(heading => heading.getClientRects().length);
    const top = viewport.top + 62;
    let current = visible[0];
    for (const heading of visible) {
      if (heading.getBoundingClientRect().top <= top) current = heading;
    }
    if (scroller.scrollTop > 0 && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) current = visible.at(-1);
    if (current === active) return;
    active = current;
    for (const [heading, items] of buttons) for (const item of items) {
      if (heading === current) item.setAttribute('aria-current', 'location');
      else item.removeAttribute('aria-current');
    }
    const selected = buttons.get(current)?.[0];
    const list = selected?.parentElement;
    if (list) list.scrollTop = Math.max(0, selected.offsetTop + selected.offsetHeight / 2 - list.clientHeight / 2);
  }
  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  }
  trigger.addEventListener('click', () => {
    clearTimeout(closeTimer);
    dialog.classList.remove('is-closing');
    dialog.showModal();
    trigger.setAttribute('aria-expanded', 'true');
    (dialog.querySelector('[aria-current]') || close).focus({ preventScroll: true });
  });
  close.addEventListener('click', () => closeDialog());
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientY < bounds.top || event.clientX < bounds.left || event.clientX > bounds.right || event.clientY > bounds.bottom) closeDialog();
  });
  function resize() { closeDialog(true); schedule(); }
  media.addEventListener('change', resize);
  window.addEventListener('resize', schedule);
  const observer = new ResizeObserver(schedule);
  observer.observe(column);
  observer.observe(readme);
  column.addEventListener('scroll', schedule, { passive: true });
  pageScroll.addEventListener('scroll', schedule, { passive: true });
  readme.addEventListener('load', schedule, true);
  readme.addEventListener('toggle', schedule, true);
  update();
  return () => {
    clearTimeout(closeTimer);
    cancelAnimationFrame(frame);
    closeDialog(true);
    dialog.remove();
    toolbar.remove();
    footer.remove();
    observer.disconnect();
    window.removeEventListener('resize', schedule);
    media.removeEventListener('change', resize);
    column.removeEventListener('scroll', schedule);
    pageScroll.removeEventListener('scroll', schedule);
    readme.removeEventListener('load', schedule, true);
    readme.removeEventListener('toggle', schedule, true);
  };
}
