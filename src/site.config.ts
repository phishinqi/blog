import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import raw from '../site.config.json';
import categories from '../data/categories.json';
import authors from '../data/authors.json';
import photoTags from '../data/photo-tags.json';
import { z } from 'astro/zod';
import { licensePresets } from './lib/licenses';

export type Locale = 'zh-CN' | 'en';
export type Localized = Record<Locale, string>;
// Resolved against the working directory, which is the project root for every astro command.
const root = process.cwd();
const localizedSchema = z.object({ 'zh-CN': z.string(), en: z.string() });
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const safeLink = z
  .string()
  .refine(
    (value) => /^(\/(?!\/)|https?:\/\/|mailto:)/.test(value),
    'Use a local path, HTTP(S) URL or email link.',
  );
const nav = z.array(z.object({ href: safeLink, label: localizedSchema }));
const categorySchema = z.object({
  title: localizedSchema,
  description: localizedSchema,
  parent: z.preprocess((value) => (value === '' ? undefined : value), id.optional()),
});
export type Category = z.infer<typeof categorySchema>;
const authorSchema = z.object({
  name: z.string().min(1),
  bio: localizedSchema,
  avatar: z.string().default(''),
  links: z.array(z.object({ label: z.string(), href: safeLink })).default([]),
});
if (new Set(authors.authors.map((a) => a.id)).size !== authors.authors.length)
  throw new Error('Duplicate author ID.');
if (new Set(categories.categories.map((a) => a.id)).size !== categories.categories.length)
  throw new Error('Duplicate category ID.');
export const authorRegistry = z
  .record(id, authorSchema)
  .parse(Object.fromEntries(authors.authors.map(({ id, ...value }) => [id, value])));
const photoTagEntries = z.array(z.object({ id, label: localizedSchema })).parse(photoTags.tags);
if (new Set(photoTagEntries.map((t) => t.id)).size !== photoTagEntries.length)
  throw new Error('Duplicate photo tag ID.');
export const photoTagRegistry = z
  .record(id, localizedSchema)
  .parse(Object.fromEntries(photoTagEntries.map((t) => [t.id, t.label])));
export const categoryRegistry = z
  .record(id, categorySchema)
  .parse(Object.fromEntries(categories.categories.map(({ id, ...value }) => [id, value])));
export function validateCategoryTree(registry: Record<string, Category>) {
  for (const key of Object.keys(registry)) {
    const seen = new Set<string>();
    let current: string | undefined = key;
    while (current) {
      if (seen.has(current)) throw new Error(`Category cycle: ${key}`);
      seen.add(current);
      if (!Object.hasOwn(registry, current)) throw new Error(`Unknown parent category: ${current}`);
      current = registry[current]!.parent;
    }
  }
}
validateCategoryTree(categoryRegistry);
const parsed = z
  .object({
    title: z.string().min(1),
    siteURL: z.url(),
    locale: z.enum(['zh-CN', 'en']),
    timeZone: z.string(),
    description: localizedSchema,
    intro: z.object({ title: localizedSchema, description: localizedSchema }),
    defaultAuthor: id,
    nav,
    moreNav: nav,
    socialLinks: z.array(z.object({ label: z.string(), href: safeLink })),
    home: z.object({
      featuredLimit: z.number().int().nonnegative(),
      recentLimit: z.number().int().nonnegative(),
    }),
    postsPerPage: z.number().int().positive(),
    defaultOgImage: z.string(),
    startedAt: z.iso.date(),
    features: z.object({
      friends: z.boolean(),
      moments: z.boolean(),
      timeline: z.boolean(),
      roadmap: z.boolean(),
      albums: z.boolean(),
      stats: z.boolean(),
    }),
    links: z.object({ externalNewTab: z.boolean() }),
    appearance: z.object({
      headings: z.object({
        articleTitleSize: z.number().min(2).max(4),
        h1Size: z.number().min(1.5).max(3),
        marker: z.object({
          h1: z.enum(['line', 'dot']),
          h2: z.enum(['line', 'dot']),
          h3: z.enum(['line', 'dot']),
          h4: z.enum(['line', 'dot']),
        }),
        markerSize: z.number().min(2).max(12),
        radius: z.number().min(0).max(24),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        darkColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        durationMs: z.number().int().min(0).max(1000),
      }),
      stars: z.object({
        scope: z.enum(['all', 'article', 'off']),
        density: z.number().min(0.5).max(2),
        opacity: z.number().min(0).max(1),
        speed: z.number().min(0).max(3).default(1),
        amplitude: z.number().min(0).max(24).default(8),
      }),
    }),
    media: z.object({
      provider: z.enum(['repo', 'github', 'r2', 'media-repo']),
      repoPath: z.string().optional(),
      publicPath: z.string().optional(),
      endpoint: z.string().optional(),
      mediaRepo: z.string().optional(),
      mediaBranch: z.string().optional(),
      mediaPath: z.string().optional(),
      mediaPublicUrl: z.string().optional(),
      exifPrefill: z.boolean().default(true),
      license: z.enum(licensePresets).default('all-rights-reserved'),
      licenseText: z.string().default(''),
    }),
    // Whether the theme builds the editor page and links to it. Everything else about the editor
    // lives in cms.config.json, which the editor itself reads.
    cms: z.object({ enabled: z.boolean() }),
  })
  .parse(raw);
