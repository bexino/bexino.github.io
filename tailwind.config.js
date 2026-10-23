import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

/** @type {import('tailwindcss').Config} */
export default {
  presets: [require('./tailwind.preset.cjs')],
  content: ['./index.html', './src/**/*.{js,ts,html,css}'],
  theme: {
    extend: {
      fontFamily: {
        s: ['Geist', 'Smartisan Compact', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'PingFang SC', 'Noto Sans CJK SC', 'Microsoft YaHei', 'sans-serif'],
      },
    },
  },
};
