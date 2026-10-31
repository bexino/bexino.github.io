// URL is the source of truth; query parameters survive all hash routes.
const EN = {
  "关于": "About",
  "项目": "Projects",
  "设置": "Settings",
  "返回": "Back",
  "访问 GitHub 仓库（新窗口）": "View GitHub repository (new window)",
  "访问 GitHub": "View on GitHub",
  "加载中…": "Loading…",
  "外观": "Appearance",
  "跟随系统": "System",
  "亮色": "Light",
  "暗色": "Dark",
  "数据来源": "Data source",
  "缓存": "Cache",
  "直连": "Direct",
  "正在连接 GitHub": "Connecting to GitHub",
  "GitHub 请求失败或已达到访问频率限制，请稍后重试。": "GitHub request failed or the rate limit was reached. Please try again later.",
  "语言": "Language",
  "个人资料暂不可用，请稍后重试。": "Profile unavailable. Please try again later.",
  "主页简介暂不可用，请稍后重试。": "Introduction unavailable. Please try again later.",
  "重新加载": "Reload",
  "缓存暂不可用": "Cache unavailable",
  "缓存格式无效": "Invalid cache format",
  "详情缓存无效": "Invalid repository cache",
  "重试": "Retry",
  "返回仓库分类": "Back to categories",
  "仓库分类": "Repository categories",
  "暂无仓库": "No repositories",
  "这个分类还没有公开仓库。": "This category has no public repositories yet.",
  "暂无简介": "No description available",
  "仓库信息": "Repository info",
  "许可证": "License",
  "保留所有权利": "All rights reserved",
  "目录": "Contents",
  "下载": "Download",
  "在线体验": "Live demo",
  "暂无自述文件": "No README available",
  "地址无效": "Invalid address",
  "无法解析仓库地址。": "Unable to parse the repository address.",
  "正在读取仓库缓存": "Loading repository cache",
  "分类不存在": "Category not found",
  "请选择上方分类，或返回默认分类。": "Choose a category above or return to the default category.",
  "仓库不存在": "Repository not found",
  "该仓库不在当前分类中。": "This repository is not in this category.",
  "暂时无法加载": "Unable to load",
  "仓库缓存尚未生成或读取失败，请稍后重试。": "Repository cache is unavailable. Please try again later.",
  "关闭": "Close",
  "自述文件暂无标题": "This README has no headings",
  "未命名章节": "Untitled section",
  "纯文本": "Plain text",
  "复制": "Copy",
  "复制代码": "Copy code",
  "已复制": "Copied",
  "代码已复制": "Code copied",
  "复制失败，请重试或手动选择代码复制": "Copy failed. Try again or select and copy the code manually.",
  "表格，可横向滚动": "Table, scroll horizontally",
  "值日分配系统。": "Duty assignment system.",
  "静态提示词浏览站点。": "Static prompt browsing site.",
  "Linux 输入法解决方案。": "Input method solution for Linux.",
  "修复 Flatpak 版 QQ 音乐显示问题。": "Fixes display issues in the Flatpak version of QQ Music."
};

export function languageFromUrl(url) {
  return new URL(url).searchParams.get('lang') === 'en' ? 'en' : 'zh-CN';
}
export function languageUrl(url, language) {
  const next = new URL(url);
  if (language === 'en') next.searchParams.set('lang', 'en');
  else next.searchParams.delete('lang');
  return next;
}
export function getLanguage() { return languageFromUrl(location.href); }
export function t(text) { return getLanguage() === 'en' ? (Object.hasOwn(EN, text) ? EN[text] : text) : text; }
export function translatePage() {
  document.documentElement.lang = getLanguage();
  document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach(node => { node.title = t(node.dataset.i18nTitle); });
  document.querySelectorAll('[data-i18n-label]').forEach(node => { node.setAttribute('aria-label', t(node.dataset.i18nLabel)); });
  document.querySelectorAll('input[name="language"]').forEach(input => { input.checked = input.value === getLanguage(); });
}