if (!Object.hasOwn(authorRegistry, parsed.defaultAuthor))
  throw new Error('Unknown default author.');
const origin = new URL(parsed.siteURL);
if (
  !['http:', 'https:'].includes(origin.protocol) ||
  origin.pathname !== '/' ||
  origin.search ||
  origin.hash
)
  throw new Error('siteURL must be an HTTP(S) origin.');
new Intl.DateTimeFormat(parsed.locale, { timeZone: parsed.timeZone });

/**
 * Refuse to build an unconfigured copy of this template.
 *
 * The repository is a GitHub template. A copy arrives carrying the original author's `siteURL`,
 * their repository as the editor's backend, and their writing as the sample content — none of
 * which is visible until the output ships, at which point the canonical URLs, RSS and sitemap all
 * name somebody else's domain and the editor writes to their repository.
 *
 * Two signals, and neither is sufficient alone:
 *
 * - The marker file is committed, so every copy has one, and `pnpm bootstrap` deletes it. Alone it
 *   would also block this repository, which is the template and carries the same file.
 * - The remote identifies this repository as the template's origin. Alone it would block a copy
 *   whose owner had already pointed it at their own repository — the correct thing to do — since
 *   setup cannot change a remote.
 *
 * Together: a copy has the marker and a remote that is not the template, so it stops; this
 * repository has both the marker and the template's remote, so it builds. `V7_TEMPLATE_BUILD=1`
 * overrides for an export or tarball with no remote at all.
 */
const TEMPLATE_REMOTE = 'phishinqi/astro-theme-v7';
const MARKER = 'this-repository-is-a-template';

function remoteIsThisRepository(): boolean {
  try {
    const remote = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return remote.includes(TEMPLATE_REMOTE);
  } catch {
    // No git, or no remote. Not this repository, as far as this check can tell.
    return false;
  }
}

if (
  process.env['V7_TEMPLATE_BUILD'] !== '1' &&
  existsSync(resolve(root, MARKER)) &&
  !remoteIsThisRepository()
) {
  throw new Error(
    'This site has not been set up yet. Run ' +
      '`pnpm bootstrap -- url https://your-domain --repo you/your-repo`, then build again. ' +
      "Without it the published site would claim the template author's domain in its canonical " +
      'URLs, RSS and sitemap, and the editor would write to their repository.',
  );
}

export const siteConfig = {
  ...parsed,
  categories: categoryRegistry,
  author: authorRegistry[parsed.defaultAuthor]!,
};
export type SiteConfig = typeof siteConfig;
export function localized(value: Localized): string {
  return value[siteConfig.locale];
}
export function categoryAncestors(key: string): string[] {
  const result: string[] = [];
  let current: string | undefined = key;
  while (current) {
    result.unshift(current);
    current = categoryRegistry[current]?.parent;
  }
  return result;
}
export function isInCategory(actual: string, parent: string): boolean {
  return categoryAncestors(actual).includes(parent);
}
export function enabledHref(href: string): boolean {
  const segment = href.split('/')[1];
  // The photo wall belongs to the albums module.
  const key = segment === 'photos' ? 'albums' : segment;
  return (
    !key ||
    !(key in siteConfig.features) ||
    siteConfig.features[key as keyof typeof siteConfig.features]
  );
}
