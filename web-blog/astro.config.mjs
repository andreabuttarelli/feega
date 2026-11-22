import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { archivedPaths } from './archived-posts.mjs';

const ARCHIVED = archivedPaths();

export default defineConfig({
  site: 'https://blog.feega.app',
  trailingSlash: 'always',
  integrations: [mdx(), sitemap({ filter: (page) => !ARCHIVED.includes(new URL(page).pathname) })],
  markdown: {
    shikiConfig: { theme: 'github-dark' }
  }
});
