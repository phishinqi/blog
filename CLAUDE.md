# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

V7 is a static Astro 7 blog theme (React islands, Tailwind 4) published as a reusable theme repository (`phishinqi/astro-theme-v7`). Writing happens in [v7-cms](https://github.com/phishinqi/v7-cms), a separate editor repository consumed here as a build artifact. User-facing docs and most UI copy are in Chinese; `docs/README.en.md` is the English README.

## Commands

Toolchain is pinned: Node 24.16.0, pnpm 12.5.1 (`pnpm install --frozen-lockfile`).

```sh
pnpm dev:cms        # same as `pnpm dev`; writing editor at http://localhost:4321/admin/
pnpm dev            # site + editor, no proxy process needed
pnpm build          # copy-cms (editor bundle → public/admin/) + astro build + Pagefind index
pnpm preview        # serve dist/ — search only works after build + preview
pnpm check          # astro check (types)
pnpm lint           # eslint, --max-warnings 0
pnpm format:check   # prettier (pnpm format to fix)
pnpm test           # vitest unit tests (tests/unit)
pnpm test:e2e       # playwright; starts preview itself, needs a prior build
pnpm verify         # check + lint + format:check + test + build + test:e2e (what CI runs)
pnpm test:variants  # rebuilds with features disabled / English / R2; temporarily rewrites site.config.json
pnpm new:post <slug> [folder] [title]   # new draft in content/posts/
pnpm images:demo    # regenerates demo album images in public/images/albums/
```

Single tests: `pnpm exec vitest run tests/unit/photos.test.ts -t "licenses"`, `pnpm exec playwright test tests/e2e/photos.spec.ts:75`.

E2E port: `V7_TEST_PORT` (preview, default 4321). Playwright reuses a server already listening on that port (outside CI), so a dev server from another checkout gets reused silently. Only one `astro preview` per project root can run at a time (lock file). The editor e2e test seeds nothing — it asserts the `/admin/` route mounts, which is all the theme can verify without the editor's own toolchain.

`pnpm format:check` covers everything, including `content/`, so an unformatted post fails CI.

## Architecture

**Content is separate from code.** Everything editorial lives in `content/` (`posts/`, `pages/`, `moments/`, `timeline/`, `roadmap/`, `albums/`). Registries live in `data/` (authors, categories with `parent`, article tag suggestions, photo tags, friends), and site settings in `site.config.json`. The v7-cms editor edits all three through the same files — collections come from `cms.config.json`, and the settings collection derives its own form from the file (see **Editor / v7-cms**). `src/content.config.ts` defines the collections (glob loaders). Post folder location never determines a post's URL or category: URLs come from the stable frontmatter `slug`, and the category comes from frontmatter.

**Validation happens at build time and is strict.** `src/site.config.ts` parses `site.config.json` and the `data/` registries with zod. It throws on duplicate IDs, category cycles and unknown default authors. Schemas are in `src/lib/post-schema.ts` (the `contentDate` helper requires ISO dates with explicit timezones) and `src/lib/module-schema.ts` (albums and photos; blank CMS values `''`/`null` are stripped before validation). Unknown tags, authors or licenses fail the build. Draft and future-dated entries are excluded everywhere: `src/lib/content.ts`, `src/lib/posts.ts` and `moduleEntries()` in `src/lib/modules.ts`.

**Feature flags.** `features.*` in `site.config.json` removes a module's routes, nav entries, home previews, CMS collections and sitemap entries. `enabledHref()` maps nav hrefs to flags; `/photos/` belongs to `albums`. `cms.enabled: false` removes `/admin/` and the footer "写作" link. `scripts/check-variants.mjs` asserts these removals.

**i18n swaps text on the client at one URL.** The HTML is rendered in `siteConfig.locale`. `src/i18n/client.ts` `applyLocale()` then walks the DOM and swaps any text node matching a string in `src/i18n/ui.ts` dictionaries or a `{ 'zh-CN', en }` value in config and registries. Elements marked `data-no-translate`, `data-content`, `#article-body` or `[data-locale-content]` are skipped; `[data-localized]` holds JSON, and `[data-i18n]` holds a dictionary key. Articles are never translated. When you add UI strings, add the key to both `zh` and `en` in `ui.ts`, and keep user content inside `data-content` so it cannot collide with a dictionary string. Languages for the switcher come from `languages` in `ui.ts`.

**Albums pipeline.** `src/lib/photos.ts` `getAlbums()` resolves each photo in this order:

1. ID: `photoId()` in `src/lib/photo-id.ts` uses the file name, or a hash for generated R2 names. IDs must be unique across all albums because they form the `#photo-<id>` deep links.
2. Author: the photo's own, else the album's, else the default author.
3. License: the photo's own, else `media.license`, via `src/lib/licenses.ts`.
4. Placeholder colour: sharp computes it at build time for local files.

`src/components/PhotoGrid.astro` renders the masonry list and embeds the viewer data as JSON (`script[data-viewer-items]`). `src/lib/image-sources.ts` builds srcsets for local images through `astro:assets`; R2 images already carry a srcset. Client code: `src/scripts/masonry.ts` does shortest-column absolute positioning (the no-JS fallback is CSS columns) plus the `?tag=` filter, and `src/scripts/viewer.ts` is a single shared `<dialog>` viewer that `register()`s any container with `[data-viewer-item]` links. `Gallery.astro` (MDX and moments) reuses the same viewer.

**Editor / v7-cms.** The theme does not contain the editor. [v7-cms](https://github.com/phishinqi/v7-cms) builds `v7-cms.js` + `cms.css` and this repo consumes them as a build artifact. `scripts/copy-cms.mjs` tries three sources in order — `V7_CMS` if set, a sibling checkout at `../v7-cms/packages/cms/dist`, then the release pinned by `PINNED_VERSION` — and fails loudly, because a silent skip shipped a `/admin/` page pointing at files that were not there. `public/admin/` is git-ignored and rebuilt by both `pnpm dev` and `pnpm build`; bump `PINNED_VERSION` to pick up editor changes, and cut a matching release in the editor repo first.

`src/pages/admin/[...path].astro` is the only theme-side surface. It inlines `cms.config.json` into a `#v7-config` JSON script and calls `mount({ container, config })`. `getStaticPaths()` returns `[]` when `cms.enabled` is false, which is how the feature flag removes the route; the footer "写作" link follows the same flag.

`cms.config.json` is the theme's editor contract, and it must stay in step with the zod schemas:

- `backend` picks how the editor reads and writes. `local` with `{ kind: 'fs-access' }` edits the working tree through the File System Access API — this is the default because it needs no server and no OAuth. The other backends (`github`, `proxy`) are documented in `docs/cms.md`.
- Field collections cover `content/posts` (split into `posts-md` / `posts-mdx` by extension), `content/pages`, `content/albums`, `content/moments`, `content/timeline` and `content/roadmap`. **Anything a schema requires must appear here**, including the album's nested photo list — a field the config omits is a field the editor cannot write.
- The `settings` collection is a `file` collection over `site.config.json` with `inferSchema: true`: the editor derives one control per key from the JSON value's shape and labels it readably. `fieldOverrides` then corrects what inference cannot know — `i18n-string` for the `{ 'zh-CN', en }` objects, `nav.*.label` to reach into the nav list (literal paths beat wildcards), `number`/`datetime`/`select` for the scalars. Adding a setting means adding an override only when the inferred widget is wrong.

The two-track body editor is the editor's job, not the theme's: `classifyBody()` in the editor picks source mode for MDX, import blocks, JSX, HTML blocks, structured fences, display math and indented code, and rich text for everything else. It is deliberately biased toward source — an unrecognised construct stays editable as text rather than being mangled. The theme only has to keep the fence languages in `diagramLanguages` valid, since those blocks arrive as source either way.

**Server side.** `functions/api/[[path]].js` (Cloudflare Pages Functions) delegates to `src/server/content-services.mjs`. It serves `/api/auth` and `/api/callback` (GitHub OAuth with a state cookie and a repo write-permission check) and `/api/media` (R2 list/upload, same-origin only, validated WebP variants). These endpoints are **optional**: they exist for the GitHub backend and for hosting uploads on R2, not for the editor itself. Env: `GITHUB_REPO`, `GITHUB_CLIENT_ID`, the secret `GITHUB_CLIENT_SECRET`, and for R2 the `MEDIA` binding plus `PUBLIC_MEDIA_URL`. The rest of the site is fully static (`output: 'static'`, no adapter).

**Diagrams and scores.** Fenced blocks whose language is listed in `diagramLanguages` (`src/lib/remark-mermaid.ts`) are rendered in the browser, not at build time: the remark plugin tags them with `data-diagram-lang` (and they are added to Shiki's `excludeLangs` in `astro.config.ts`), `src/scripts/article.ts` wraps each in a `<figure class="diagram diagram-<lang>">` with a `<details>` source fallback, and an IntersectionObserver renders only what is near the viewport. `renderers` in that file maps language name to a dynamic `import()`, so a page only downloads the renderers it uses; a failure keeps the source visible. Adding a language means one entry in each of those two places. Styling lives under `.diagram*` in `global.css`; abcjs paints with `fill`/`stroke: currentColor`, so scores follow the theme with no extra rules.

**Styling.** Everything is in `src/styles/global.css`: design tokens on `:root`, dark mode under `[data-theme='dark']` and `prefers-color-scheme`, plus component classes. The theme is set before paint by an inline script in `BaseLayout.astro`, which also adds the `.js` class that JS-only motion is keyed on. Every animation must respect `prefers-reduced-motion`, and a no-JavaScript e2e test covers navigation.

**Editor language and theme.** The editor UI is Chinese and its palette is the blog's, but both live in v7-cms, not here: `cms.config.json` only sets `locale: 'zh-CN'`, and `cms.css` ships with the bundle. The theme's one obligation is that `/admin/` serves the two copied files at `/admin/v7-cms.js` and `/admin/cms.css` — renaming them in `copy-cms.mjs` means renaming them in the admin page too. Because `pnpm preview` serves cached `dist/`, an editor change needs a rebuild before it shows up; `pnpm dev` picks it up on restart.
