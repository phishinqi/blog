# V7

A reading-focused Astro theme with warm paper colors, dark mode, Markdown/MDX, Git-based editing and optional content modules.

## Start

This repository is a **GitHub template**. Use Node 24.16.0 and pnpm 12.5.1.

### 1. Get your own copy

Click **Use this template → Create a new repository** to get a clean copy without this
repository's history, or clone it:

```sh
git clone https://github.com/phishinqi/astro-theme-v7.git my-blog
cd my-blog
```

### 2. Make it yours

```sh
pnpm install
pnpm bootstrap -- --url https://your-domain.com --repo you/your-repo --author you
```

`pnpm bootstrap` replaces the template author's domain, repository and author with yours. Skipping it
is not harmless: a copy carries the original `siteURL`, so your canonical URLs, RSS and sitemap
would claim their domain and the editor would write to their repository.

`pnpm build` fails with an explanation until this has run, on purpose — the mistake is invisible
locally and permanent once published.

| Flag            | Meaning                                           |
| --------------- | ------------------------------------------------- |
| `--url`         | Your public origin, e.g. `https://example.com`    |
| `--repo`        | Repository the editor writes to, `owner/repo`     |
| `--title`       | Site title                                        |
| `--author`      | Author id, lowercase, used in content frontmatter |
| `--author-name` | Author display name                               |

Omitted flags keep their current value, and you can run it again at any time.

### 3. Write, then run

The sample posts in `content/posts/` are left alone for you to replace. Then:

```sh
pnpm dev:cms
```

Open `http://localhost:4321/` for the site and `http://localhost:4321/admin/` for the editor
(`pnpm dev` alone serves only the site). On a deployed site the editor is linked as "Write" in the
footer. It writes directly to the working directory; do not expose its proxy to the Internet.

Use `pnpm build` and `pnpm preview` to test real Pagefind search. Run `pnpm verify` for the complete checks.

## Content and settings

All editorial content lives in `content/`: articles in `content/posts/` (nested folders, spaces and Unicode filenames are fine), independent pages such as About in `content/pages/`, and moments, timeline, roadmap and albums in their own subfolders. Application code stays under `src/`.

Folder organization is independent of frontmatter categories. Public article URLs use the stable slug. Use `pnpm new:post stable-slug folder "Title"` to create a draft. MDX component imports can use `@components/Note.astro` and `@components/Gallery.astro` regardless of folder depth.

Edit `site.config.json` or the CMS settings form. Both use the same data: title, descriptions, default locale, time zone, navigation, social links, pagination, module switches, CMS and media settings. Set a real siteURL before deployment. Author/category/friend registries live in `data/`; tags.json supplies editorial suggestions without restricting article tags.

A post has one category, multiple tags and one or more author IDs. Missing authors fall back to defaultAuthor. Parent categories aggregate descendant posts. Changing category parents or file paths does not change stable public IDs. Invalid parents, cycles, authors and duplicate slugs fail the build.

Use explicit ISO dates with time zones. Draft and future content is excluded from public routes, feeds, sitemap and search. Future content still needs a later rebuild.

## Editing and media

Writing happens in [v7-cms](https://github.com/phishinqi/v7-cms), a separate editor that this theme does not bundle. `pnpm build` copies its two build artifacts into public/admin and the admin page mounts them; the editor itself never ships with the site. Plain Markdown supports source and visual editing, and the editor picks the mode per file. Complex markup, equations and Mermaid use source mode; MDX always uses source editing and is not executed inside the preview.

GitHub media is the default: uploads live in public/images/uploads. R2 is optional. Set media.provider to github or r2; switching does not migrate old images. Never put secrets in site.config.json.

Both modes process images in the browser before upload: JPEG/PNG/WebP up to 20 MB and 40 megapixels are re-encoded as WebP, which **discards EXIF, GPS and all other metadata**. Repository uploads become one image of at most 2400 px on the long edge; R2 receives 480/960/1600/2400 px variants. Only web versions are stored, so keep your originals elsewhere. For album photos, EXIF is read once to fill in blank fields (camera, lens, focal length, aperture, shutter, ISO, software, date). Values typed by hand are never overwritten; a checkbox turns this off per browser and `media.exifPrefill: false` turns it off site-wide.

GitHub login and the R2 media API are Cloudflare Pages Functions under `functions/api/`, deployed with the site on the same origin. See [deployment](deployment.md) for the OAuth App, variables and the R2 binding, and [CMS integration](cms.md) for fields and workflow. The production workflow saves drafts to branches and merges on publication. The draft frontmatter flag is an additional exclusion rule: clear and save it before publishing. Local proxy mode does not emulate Git branches.

## Albums

Albums live in `content/albums/`. Each photo can record its kind (photograph or artwork), title, caption, date, a plain-text location, tags from `data/photo-tags.json` (kept apart from article tags), author, license (overriding the site default in `media.license`), camera settings or the device, software and medium used to make it.

- `/albums/` lists albums; `/albums/{slug}/` shows one as a masonry grid with tag filters.
- `/photos/` gathers every photo, newest first; the tag filter is kept in `?tag=` so it can be shared.
- Hovering enlarges an image slightly inside its tile and reveals its title and location.
- Clicking opens a full-screen viewer with a details panel, wheel/double-click/pinch zoom, panning, swipe navigation, ← → and Esc, and `#photo-ID` links for single photos.
- Images load lazily over their dominant colour.

Article covers support focal positioning, captions and responsive variants. MDX can use `@components/Gallery.astro` for a simple grid that opens in the same viewer. Images in ordinary Markdown keep their original URL; upload appropriately sized images. The demonstration images are generated by `pnpm images:demo`; their camera details and places are fictional.

## Reading experience

Readers switch Chinese/English interface text at the same URL from the globe menu in the header. To add a language, add a dictionary in `src/i18n/ui.ts` and list it in `languages`. Articles are not translated; the About page selects its corresponding language. Search engines and no-JavaScript browsers receive the default locale. All new modules can be individually disabled, removing their routes and entry points.

Theme colors transition softly. Native cross-document View Transitions provide page fades where supported, with normal navigation elsewhere. Reduced-motion preferences disable nonessential animation. Statistics describe published content only; no visitor tracking is installed.

## License and delivery boundary

Theme code and technical documentation use MIT. Article and editorial content is excluded; see [content licensing](../CONTENT-LICENSE.md). The theme does not deploy a site or create an OAuth App or R2 bucket for you. Mocked service tests do not substitute for a live check with real accounts before launch.
