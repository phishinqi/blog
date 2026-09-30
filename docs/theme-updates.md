# 同步主题更新

使用 GitHub 模板创建博客后，博客仓库和主题仓库是两个独立的 Git 仓库：

- `origin`：你的博客仓库，例如 `https://github.com/phishinqi/blog.git`
- `upstream`：主题仓库，例如 `https://github.com/phishinqi/astro-theme-v7.git`

主题更新应该从 `upstream` 获取，再应用到自己的 `main`，最后推送到 `origin`。这样你的文章、域名和作者配置仍由自己的博客仓库管理。

## 第一次设置

进入博客仓库目录，确认当前目录是自己的博客项目：

```sh
git remote -v
```

如果还没有 `upstream`，添加主题仓库：

```sh
git remote add upstream https://github.com/phishinqi/astro-theme-v7.git
```

确认结果中 `origin` 是你的博客仓库，`upstream` 是主题仓库：

```text
origin    https://github.com/phishinqi/blog.git
upstream  https://github.com/phishinqi/astro-theme-v7.git
```

## 查看主题更新

先下载主题仓库的最新提交：

```sh
git fetch upstream
```

查看自己的 `main` 尚未包含哪些主题提交：

```sh
git log --oneline main..upstream/main
```

先阅读提交内容，再决定是否同步。主题提交可能只涉及代码，也可能涉及示例内容、配置或文档。

## 选择性同步

多数情况下，选择性同步单个修复最安全：

```sh
git switch main
git branch backup-before-theme-update
git cherry-pick <commit-id>
git push origin main
```

例如：

```sh
git cherry-pick cf268dc
git push origin main
```

一次同步多个连续提交时，可以使用：

```sh
git cherry-pick <oldest-commit>^..<newest-commit>
```

备份分支只是一个本地指针，不会修改线上博客；确认更新正常后可以保留或删除它。

## 出现冲突时

`cherry-pick` 如果提示冲突，先打开冲突文件，保留自己的内容并合并主题代码，然后执行：

```sh
git add <已解决的文件>
git cherry-pick --continue
git push origin main
```

如果决定放弃本次同步：

```sh
git cherry-pick --abort
```

## 不要重复运行 bootstrap

`pnpm bootstrap` 是新副本的初始化命令，用来设置域名、仓库和默认作者。博客完成初始化并开始写作后，不要为了同步主题更新再次运行它，因为它可能重写：

- `site.config.json` 中的域名和默认作者
- `data/authors.json`
- 文章 frontmatter 中的作者 id
- CMS 仓库配置

同步主题更新只需要使用 Git 的 `fetch`、`log` 和 `cherry-pick`，然后推送到自己的 `origin`。

## 更新后的检查

推送前建议运行：

```sh
pnpm check
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm test:e2e
```

推送后，检查自己博客仓库的 GitHub Actions。部署平台通常会在 `main` 更新后自动重新构建。
