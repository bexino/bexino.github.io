// A missing static file can return the SPA document with HTTP 200.
export function isReadme(text, contentType = '') {
  if (typeof text !== 'string' || !text.trim() || /text\/html|application\/xhtml\+xml/i.test(contentType)) return false;
  // Do not render Git conflict markers as Markdown headings or blockquotes.
  if (/^(?:<{7}|>{7}|\|{7})(?:[ \t]|$)/m.test(text)) return false;
  const content = text.replace(/^\uFEFF/, '').replace(/^(?:\s*<!--[\s\S]*?-->)*\s*/, '');
  return !/^<(?:!doctype\s+html|html\b|head\b|body\b|meta\b)/i.test(content);
}

export function parseProfile(text) {
  try {
    const data = JSON.parse(text);
    const profile = data?.profile ?? data;
    return typeof profile?.login === 'string' && profile.login.trim() ? profile : null;
  } catch {
    return null;
  }
}
