import rss from '@astrojs/rss';
import { getPublishedPosts } from '../lib/content';
import { postUrl } from '../lib/posts';
import { siteConfig, localized } from '../site.config';
export async function GET() {
  return rss({
    title: siteConfig.title,
    description: localized(siteConfig.description),
    site: siteConfig.siteURL,
    items: (await getPublishedPosts()).map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: postUrl(post),
      categories: post.data.tags,
    })),
    customData: `<language>${siteConfig.locale}</language>`,
  });
}
