import type { PostData } from './post-schema';
import { siteConfig } from '../site.config';

export interface PostLike {
  id: string;
  data: PostData;
  body?: string;
}
export const postUrl = (post: Pick<PostLike, 'data'>) => `/posts/${post.data.slug}/`;
export const tagUrl = (tag: string) => `/tags/${encodeURIComponent(tag)}/`;
export const categoryUrl = (category: string) => `/categories/${encodeURIComponent(category)}/`;

export function validatePosts<T extends PostLike>(posts: T[]): void {
  const slugs = new Map<string, string>();
  const tags = new Map<string, string>();
  for (const post of posts) {
    const previous = slugs.get(post.data.slug);
    if (previous !== undefined)
      throw new Error(`Duplicate slug "${post.data.slug}" in "${previous}" and "${post.id}".`);
    slugs.set(post.data.slug, post.id);
    for (const tag of post.data.tags) {
      const key = tag.normalize('NFC').toLocaleLowerCase('en');
      const previousTag = tags.get(key);
      if (previousTag !== undefined && previousTag !== tag)
        throw new Error(
          `Conflicting tag spellings "${previousTag}" and "${tag}". Use one spelling consistently.`,
        );
      tags.set(key, tag);
    }
    if (!Object.hasOwn(siteConfig.categories, post.data.category))
      throw new Error(`Unknown category in ${post.id}.`);
    if (!Number.isFinite(post.data.pubDate.getTime()))
      throw new Error(`Invalid publication date in ${post.id}.`);
  }
}
export function publishedPosts<T extends PostLike>(posts: T[], now = new Date()): T[] {
  validatePosts(posts);
  return posts
    .filter(({ data }) => !data.draft && data.pubDate <= now)
    .sort(
      (a, b) =>
        b.data.pubDate.getTime() - a.data.pubDate.getTime() ||
        a.data.slug.localeCompare(b.data.slug),
    );
}
export function homePosts<T extends PostLike>(
  posts: T[],
  featuredLimit: number,
  recentLimit: number,
) {
  const featured = posts.filter((post) => post.data.featured).slice(0, featuredLimit);
  const displayed = new Set(featured.map((post) => post.id));
  return {
    featured,
    recent: posts.filter((post) => !displayed.has(post.id)).slice(0, recentLimit),
  };
}
export function readingMinutes(body = ''): number {
  const plain = body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  const cjk = (plain.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu) || [])
    .length;
  const words = (
    plain
      .replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu, ' ')
      .match(/[\p{L}\p{N}]+/gu) || []
  ).length;
  return Math.max(1, Math.ceil(cjk / 400 + words / 200));
}
export function formatDate(date: Date, compact = false): string {
  return new Intl.DateTimeFormat(siteConfig.locale, {
    timeZone: siteConfig.timeZone,
    year: 'numeric',
    month: compact ? '2-digit' : 'short',
    day: '2-digit',
  }).format(date);
}
export function archiveGroups<T extends PostLike>(
  posts: T[],
): Array<{ year: string; months: Array<{ key: string; label: string; posts: T[] }> }> {
  const years = new Map<string, Map<string, { key: string; label: string; posts: T[] }>>();
  const partsFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: siteConfig.timeZone,
    year: 'numeric',
    month: '2-digit',
  });
  const monthFormatter = new Intl.DateTimeFormat(siteConfig.locale, {
    timeZone: siteConfig.timeZone,
    month: 'long',
  });
  for (const post of posts) {
    const parts = partsFormatter.formatToParts(post.data.pubDate);
    const year = parts.find((part) => part.type === 'year')!.value;
    const month = parts.find((part) => part.type === 'month')!.value;
    if (!years.has(year)) years.set(year, new Map());
    const months = years.get(year)!;
    if (!months.has(month))
      months.set(month, { key: month, label: monthFormatter.format(post.data.pubDate), posts: [] });
    months.get(month)!.posts.push(post);
  }
  return Array.from(years, ([year, months]) => ({ year, months: Array.from(months.values()) }));
}
