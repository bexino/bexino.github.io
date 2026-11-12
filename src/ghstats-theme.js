// Change only the light variant; custom/default themes belong to the author.
export function ghstatsThemeUrl(value, dark) {
  if (!dark) return value;
  // Match the parameter itself so original and mirrored/relative URLs work alike.
  const fragment = value.indexOf('#');
  const end = fragment === -1 ? value.length : fragment;
  return value.slice(0, end).replace(/([?&]theme=)light(?=&|$)/g, '$1default') + value.slice(end);
}

const originals = new WeakMap();
export function syncGhstatsTheme(root = document) {
  const dark = document.documentElement.dataset.theme === 'dark';
  root.querySelectorAll('img[src], a[href]').forEach(element => {
    const attribute = element.tagName === 'IMG' ? 'src' : 'href';
    const current = element.getAttribute(attribute);
    let saved = originals.get(element);
    // If the renderer or another caller changed the URL, treat it as new input.
    if (!saved || current !== saved.applied) saved = { original: current };
    const next = ghstatsThemeUrl(saved.original, dark);
    saved.applied = next;
    originals.set(element, saved);
    if (next !== current) {
      element.setAttribute(attribute, next);
      if (element.tagName === 'IMG') element.hidden = false;
    }
  });
}
