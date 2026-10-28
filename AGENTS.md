# AGENTS.md

This file provides guidance to Codex (claude.ai/code) when working with code in this repository.

## 项目

个人集合网站（Smartisan OS UI 风格），单页 hash 路由，部署到 GitHub Pages 与 Cloudflare Pages。

## 命令

```bash
npm run dev      # Vite 开发服务器 (localhost:5173)
npm run build    # 构建到 dist/
npm run preview  # 预览构建产物
```

无测试、无 lint。

## 架构

- **单页应用，无框架**：`index.html` 内含 App Bar、5 个预建的 `<section>` 视图（各 tab 一个，iframe 页的 iframe 常驻、只加载一次）和 Bottom Navigation。`src/main.js` 监听 `hashchange`，解析 `#/repo`、`#/pt`、`#/sched`、`#/me`（无 hash → 主页），切换 section 显隐、更新底栏 `aria-current` 和顶栏标题。
- **iframe 页约定**：`pt`（提示词）和 `sched`（排班）两个 tab 内嵌外部站点；这两个 tab 隐藏自有 App Bar，Bottom Navigation 永远显示。`src/main.js` 的 `IFRAME_TABS` 集合控制此行为。
- **Tailwind v3 + smartisan-ui preset**：`tailwind.preset.cjs` 是 Smartisan OS UI Kit 的官方 preset（`.cjs` 后缀是必需的——package.json 为 `"type": "module"`，PostCSS 以 CJS 加载它）。**禁止硬编码圆角、HEX 色值**，一律用 preset 的工具类（`bg-s-grey-100`、`rounded-s-lg`、`shadow-s-card`、`border-s-md`…），否则 preset 失效。
- **图标**：构建时由 `vite.config.js` 的 `mdi-sprite` 插件从 `@material-design-icons/svg`（filled）生成 `public/icons-sprite.svg`（`<symbol id="si-*">`）。新增图标只需往该文件的 `ICONS` 数组加名字，运行时用 `<svg class="md-icon"><use href="./icons-sprite.svg#si-名字"/></svg>`。
- **字体**：Geist VF，来自 `@fontsource-variable/geist`，在 `src/main.css` 的 `@font-face` 声明，置于 `tailwind.config.js` 的 `font-s` 栈首位。
- **路径**：`vite.config.js` 设 `base: './'`（相对路径），保证 GitHub Pages 和 Cloudflare Pages 均可用。

## 部署

推送 `main` 触发 `.github/workflows/deploy.yml`（GitHub Pages，需仓库 Settings → Pages 选 "GitHub Actions"）。Cloudflare Pages 通过 Dashboard 连接仓库自动部署（框架预设 Vite、输出 `dist`），见 README。

## 设计规范

遵循 `smartisan-ui` skill（Smartisan OS 风格）：灰阶文字体系、0.4–0.8px 细描边、低饱和强调色、渐变/内凹质感、无 Material ripple。暂不适配深色模式。内容区 `max-w-s-screen`（432px）居中；布局保持 flex 结构，为后期响应式留余地。
