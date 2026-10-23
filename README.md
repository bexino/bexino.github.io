# bexino.github.io

个人集合网站（Smartisan OS 风格）。Vite + Tailwind CSS v3（smartisan-ui preset）。

## 开发

```bash
npm install
npm run dev      # 开发服务器
npm run build    # 构建到 dist/
npm run preview  # 预览构建产物
```

## 结构

- 底部 Bottom Navigation（始终显示）：主页 `#/`、仓库 `#/repo`、提示词 `#/pt`（iFrame）、排班 `#/sched`（iFrame）、我的 `#/me`。
- 顶部 App Bar：仅非 iFrame 页显示，标题随页面切换。
- 图标：`vite.config.js` 的 `ICONS` 列表统一维护，构建时从 `@material-design-icons/svg` 生成 `public/icons-sprite.svg`。

## 部署

### GitHub Pages（自动）

推送到 `main` 即触发 `.github/workflows/deploy.yml`。首次使用需在仓库 **Settings → Pages → Source** 选择 **GitHub Actions**。

### Cloudflare Pages（自动，重点）

1. Cloudflare Dashboard → Workers & Pages → 创建 Pages 项目 → 连接本 Git 仓库。
2. 构建设置：
   - 框架预设：**Vite**
   - 构建命令：`npm run build`
   - 输出目录：`dist`
3. 保存后每次推送 `main` 自动部署。
