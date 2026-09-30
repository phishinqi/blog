import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { postSchema } from './lib/post-schema';
import { moduleSchema, albumSchema } from './lib/module-schema';

const posts = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './content/posts',
    // File identity must not depend on slug: duplicate slugs must remain detectable.
    generateId: ({ entry }) => entry.replace(/\.(md|mdx)$/, ''),
  }),
  schema: postSchema,
});
const moduleCollection = (name: string) =>
  defineCollection({
    loader: glob({ pattern: '**/*.md', base: `./content/${name}` }),
    schema: moduleSchema,
  });
export const collections = {
  posts,
  moments: moduleCollection('moments'),
  timeline: moduleCollection('timeline'),
  roadmap: moduleCollection('roadmap'),
  albums: defineCollection({
    loader: glob({ pattern: '**/*.md', base: './content/albums' }),
    schema: albumSchema,
  }),
};
