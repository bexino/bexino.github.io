const smartisanPreset = require('./tailwind.preset.cjs');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [smartisanPreset],
  content: ['./index.html', './src/**/*.{js,ts,html,css}'],
  theme: {
    extend: {
      fontFamily: {
        s: ['Google Sans Flex', 'Smartisan Compact', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'PingFang SC', 'Noto Sans CJK SC', 'Microsoft YaHei', 'sans-serif'],
      },
    },
  },
};
