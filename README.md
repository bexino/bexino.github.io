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

- 底部 Bottom Navigation（始终显示）：主页 `#/`、仓库 `#/repo`、我的 `#/me`。
- 顶部 App Bar：始终显示，标题随页面切换。
- 图标：`vite.config.js` 的 `ICONS` 列表统一维护，构建时从 `@material-design-icons/svg` 生成 `public/icons-sprite.svg`。

## 部署

### 本地拉取主页信息

需要 Node.js 20.19+ 或 22.12+。在本仓库目录执行（脚本本身不依赖 npm 包）：

```bash
npm run fetch-home-data
npm run dev
```

脚本拉取 GitHub 用户资料、`bexino/bexino` 的 `main/README.zh-CN.md` 和其中的
ghstats mini 徽章，写入 `public/cache/`，日志显示来源、README blob SHA 与徽章成功数。
优先读取 GitHub Contents API，失败后依次尝试 raw 和 CDN 镜像；CDN 可能有更新延迟。
可通过环境变量 `GITHUB_TOKEN` 或 `GH_TOKEN` 提高 API 请求额度，令牌只发送给 GitHub API。
每次运行会先清空旧缓存，拉取失败也不会恢复旧文件；请先确认本机可以访问 GitHub。

网站只展示中文 README，更新英文 `README.md` 不会改变中文简介。
浏览器优先读取远程镜像，本地文件仅作为失败回退，因此拉取后页面仍可能显示镜像缓存。
ghstats 的 card / langs 图片仍直接访问外部服务，不在此脚本的 mini 徽章缓存范围内。

本地拉取不会更新线上网站。确认结果后提交并推送本仓库的 `public/cache/`，触发部署。
`bexino/bexino` 的提交不会直接触发本网站仓库的工作流；定时拉取为每天北京时间 00:00，
也可在本网站仓库 Actions 中手动运行 **Cache homepage data**。

主页数据由 `.github/workflows/cache.yml` 定时或手动拉取。每次执行先删除
`public/cache/` 中的全部旧数据，再写入本次成功获取的资料、README 和徽章，
不会合并或回用旧文件。拉取失败也会提交清理结果，并保留 Action 的失败状态。

### GitHub Pages（自动）

推送到 `main` 即触发 `.github/workflows/deploy.yml`。首次使用需在仓库 **Settings → Pages → Source** 选择 **GitHub Actions**。

### Cloudflare Pages（自动，重点）

1. Cloudflare Dashboard → Workers & Pages → 创建 Pages 项目 → 连接本 Git 仓库。
2. 构建设置：
   - 框架预设：**Vite**
   - 构建命令：`npm run build`
   - 输出目录：`dist`
3. 保存后每次推送 `main` 自动部署。
