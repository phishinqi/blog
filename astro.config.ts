import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkMermaid, { diagramLanguages } from './src/lib/remark-mermaid';
import rehypeHeadingInk from './src/lib/rehype-heading-ink';
import { siteConfig } from './src/site.config';

export default defineConfig({
  site: siteConfig.siteURL,
  output: 'static',
  trailingSlash: 'always',
  integrations: [
    mdx(),
    react(),
    sitemap({
      filter: (page) =>
        !page.endsWith('/404/') &&
        !page.endsWith('/search/') &&
        !new URL(page).pathname.startsWith('/admin/'),
    }),
  ],
  vite: { plugins: [tailwindcss()] },
  markdown: {
    syntaxHighlight: { type: 'shiki', excludeLangs: [...diagramLanguages] },
    shikiConfig: {
      themes: { light: 'github-light-high-contrast', dark: 'github-dark' },
      defaultColor: false,
    },
    processor: unified({
      remarkPlugins: [remarkMath, remarkMermaid],
      rehypePlugins: [[rehypeKatex, { strict: 'warn', throwOnError: false }], rehypeHeadingInk],
    }),
  },
});
