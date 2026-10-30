import test from 'node:test';
import assert from 'node:assert/strict';
import { ghstatsThemeUrl } from '../src/ghstats-theme.js';

test('dark mode replaces light theme on any host without changing other URL bytes', () => {
  const light = 'https://ghstats.dev/api/card?hide=stars%2Cprs&theme=light&username=bexino#preview';
  assert.equal(ghstatsThemeUrl(light, true), light.replace('theme=light', 'theme=default'));
  assert.equal(ghstatsThemeUrl(light, false), light);
  for (const value of ['default', 'dark', 'custom', 'light_extra', '']) {
    const url = `https://ghstats.dev/api/langs?theme=${value}`;
    assert.equal(ghstatsThemeUrl(url, true), url);
  }
  for (const url of ['https://mirror.example/api/card?theme=light&user=bexino', '/proxy/ghstats/api/langs?theme=light', 'https://proxy.example/https://ghstats.dev/api/card?theme=light#preview']) {
    assert.equal(ghstatsThemeUrl(url, true), url.replace('theme=light', 'theme=default'));
    assert.equal(ghstatsThemeUrl(url, false), url);
  }
  for (const url of ['https://ghstats.dev/?other=theme=light', 'https://ghstats.dev/#theme=light', '/mirror#preview?theme=light']) {
    assert.equal(ghstatsThemeUrl(url, true), url);
  }
});
