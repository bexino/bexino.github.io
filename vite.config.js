import { defineConfig } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 收集项目用到的 Material Design Icons，构建时合并成单一 SVG Sprite（public/icons-sprite.svg）。
 * 列表集中维护在这里，新增图标只需往 ICONS 里加一项。
 */
const ICONS = [
  'home',
  'folder',
  'person',
  'settings',
  'chevron_left',
  'chevron_right',
  'info',
  'lightbulb',
  'announcement',
  'warning',
  'report',
  'balance',
  'commit',
  'account_tree',
  'open_in_new',
  'format_list_bulleted',
];

const OUT = 'public/icons-sprite.svg';

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'mdi-sprite',
      // build 与 dev 启动时都生成一次
      buildStart() {
        const symbols = ICONS.map((name) => {
          const svg = readFileSync(
            resolve(`node_modules/@material-design-icons/svg/filled/${name}.svg`),
            'utf8',
          );
          // 去掉外层 <svg ...>，把内部内容包成 <symbol>
          const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
          return `<symbol id="si-${name}" viewBox="0 0 24 24">${inner}</symbol>`;
        });
        const sprite = `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0">\n${symbols.join('\n')}\n</svg>\n`;
        writeFileSync(OUT, sprite);
      },
    },
  ],
});
