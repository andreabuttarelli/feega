import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://blog.feega.app',
  trailingSlash: 'always',
  integrations: [mdx(), sitemap()],
  markdown: {
    shikiConfig: { theme: 'github-dark' }
  }
});
