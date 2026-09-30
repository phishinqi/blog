import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import config from '../site.config.json' with { type: 'json' };
import categories from '../data/categories.json' with { type: 'json' };
const [slug, directory = '', title = slug] = process.argv.slice(2);
if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
  throw new Error('Usage: pnpm new:post <stable-slug> [folder] [title]');
const root = resolve('content/posts');
const path = resolve(root, directory, slug + '.md');
const child = relative(root, path);
if (child.startsWith('..') || isAbsolute(child))
  throw new Error('The article must stay inside content/posts/.');
await mkdir(dirname(path), { recursive: true });
await writeFile(
  path,
  `---\ntitle: ${JSON.stringify(title)}\ndescription: "填写文章摘要"\nslug: ${JSON.stringify(slug)}\npubDate: ${JSON.stringify(new Date().toISOString())}\ncategory: ${JSON.stringify(categories.categories[0].id)}\ntags: []\nauthors: [${JSON.stringify(config.defaultAuthor)}]\nlang: ${JSON.stringify(config.locale)}\ndraft: true\n---\n\n开始写作。\n`,
  { flag: 'wx' },
);
console.log(`Created ${child}. Keep the slug stable; the folder does not determine its category.`);
