import { syncGhstatsTheme } from './ghstats-theme.js';

// Query parameters survive hash navigation and can be shared or bookmarked.
const control = document.getElementById('theme-control');
const system = matchMedia('(prefers-color-scheme: dark)');
function syncTheme() {
  const parameter = new URL(location.href).searchParams.get('theme');
  const mode = parameter === 'light' || parameter === 'dark' ? parameter : 'system';
  document.documentElement.dataset.theme = mode === 'system' ? (system.matches ? 'dark' : 'light') : mode;
  syncGhstatsTheme();
  control.querySelectorAll('input[name="theme"]').forEach((input) => {
    input.checked = input.value === mode;
  });
}
control.addEventListener('change', (event) => {
  if (!event.target.matches('input[name="theme"]')) return;
  const url = new URL(location.href);
  if (event.target.value === 'system') url.searchParams.delete('theme');
  else url.searchParams.set('theme', event.target.value);
  history.pushState(null, '', url);
  syncTheme();
});
system.addEventListener('change', syncTheme);
window.addEventListener('popstate', syncTheme);
syncTheme();
