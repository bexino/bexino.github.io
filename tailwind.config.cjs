const smartisanPreset = require('./tailwind.preset.cjs');
const siteFontFamily = ['Google Sans Flex', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans CJK SC', 'Source Han Sans SC', 'sans-serif'];

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [smartisanPreset],
  content: ['./index.html', './src/**/*.{js,ts,html,css}'],
  theme: {
    extend: {
      fontFamily: {
        s: siteFontFamily,
        sans: siteFontFamily,
        mono: siteFontFamily,
      },
    },
  },
};
