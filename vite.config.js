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
  'chat',
  'calendar_month',
  'person',
];

const OUT = 'public/icons-sprite.svg';

/**
 * 本地调试用：把两个子站反代到 /child-pt/ 、/child-sched/ ，
 * 使 iframe 与父页同源——父页即可直接读取子站真实地址（含 ?step= 、# 路由等参数），
 * 换算成生产地址写进地址栏的 u= 深链参数，行为与线上一致。
 * 仅 dev server 生效，不影响构建产物。
 */
const CHILD_PROXIES = {
  'child-pt': 'https://pt.bexino.dpdns.org',
  'child-sched': 'https://sched.bexino.dpdns.org',
};

export default defineConfig({
  base: './',
  server: {
    proxy: Object.fromEntries(
      Object.entries(CHILD_PROXIES).map(([prefix, target]) => [
        `/${prefix}`,
        {
          target,
          changeOrigin: true,
          rewrite: (path) => path.replace(new RegExp(`^/${prefix}`), ''),
        },
      ]),
    ),
  },
  plugins: [
    {
      name: 'dev-child-proxy',
      apply: 'serve',
      // dev 下把 iframe 的初始 src 改写为代理路径，避免先加载一次线上站点再换源。
      // 只改 src，保留 data-src 为生产地址（父页据此判断默认页）。
      transformIndexHtml(html) {
        return html.replace(/<iframe[^>]*><\/iframe>/g, (tag) =>
          tag.replace(
            /\ssrc="https:\/\/(pt|sched)\.bexino\.dpdns\.org([^"]*)"/g,
            (_, tab, rest = '') => ` src="/child-${tab}${rest}"`,
          ),
        );
      },
    },
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
