import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const SITE = 'https://docs.feega.app';

export default defineConfig({
  site: SITE,
  integrations: [
    starlight({
      title: 'Feega docs',
      description: 'Documentation for Feega, the free open-source VS Code extension to design in your codebase.',
      logo: { src: './src/assets/logo.svg', replacesTitle: false },
      favicon: '/favicon.svg',
      head: [
        { tag: 'link', attrs: { rel: 'icon', href: '/favicon.ico', sizes: '16x16 32x32 48x48' } },
        { tag: 'link', attrs: { rel: 'icon', href: '/favicon.png', sizes: '48x48', type: 'image/png' } },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' } }
      ],
      customCss: ['./src/styles/theme/tokens.css', './src/styles/theme/chrome.css', './src/styles/feega.css'],
      routeMiddleware: './src/route-data.ts',
      components: { Header: './src/components/Header.astro', PageTitle: './src/components/PageTitle.astro', PageFrame: './src/components/PageFrame.astro' },
      editLink: { baseUrl: 'https://github.com/andreabuttarelli/feega/edit/dev/web-docs/' },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/andreabuttarelli/feega' }],
      sidebar: [
        { label: 'Getting started', autogenerate: { directory: 'getting-started' } },
        { label: 'Editing', autogenerate: { directory: 'editing' } },
        { label: 'Frameworks', autogenerate: { directory: 'frameworks' } },
        { label: 'Styling systems', autogenerate: { directory: 'styling' } },
        { label: 'More', autogenerate: { directory: 'more' } }
      ]
    })
  ]
});
