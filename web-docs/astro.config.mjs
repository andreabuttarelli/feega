import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const SITE = 'https://docs.feega.app';

export default defineConfig({
  site: SITE,
  integrations: [
    starlight({
      title: 'Feega docs',
      description: 'Guides, references and architecture notes for Feega, the infinite canvas for design and motion.',
      logo: { src: './src/assets/logo.svg', replacesTitle: false },
      favicon: '/favicon.svg',
      head: [
        { tag: 'link', attrs: { rel: 'icon', href: '/favicon.ico', sizes: '16x16 32x32 48x48' } },
        { tag: 'link', attrs: { rel: 'icon', href: '/favicon.png', sizes: '48x48', type: 'image/png' } },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' } }
      ],
      customCss: ['./src/styles/feega.css'],
      editLink: { baseUrl: 'https://github.com/andreabuttarelli/feega/edit/dev/web-docs/' },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/andreabuttarelli/feega' }],
      sidebar: [
        { label: 'Getting started', autogenerate: { directory: 'getting-started' } },
        { label: 'Desktop', autogenerate: { directory: 'desktop' } },
        { label: 'Canvas', autogenerate: { directory: 'canvas' } },
        { label: 'Motion', autogenerate: { directory: 'motion' } },
        { label: 'Audio', autogenerate: { directory: 'audio' } },
        { label: 'AI', autogenerate: { directory: 'ai' } },
        { label: 'Integrations', autogenerate: { directory: 'integrations' } },
        { label: 'Reference', autogenerate: { directory: 'reference' } },
        { label: 'Self-hosting', autogenerate: { directory: 'self-hosting' } },
        { label: 'Architecture', autogenerate: { directory: 'architecture', collapsed: true } }
      ]
    })
  ]
});
