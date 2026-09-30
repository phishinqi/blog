# V7

以阅读为中心的 Astro 博客主题。暖纸白与陶土色、衬线正文、深色模式，以及独立于程序源码的内容目录。

[English](docs/README.en.md) · [写作后台与图片存储](docs/cms.md) · [部署说明](docs/deployment.md) · [主题更新](docs/theme-updates.md) · [验证记录](docs/validation.md)

## 开始

这是一个 **GitHub 模板仓库**。工具链：Node.js **24.16.0**，pnpm **12.5.1**。

### 1. 得到一份自己的副本

点仓库右上角的 **Use this template → Create a new repository**，得到一份干净副本（不带本仓库的提交历史）。

或者克隆：

```sh
git clone https://github.com/phishinqi/astro-theme-v7.git my-blog
cd my-blog
```

### 2. 改成你自己的

```sh
pnpm install
pnpm bootstrap -- --url https://your-domain.com --repo you/your-repo --author you
```

`pnpm bootstrap` 会把**原作者的域名、仓库和作者**换成你的。这一步不能跳过：副本默认带着本仓库的 `siteURL`，不改的话你的 canonical、RSS 和站点地图会声称是别人的域名，写作后台也会直连别人的仓库。

> **没跑 setup 就跑 `pnpm build` 会直接报错**，并告诉你该做什么。这是有意的——这个错误不这么拦，就会一直藏到你发布之后。

| 参数            | 说明                                      |
| --------------- | ----------------------------------------- |
| `--url`         | 你的正式域名，如 `https://example.com`    |
| `--repo`        | 写作后台要写入的仓库，`owner/repo`        |
| `--title`       | 站点标题                                  |
| `--author`      | 作者 id（小写英文，用于文章 frontmatter） |
| `--author-name` | 作者显示名                                |

省略的参数保持原值。随时可以再跑一次改。

### 3. 写你自己的内容

`content/posts/` 里是示例文章，`pnpm bootstrap` 不会删它们——删掉或改写都行。用 `pnpm new:post` 新建：

```sh
pnpm new:post my-first-post tech "我的第一篇文章"
```

### 4. 跑起来

```sh
pnpm dev:cms   # 站点与写作后台在同一个进程里；只看站点用 pnpm dev
```

