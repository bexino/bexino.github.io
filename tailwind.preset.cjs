/**
 * Smartisan OS UI — Tailwind CSS preset (v3 `presets: [...]`; for v4 copy the
 * values into an `@theme` block). Values mirror assets/smartisan.css / tokens.json.
 * Component styling still lives in smartisan.css; this preset gives you the
 * tokens as utilities (bg-s-grey-100, rounded-s-lg, shadow-s-card, ...).
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        s: {
          white: '#ffffff',
          grey: { 100: '#fafafa', 200: '#f2f2f2', 300: '#eeeeee', 400: '#e2e2e2', 500: '#bababa', 600: '#9d9d9d', 700: '#7f7f7f', 800: '#636363', 900: '#333333' },
          blue: { 100: '#e7edfd', 200: '#a0b9f4', 300: '#5985eb', 400: '#5079d9', 500: '#3f68e2', 600: '#2f54d7', pressed: '#4772e6', top: '#5b87eb', bottom: '#5883eb' },
          // Semantic README accents supplement the kit's blue/yellow/red palette.
          alert: { tip: require('tailwindcss/colors').green[700], important: require('tailwindcss/colors').purple[600] },
          page: '#f5f5f5',
          'page-real': '#f0f0f0',
          // Semantic aliases from smartisan.css Tab Bar and SPalette (no new palette).
          bar: 'rgb(255 255 255)',
          control: { top: 'rgb(255 255 255)', bottom: 'rgb(252 252 252)', border: 'rgb(238 238 238)', 'pressed-top': 'rgb(235 235 235)', 'pressed-bottom': 'rgb(242 242 242)' },
          tab: { frame: 'rgb(255 255 255)', text: 'rgb(99 99 99)', selected: 'rgb(178 178 178)', 'selected-bottom': 'rgb(178 178 178)', border: 'rgb(167 167 167)' },
          'sheet-body': '#efefef',
          'dialog-action': '#f7f7f7',
          'dialog-action-pressed': '#dfdfdf',
          'dialog-action-text': '#5e80d0',
          'appbar-border': '#d8d8d8',
          red: { top: '#cd3f3a', bottom: '#c83530', border: '#b7241f', icon: '#e5645a', stroke: '#da463e' },
          text: { body: '#656565', desc: '#797979', placeholder: '#d9d9d9' },
          icon: { DEFAULT: '#929292', disabled: '#c7c7c7', chevron: '#b2b2b2', blue: '#5c89f2' },
          toast: { top: '#fcf6e6', bottom: '#fcf3dc', border: '#d2b89c', text: '#ad8a67' },
          chip: {
            'white-bg': '#fafafa', 'white-border': '#cecece', 'white-text': '#646464',
            'yellow-bg': '#fff5d9', 'yellow-border': '#ccb08c', 'yellow-text': '#cd9143',
            'blue-border': '#93b2f7', 'blue-text': '#6393ff',
            'red-bg': '#ffe7e5', 'red-border': '#eb7f77', 'red-text': '#cc3e39',
            'grey-bg': '#f0f0f0', 'grey-border': '#dadada'
          }
        }
      },
      backgroundImage: {
        's-primary': 'linear-gradient(180deg,#5b87eb,#5883eb)',
        's-white': 'linear-gradient(180deg,#ffffff,#fcfcfc)',
        's-white-pressed': 'linear-gradient(180deg,#ebebeb,#f2f2f2)',
        's-red': 'linear-gradient(180deg,#e5645a,#e55f55)',
        's-appbar-red': 'linear-gradient(180deg,#cd3f3a,#c83530)',
        's-segment': 'linear-gradient(180deg,#4878f0,#6997f4)',
        's-sheet-header': 'linear-gradient(180deg,#ffffff,#fafafa)',
        's-toast': 'linear-gradient(180deg,#fcf6e6,#fcf3dc)',
        's-icon': 'linear-gradient(180deg,#8c8c8c,#989898)',
        's-kit-header': 'linear-gradient(90deg,#222325 0%,#3b3c3f 49%,#222325 100%)'
      },
      borderRadius: { 's-segment': '3px', 's-sm': '4px', 's-md': '6px', 's-sheet-btn': '8px', 's-lg': '10px', 's-dialog': '12px', 's-sheet': '20px', 's-kit': '40px', 's-pill': '100px' },
      borderWidth: { 's-xs': '0.4px', 's-sm': '0.5px', 's-md': '0.8px' },
      boxShadow: {
        's-card': '0 10px 16px rgba(0,0,0,0.04)',
        's-card-sm': '0 2px 6px rgba(0,0,0,0.06)',
        's-bar': '0 4px 4px rgba(0,0,0,0.08)',
        's-knob': '0 5px 16.6px rgba(0,0,0,0.21)',
        's-knob-sm': '0 4px 4px rgba(0,0,0,0.12)',
        's-thumb': '0 4px 4px rgba(0,0,0,0.08)',
        's-slider-thumb': '0 4px 8px rgba(0,0,0,0.16)',
        's-inset-track': 'inset 0 4px 4px rgba(0,0,0,0.06)',
        's-inset-switch': 'inset 0 4px 12px rgba(0,0,0,0.10)',
        's-inset-well': 'inset 0 4px 12px rgba(0,0,0,0.18)',
        's-inset-field': 'inset 0 4px 4px rgba(0,0,0,0.04)',
        's-inset-tab': 'inset 0 4px 10px rgba(0,0,0,0.06)',
        's-inset-swipe': 'inset 0 0 4px rgba(0,0,0,0.16)'
      },
      dropShadow: {
        's-btn': '0 4px 2px rgba(0,0,0,0.10)',
        's-dialog-actions': '0 4px 2.1px rgba(0,0,0,0.07)',
        's-bar': '0 4px 4px rgba(0,0,0,0.08)'
      },
      fontFamily: { s: ['Smartisan Compact', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'PingFang SC', 'Noto Sans CJK SC', 'Source Han Sans SC', 'Hiragino Sans GB', 'Noto Sans SC', 'Microsoft YaHei', 'sans-serif'] },
      fontSize: { 's-nav': '8px', 's-12': '12px', 's-14': '14px', 's-16': '16px', 's-18': '18px', 's-48': '48px' },
      spacing: { 's-screen': '432px', 's-row': '60px', 's-bar': '48px', 's-action': '54px' }
    }
  }
};

// Keep all existing utilities and theme() references on one adaptive palette.
// Dark neutrals follow smartisan-ui's SPalette.dark (the kit itself is light).
const palette = module.exports.theme.extend;
const light = {};
function adaptiveColors(colors, path = []) {
  return Object.fromEntries(Object.entries(colors).map(([key, value]) => {
    const parts = [...path, key];
    if (typeof value === 'object') return [key, adaptiveColors(value, parts)];
    const name = `--s-${parts.join('-')}`;
    light[name] = value;
    return [key, `var(${name})`];
  }));
}
palette.colors.s = adaptiveColors(palette.colors.s);
// Foreground on selected controls stays white in both themes.
palette.colors.s['on-selected'] = light['--s-white'];
const dark = {
  '--s-bar': 'rgb(30 30 30)',
  // Raised neutral controls: SPalette.dark knobTop/Bottom and knobPressedTop/Bottom.
  '--s-control-top': 'rgb(74 74 74)', '--s-control-bottom': 'rgb(60 60 60)',
  '--s-control-border': 'rgb(46 46 46)',
  '--s-control-pressed-top': 'rgb(53 53 53)', '--s-control-pressed-bottom': 'rgb(58 58 58)',
  '--s-tab-frame': 'rgb(38 38 38)', '--s-tab-text': 'rgb(154 154 154)',
  '--s-tab-selected': 'rgb(74 74 74)', '--s-tab-selected-bottom': 'rgb(64 64 64)',
  '--s-tab-border': 'rgb(60 60 60)',
  '--s-white': 'rgb(34 34 34)', '--s-page': 'rgb(22 22 22)',
  '--s-page-real': 'rgb(25 25 25)',
  '--s-grey-100': 'rgb(26 26 26)', '--s-grey-200': 'rgb(44 44 44)',
  '--s-grey-300': 'rgb(46 46 46)', '--s-grey-400': 'rgb(51 51 51)',
  '--s-grey-500': 'rgb(74 74 74)', '--s-grey-600': 'rgb(154 154 154)',
  '--s-grey-700': 'rgb(189 189 189)', '--s-grey-800': 'rgb(196 196 196)',
  '--s-grey-900': 'rgb(226 226 226)',
  '--s-text-body': 'rgb(189 189 189)', '--s-text-desc': 'rgb(154 154 154)',
  '--s-text-placeholder': 'rgb(126 126 126)',
  '--s-icon-DEFAULT': 'rgb(156 156 156)', '--s-icon-disabled': 'rgb(126 126 126)',
  '--s-icon-chevron': 'rgb(154 154 154)',
  '--s-blue-300': 'rgb(106 147 240)', '--s-blue-400': 'rgb(127 162 242)',
  '--s-appbar-border': 'rgb(46 46 46)', '--s-sheet-body': 'rgb(26 26 26)',
  '--s-dialog-action': 'rgb(42 42 42)', '--s-dialog-action-pressed': 'rgb(51 51 51)',
  '--s-dialog-action-text': 'rgb(127 162 242)',
  '--s-alert-tip': require('tailwindcss/colors').green[400],
  '--s-alert-important': require('tailwindcss/colors').purple[400],
};
// Surfaces are flat. Only raised controls receive the subtle kit gradient.
delete palette.backgroundImage['s-white'];
palette.backgroundImage['s-control'] = 'linear-gradient(180deg,var(--s-control-top),var(--s-control-bottom))';
palette.backgroundImage['s-tab-selected'] = 'linear-gradient(180deg,var(--s-tab-selected),var(--s-tab-selected-bottom))';
palette.boxShadow['s-tab-selected'] = 'inset 0 4px 10px rgba(0,0,0,0.06), inset 0 0 0 0.4px var(--s-tab-border)';
palette.backgroundImage['s-white-pressed'] = 'linear-gradient(180deg,var(--s-grey-300),var(--s-grey-200))';
palette.backgroundImage['s-sheet-header'] = 'linear-gradient(180deg,var(--s-white),var(--s-grey-100))';
palette.backgroundImage['s-control-pressed'] = 'linear-gradient(180deg,var(--s-control-pressed-top),var(--s-control-pressed-bottom))';
module.exports.plugins = [require('tailwindcss/plugin')(({ addBase }) => {
  addBase({ ':root': { ...light, 'color-scheme': 'light' },
    ':root[data-theme="dark"]': { ...dark, 'color-scheme': 'dark' } });
})];
