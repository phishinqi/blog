import { siteConfig } from '../site.config';
export function pagesOf<T>(items: T[]) {
  const total = Math.max(1, Math.ceil(items.length / siteConfig.postsPerPage));
  return Array.from({ length: total }, (_, index) => ({
    current: index + 1,
    total,
    page: index === 0 ? undefined : `page/${index + 1}`,
    items: items.slice(index * siteConfig.postsPerPage, (index + 1) * siteConfig.postsPerPage),
  }));
}