浏览站点：`http://localhost:4321/`。写作后台：`http://localhost:4321/admin/`，线上从页脚的“写作”进入。后台是 [v7-cms](https://github.com/phishinqi/v7-cms)，在本机文件夹、本地代理和 GitHub 三种方式里选一种，不需要额外的本地服务。搜索需要先构建，再运行 `pnpm preview`。

部署见[部署说明](docs/deployment.md)。

## 内容目录

```text
content/posts/            # Markdown / MDX 文章，递归加载
  tech/astro content.md   # 支持多级目录、中文与空格
  journal/quiet afternoon.md
content/pages/            # about 等独立页面的正文
content/albums/           # 相册（每个相册一个文件，图片信息写在其中）
content/moments/ timeline/ roadmap/   # 其他模块内容
data/                     # 作者、分类、文章标签建议、照片标签、友链
site.config.json          # 文件与后台共用的站点配置
src/                      # 模板、组件、样式、程序逻辑
functions/api/            # Cloudflare Pages Functions：GitHub 登录与可选 R2 图片接口
```

**文件夹只负责整理。** 分类写在文章头部，公开地址由稳定 slug 决定，重命名或移动文件不会改变地址。MDX 组件通过 `@components/Note.astro` 等别名导入，不依赖目录深度。

## 写文章

```sh
pnpm new:post my-first-post tech "我的第一篇文章"
```

新文件默认是草稿。也可以直接创建文件或使用后台。

```yaml
---
title: 我的第一篇文章
description: 一段简短摘要
slug: my-first-post
pubDate: '2026-09-28T09:00:00+08:00'
category: astro
tags: [Astro, 写作]
authors: [v7, guest]
lang: zh-CN
draft: false
featured: false
---
```

- 一篇文章一个分类、多个标签及一位或多位作者。省略 authors 时使用默认作者。
- 分类支持父子关系，上级自动汇总后代文章。目录位置不影响分类。
- slug 必须唯一，包括草稿；发布后保持不变。正文页可复制永久链接。
- `draft: true` 和未来文章不会生成页面，也不进入 RSS、搜索和站点地图。定时内容到期后需重新构建。
- 日期写带时区的 ISO 字符串；纯日期按 UTC 零时处理。
- 普通 Markdown 可在源码与可视化模式间切换；复杂公式、Mermaid、HTML 和 MDX 使用源码模式。后台不执行自定义 MDX 代码。
- 代码高亮、复制、目录、KaTeX 和延迟加载图表保留。文章内容必须是你信任的源码。

## 配置

编辑 `site.config.json` 或后台“站点设置”：标题、简介、默认界面语言、时区、导航、社交链接、每页数量和模块开关。修改后重新构建。

`data/authors.json` 管理作者资料；`data/categories.json` 管理稳定分类 ID 和 parent；`data/tags.json` 管理标签建议，文章标签仍可自由填写；`data/friends.json` 管理友链。删除作者或分类前清理文章引用。

顶部主要入口与“更多”菜单分开配置。演示默认开启全部模块；关闭 features 中的开关会移除模块页面、导航入口、首页预览及后台入口。全站保留普通文章、分类、标签、归档和作者页。

读者用页头的语言菜单（地球图标）在同一个 URL 切换中英文界面，选择保存在本地。增加语言时，在 `src/i18n/ui.ts` 添加词典并在 `languages` 中登记。文章不翻译，关于页显示对应语言版本。搜索引擎和无 JavaScript 浏览器读取站点默认语言。更改默认语言时也要检查你自己的本地化配置文案。

## 图片与相册

`media.provider` 支持 `github`（默认）和 `r2` 二选一。两种模式上传前都会在浏览器里压缩为 WebP 并**移除 EXIF、GPS 等全部元数据**，只保存网页版本，原图请自行归档。详见 [CMS 文档](docs/cms.md)。

相册写在 `content/albums/`，每张图片可以记录类型（照片 / 创作）、标题、说明、日期、地点、标签、作者、许可，以及相机参数或创作设备。后台上传时会用 EXIF 自动填写空白的相机参数和日期，可以随时关闭。

- `/albums/`：相册封面列表。
- `/albums/{slug}/`：瀑布流展示，可以按标签筛选。
- `/photos/`：所有相册的图片按时间汇总，按标签筛选，筛选条件写在 `?tag=` 里，可以分享。
- 鼠标悬停时图片在格子内轻微放大，并显示标题与地点。
- 点击进入全屏查看器：信息面板、滚轮 / 双击 / 双指缩放、拖动、手机滑动切换、键盘 ← → Esc、`#photo-ID` 分享链接。
- 图片懒加载，加载前显示该图的主色。

文章封面使用 `cover: { src, alt, width, height, focal?, caption?, srcset? }`；focal 为 0–100% 的两轴焦点，默认 `50% 50%`。MDX 可导入 `@components/Gallery.astro` 插入网格图组，点开后使用同一个查看器。普通 Markdown 图片仍使用所写 URL，请避免直接引用超大原图。

演示图片由 `pnpm images:demo` 生成，设备与地点是虚构值；替换演示相册后可以删除 `public/images/albums/`。

## 功能页面

- `/friends/`：手动维护、分组展示的友链。
- `/moments/`：文字、图片和链接组成的短动态；首页显示最近三条。
- `/timeline/`：按时间记录已发生的里程碑。
- `/roadmap/`：planned、active、done 三种状态。
- `/albums/`、`/photos/`：相册与全部照片，见上文。
- `/authors/{id}/`：作者介绍与文章分页。

新模块 Markdown 通用字段是 title、slug、date、draft；动态可设置 images，路线图可设置 status，相册字段见 [CMS 文档](docs/cms.md#相册)。模块正文与文章同样排除草稿及未来条目。

统计仅计算公开内容，不采集访客行为。SEO 包括 canonical、分享元信息、多作者结构化数据、RSS、robots 与 sitemap。部署前必须把默认 `https://example.com` 换成你的根域名，主题不预设个人域名。

## 图表与乐谱

文章里的图表写在围栏代码块里，语言名决定用什么渲染。全部**按需加载**：文章里没有这种图，就一个字节都不下载；滚到附近才开始渲染；渲染失败时保留源码，可以展开查看。

| 语言      | 用途                           | 渲染器  |
| --------- | ------------------------------ | ------- |
| `mermaid` | 流程图、时序图、甘特图、状态图 | Mermaid |
| `abc`     | 五线谱（ABC 记谱法）           | abcjs   |

````text
```abc
X:1
T:曲名
M:4/4
L:1/4
K:D
A2 F2 | G2 E2 | D2 F2 | E4 |
```
````

图表跟随明暗主题重画。关掉 JavaScript 时，代码块仍是可读的源码。

新增一种图表语言：在 `src/lib/remark-mermaid.ts` 的 `diagramLanguages` 里加语言名（这样 Shiki 不会把它当普通代码高亮），再在 `src/scripts/article.ts` 的 `renderers` 里加一个渲染函数，懒加载那条链路是共用的。

## 验证

```sh
pnpm exec playwright install chromium
pnpm verify
```

verify 执行类型、lint、格式、单元测试、生产构建和浏览器测试。单元测试覆盖发布规则、分类关系、作者、相册字段与许可和登录 / 图片接口授权；浏览器测试覆盖搜索、交互、瀑布流、查看器、语言菜单、无障碍、链接，以及写作后台能正常挂载。编辑器自身的测试（保真序列化、双轨判定、上传去元数据、工作流）在 v7-cms 仓库里。示例内容测试仍预期 12 篇公开文章，替换示例后需调整相应查询和断言。

主题切换采用柔和颜色过渡；页面切换采用原生文档 View Transitions，浏览器不支持时正常跳转。所有非必要动画遵守减少动态效果偏好。

## 许可与边界

主题代码和技术文档采用 [MIT](LICENSE)。文章、关于页和其他编辑内容不纳入代码许可，详见 [内容许可](CONTENT-LICENSE.md)。示例不陈述真实作者经历。

主题不部署网站、不创建 OAuth App 或 R2 bucket。外部服务接入需要使用者按[部署说明](docs/deployment.md)配置，并在上线前用真实账号联调。
