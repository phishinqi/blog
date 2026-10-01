# 写作后台与图片

主题的写作后台是 [v7-cms](https://github.com/phishinqi/v7-cms)：一个开源的 Git 型编辑器，独立于本主题开发和发布。它读写 `content/` 里的文件，产出的字节和你手工编辑完全一致。

## 三件事，别混起来

用这个模板搭博客时，「v7-cms」其实是三个独立的东西。搞混了就会觉得仓库改名之后编辑器不知道去哪了：

|                      | 是什么                                | 谁决定                                                         | 使用者要改吗                     |
| -------------------- | ------------------------------------- | -------------------------------------------------------------- | -------------------------------- |
| **编辑器二进制**     | `v7-cms.js` + `cms.css`，一个静态文件 | 模板作者钉的版本（`scripts/copy-cms.mjs` 的 `PINNED_VERSION`） | **不用改**，跟你的仓库名无关     |
| **编辑器写哪个仓库** | 你博客的内容仓库                      | `pnpm bootstrap --repo you/your-repo`                          | 要，否则后台会去写模板作者的仓库 |
| **OAuth 中转**       | `functions/api/` 那个 Pages Function  | 你的域名 + 你自己的 GitHub OAuth App                           | 部署时配                         |

第一项是**唯一**跟 `phishinqi/v7-cms` 有关的东西：构建时从那个仓库的 release 下载编辑器。你的仓库叫什么名字都无所谓——`pnpm build` 会自己去拉：

```
https://github.com/phishinqi/v7-cms/releases/download/v0.2.0/v7-cms.js
```

想升级编辑器，改 `scripts/copy-cms.mjs` 里的 `PINNED_VERSION`。想用自己 fork 的编辑器，设 `V7_CMS` 指向本地构建产物。

## 打开后台

```sh
pnpm install
pnpm dev:cms        # 启动站点；后台就在同一个进程里
```

打开 `http://localhost:4321/admin/`。线上从页脚右下角的「写作」链接进入。

不需要额外的本地服务。旧后台那套代理进程已经取消：v7-cms 在浏览器里直接读写你选的文件夹。

第一次打开会让你选一个仓库。**具体给哪些选项，取决于当前用的是哪份配置。**

### 本地与生产配置

后台的配置来自两个文件，生产版替换 `backend`、预览地址，并读取站点中保存的图片存储设置：

| 文件                     | backend                    | 什么时候用            |
| ------------------------ | -------------------------- | --------------------- |
| `cms.config.json`        | `local`（本机文件夹/代理） | `pnpm dev` 本地写作   |
| `cms.config.github.json` | `github`（仓库 API）       | `pnpm build` 线上部署 |

**不要手工维护第二份文件。** 它由 `scripts/cms-config-github.mjs` 从第一份生成，`pnpm build` 会自动跑一次：

```sh
pnpm cms:config     # 手动重新生成
```

生成脚本读取以下登录与仓库环境变量；媒体存储变量见[图片存储与 R2](media-storage.md)。**`pnpm bootstrap` 会把它们的默认值改成你自己的**——下表是脚本出厂时的值，正常情况下你应该看不到它们生效：

| 变量            | 说明                               | 出厂默认值（setup 会改）      |
| --------------- | ---------------------------------- | ----------------------------- |
| `CMS_REPO`      | 编辑器要写的仓库                   | `phishinqi/astro-theme-v7`    |
| `CMS_BRANCH`    | 分支                               | `main`                        |
| `CMS_AUTH_BASE` | OAuth 中转的地址，通常等于你的域名 | `https://v7.soyonagasaki.com` |

跑过 `pnpm bootstrap --repo 你/你的仓库 --url https://你的域名` 之后，这两项就是你的了。想在 CI 里临时覆盖，设同名环境变量即可（例如多环境部署）。

`src/pages/admin/[...path].astro` 按环境选：`astro dev` 用本地那份（直接编辑工作目录），生产构建用 GitHub 那份（部署出去的页面够不到你的硬盘，只能走 API）。

### 三种连接方式

| 方式       | 需要什么                     | 哪些浏览器能用                     |
| ---------- | ---------------------------- | ---------------------------------- |
| 本机文件夹 | 什么都不用                   | Chromium（File System Access API） |
| 本地代理   | `npx @v7-cms/proxy --root .` | 全部                               |
| GitHub     | 一个令牌，或走中转的 OAuth   | 全部                               |

**本机文件夹**最省事：选一次会被记住，编辑直接写进工作目录，`git status` 里立刻能看到改动。权限每次访问会重新申请，这是浏览器的要求。只有本地那份配置会给这个选项。

**GitHub** 是线上用的。部署后的 `/admin/` 只会给这一个入口。用个人访问令牌（fine-grained，只勾这一个仓库、只给 Contents 读写）可以立刻用；想让作者用 GitHub 账号登录，需要下面的 OAuth 配置。

### 线上登录：OAuth 配置

**OAuth App 必须是使用者自己建的。** 它绑定你的域名和你的账号，所以 `pnpm bootstrap` 会把 `wrangler.toml` 里的 `GITHUB_CLIENT_ID` 清成占位符——继承一个看起来是真的、其实是别人的 client id，比留个空占位符危险得多。

用你自己的域名（下面写成 `我的域名`）走一遍：

1. 建 OAuth App：GitHub → Settings → Developer settings → OAuth Apps → **New OAuth App**
   - **Application name**：随意，例如 `我的博客后台`
   - **Homepage URL**：`https://我的域名`
   - **Authorization callback URL**：`https://我的域名/api/callback`
     ⚠️ 这一项必须**逐字符**对得上，包括 `/api` 前缀和结尾不能有斜杠，否则 GitHub 会拒绝回调。
   - 建完拿到 **Client ID**，再 **Generate a new client secret** 拿到 **Client Secret**（只显示一次）
2. 在 Cloudflare Pages 项目里加变量（Settings → Variables and Secrets）：
   | 变量                   | 值                      | 类型               |
   | ---------------------- | ----------------------- | ------------------ |
   | `GITHUB_REPO`          | `你的用户名/你的仓库名` | 明文               |
   | `GITHUB_CLIENT_ID`     | 上一步的 Client ID      | 明文               |
   | `GITHUB_CLIENT_SECRET` | 上一步的 Client Secret  | **Secret（加密）** |
3. 重新部署，然后打开 `https://我的域名/admin/`，应该出现「使用 GitHub 登录」。

`/api/*` 由 `functions/api/[[path]].js` 提供，和站点同域名一起部署，不需要单独的 Worker。它用 `GITHUB_REPO` 检查**登录者对你这个仓库**有没有写权限——所以这一项填错的话，登录会以「没有写权限」失败。

**没配这三项时 `/admin/` 仍能打开**，只是 GitHub 登录会失败。个人访问令牌那条路不需要它们：

1. GitHub → Settings → Developer settings → **Personal access tokens** → Fine-grained tokens → Generate new token
2. **Repository access** 只勾你的博客仓库；**Permissions → Contents** 设为 **Read and write**
3. 打开 `/admin/`，切到 **访问令牌** 标签，粘贴

这条路不用建 OAuth App、不用配环境变量，适合自己一个人用。OAuth 适合有多个作者、或者不想让作者碰令牌的情况。

### 预览与内联编辑

编辑器右侧可以嵌入**真实页面**，并且直接在页面上点击编辑——鼠标划过标题会描边，点一下光标跳到对应的输入框。

预览源按环境自动选：

| 环境       | 预览源                  | 由谁决定                                    |
| ---------- | ----------------------- | ------------------------------------------- |
| `pnpm dev` | `http://localhost:4321` | `cms.config.json` 的 `preview.devServerURL` |
| 部署后     | 站点自己的域名          | 生成器写入，默认等于 `authBase`             |

**部署后预览的是已发布的站点。** 编辑器和站点同源，所以 iframe 能嵌入、桥接脚本能注入，内联编辑和本地一样可用。但要注意：**预览里是你已发布的内容，不是尚未提交的改动**——改完要提交并重新构建，预览才会变。

需要两件事配合，仓库里都已经配好：

1. **`X-Frame-Options: SAMEORIGIN`**（见 `public/_headers`）。原来是 `DENY`，站点连自己都不让嵌，预览 iframe 会被浏览器直接拒绝。改后第三方站点仍然嵌不了。
2. **字段标记在生产也输出**。`PostLayout` 给渲染每个字段的元素加 `data-v7-field="字段路径"`，部署后的编辑器要读的就是这份 HTML。这个属性本身不渲染、不影响样式、也不进 Pagefind 索引。

换预览源用环境变量：

```sh
CMS_SITE_URL=https://v7.soyonagasaki.com pnpm build   # 默认值就是它
CMS_DEV_SERVER_URL=https://dev.example.com pnpm build  # 改指一个远程 dev server
```

生成器**拒绝 `localhost` / `127.0.0.1`** 并直接报错。这个错误编译能过、部署能过，只在访问者的浏览器里炸，所以必须在这里拦住。

### 界面语言

后台界面跟随配置里的 `locale`。本仓库是 `zh-CN`，所以侧边栏、连接页、保存按钮和提示都是中文。改 `locale` 会同时影响本地和线上两份配置（生成脚本会带上）。

界面语言和**内容语言**是两件事：`locale` 只管编辑器自己的文案，文章的多语言字段仍按值里实际存在的语言逐个渲染。

## 正文：两套编辑器

这是换掉旧后台的主要原因之一。富文本编辑器会规范化 Markdown —— 重排强调符号、对齐表格、改围栏风格。这对随笔没问题，对 MDX 是灾难：MDX 里有 `import` 和 JSX，Markdown 编辑器根本不认识。

所以每段正文在打开前会先判定：

| 正文里有                                           | 用什么编辑器 |
| -------------------------------------------------- | ------------ |
| 随笔、标题、列表、链接、图片、普通代码块           | 富文本       |
| MDX 文件、`import`/`export`、JSX、HTML 块          | 源码         |
| 图表围栏（`mermaid`、`abc`）、块级公式、缩进代码块 | 源码         |

判定偏向保守：拿不准就走源码。误判成源码，你只是少了个好看的编辑器；误判成富文本，文件会被悄悄改坏。

实际表现：

- `content/posts/math-and-diagrams.md` 有 mermaid 围栏，走源码
- `content/posts/small-components.mdx` 是 MDX，走源码，`import` 和 `<Note>` 原样保留
- 普通的 `.md` 随笔走富文本，改完存回仍是 Markdown

编辑器旁边有预览：Markdown 预览始终可用，含图表和公式；配置里给了开发服务器地址时，还能用 iframe 嵌真实页面。

## 相册

相册在 `content/albums/`，后台按「相册」集合编辑。每张图可以记录类型（照片 / 创作）、标题、说明、日期、地点、标签、作者、许可，以及相机参数或创作设备。

图片在浏览器中编码为 WebP 并移除元数据，成功写入目标后回填 URL、尺寸及响应式地址；失败时保留原值。可选博客仓库固定目录、R2 或独立媒体仓库，配置与版本要求见[图片存储与 R2](media-storage.md)。原图请自行归档。

## 站点设置

后台的「站点设置 → 全站配置」直接编辑 `site.config.json`：标题、简介、导航、社交链接、每页数量、模块开关和站点的图片存储选项都能在这里改，不用手写 JSON。图片存储选项会在保存、重新部署并刷新后台后切换上传目标。

表单是从文件本身推断出来的 —— 加了新配置项，后台自动多出对应字段，不需要改代码。保存后需要重新构建才会生效。

站点标题、简介、导航文字这类需要中英各一份的字段，后台拆成两个输入框（`zh-CN` 和 `en`）。语言列表来自文件本身，加一门语言不用改配置。

## 界面

界面语言由 v7-cms 自带（`locale`），不需要额外的语言包。外观沿用主题的纸白、陶土色与衬线标题，通过设计令牌配置，不依赖内部类名，升级不会失效。

## 草稿

有两个东西都叫「草稿」，别混：

- **文章头部的 `draft: true`** 是构建期排除标记，站点不会发布它。这是你自己的开关。
- **流程状态**是审核进度。用 GitHub 写作时存在独立分支；用本机文件夹时记在 `.v7-cms/workflow.json`（已加进 `.gitignore`）。

## 维护

- 后台资源是构建产物，由 `scripts/copy-cms.mjs` 从 v7-cms 的 release 复制到 `public/admin/`；该目录不提交。
- 升级编辑器：改 `scripts/copy-cms.mjs` 里的 `PINNED_VERSION` 为一个已发布的版本号。
- 改编辑器本身：`git clone` v7-cms，放到本主题同级的目录，脚本会优先使用本地构建。
- 后台的集合与字段定义在 `cms.config.json`。
- 内容校验仍由主题负责：`src/lib/post-schema.ts` 和 `src/lib/module-schema.ts` 在构建时检查，后台管不到的东西（分类是否存在、slug 是否重复）构建阶段会报错。
