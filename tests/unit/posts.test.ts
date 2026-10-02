import { describe, expect, it } from 'vitest';
import { postSchema } from '../../src/lib/post-schema';
import { resolveLicense } from '../../src/lib/licenses';
import {
  archiveGroups,
  homePosts,
  publishedPosts,
  readingMinutes,
  validatePosts,
  postUrl,
  tagUrl,
} from '../../src/lib/posts';

const frontmatter = {
  title: '示例',
  description: 'Demo description',
  slug: 'example',
  pubDate: '2026-01-01',
  category: 'technology',
};
const makePost = (slug: string, extra: Record<string, unknown> = {}) => ({
  id: slug,
  data: postSchema.parse({ ...frontmatter, slug, ...extra }),
  body: '示例文字',
});

describe('content schema', () => {
  it('applies defaults and parses explicit timezone timestamps', () => {
    const post = makePost('test', { pubDate: '2026-01-01T09:30:00+08:00' });
    expect(post.data.pubDate.toISOString()).toBe('2026-01-01T01:30:00.000Z');
    expect(post.data.draft).toBe(false);
    expect(post.data.showCopyright).toBe(true);
    expect(post.data.tags).toEqual([]);
  });
  it('allows an individual article to hide its copyright notice', () => {
    expect(makePost('hidden', { showCopyright: false }).data.showCopyright).toBe(false);
  });
  it('defaults to all rights reserved and resolves article license links', () => {
    const post = makePost('licensed');
    expect(
      resolveLicense(post.data.license, post.data.licenseText, {
        preset: 'all-rights-reserved',
        text: '',
      }).label['zh-CN'],
    ).toBe('保留所有权利');
    const cc = resolveLicense('cc-by-4.0', undefined, { preset: 'all-rights-reserved', text: '' });
    expect(cc.href).toBe('https://creativecommons.org/licenses/by/4.0/');
    expect(
      resolveLicense('custom', '仅限非商业转载', { preset: 'all-rights-reserved', text: '' }).label[
        'zh-CN'
      ],
    ).toBe('仅限非商业转载');
  });
  it.each([
    'not-a-date',
    '2026-02-30',
    '2026-02-30T10:00:00Z',
    '2026-01-01T10:00:00',
    '09/28/2026',
    '2026-13-01',
  ])('rejects invalid or ambiguous dates: %s', (pubDate) => {
    expect(() => makePost('test', { pubDate })).toThrow();
  });
  it('accepts leap day but rejects impossible leap day', () => {
    expect(() => makePost('test', { pubDate: '2024-02-29' })).not.toThrow();
    expect(() => makePost('test', { pubDate: '2025-02-29' })).toThrow();
  });
  it.each([
    { category: 'missing' },
    { slug: '../bad' },
    { slug: 'MixedCase' },
    { updatedDate: '2025-01-01' },
    { title: ' ' },
    { tags: ['same', 'same'] },
    { tags: ['a/b'] },
    { tags: ['a\\b'] },
    { cover: { src: '/image.png', alt: '', width: 0, height: 1 } },
  ])('rejects malformed content: %j', (extra) => {
    expect(() => makePost('test', extra)).toThrow();
  });
  it('rejects duplicate slugs even when one is a draft', () => {
    expect(() =>
      publishedPosts([
        makePost('same'),
        { ...makePost('same', { draft: true }), id: 'other-file' },
      ]),
    ).toThrow(/Duplicate slug/);
  });
  it('rejects conflicting tag route spellings', () => {
    expect(() =>
      validatePosts([makePost('one', { tags: ['Web'] }), makePost('two', { tags: ['web'] })]),
    ).toThrow(/Conflicting tag/);
  });
});

describe('publication and presentation', () => {
  it('excludes drafts and future posts and includes the exact publication boundary', () => {
    const posts = [
      makePost('old'),
      makePost('draft', { draft: true }),
      makePost('future', { pubDate: '2026-06-02' }),
      makePost('boundary', { pubDate: '2026-06-01' }),
    ];
    expect(publishedPosts(posts, new Date('2026-06-01T00:00:00Z')).map((post) => post.id)).toEqual([
      'boundary',
      'old',
    ]);
    expect(posts[0]?.id).toBe('old');
  });
  it('provides deterministic ordering for equal publication dates', () => {
    expect(publishedPosts([makePost('z'), makePost('a')]).map((post) => post.id)).toEqual([
      'a',
      'z',
    ]);
  });
  it('does not duplicate displayed featured posts in recent posts', () => {
    const posts = Array.from({ length: 12 }, (_, index) =>
      makePost(`post-${index}`, { featured: index < 4 }),
    );
    const home = homePosts(posts, 3, 6);
    expect(home.featured).toHaveLength(3);
    expect(home.recent).toHaveLength(6);
    expect(home.recent[0]?.id).toBe('post-3');
    expect(new Set([...home.featured, ...home.recent].map((p) => p.id)).size).toBe(9);
    expect(homePosts(posts, 0, 0)).toEqual({ featured: [], recent: [] });
  });
  it('counts Chinese and English reading time, excluding code', () => {
    expect(readingMinutes()).toBe(1);
    expect(readingMinutes('字'.repeat(800))).toBe(2);
    expect(readingMinutes('word '.repeat(600))).toBe(3);
    expect(readingMinutes('```ts\n' + 'word '.repeat(600) + '\n```')).toBe(1);
  });
  it('groups archives in the configured Shanghai timezone', () => {
    const grouped = archiveGroups([makePost('new-year', { pubDate: '2025-12-31T18:00:00Z' })]);
    expect(grouped[0]?.year).toBe('2026');
    expect(grouped[0]?.months[0]?.key).toBe('01');
  });
  it('creates stable and encoded routes', () => {
    expect(postUrl(makePost('stable-slug'))).toBe('/posts/stable-slug/');
    expect(tagUrl('数学')).toBe('/tags/%E6%95%B0%E5%AD%A6/');
  });
});
