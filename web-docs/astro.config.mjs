import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const SITE = 'https://docs.feega.app';

export default defineConfig({
  site: SITE,
  integrations: [
    starlight({
      title: 'feega docs',
      description: 'Guides, references and architecture notes for feega, the infinite canvas for design and motion.',
      customCss: ['./src/styles/feega.css'],
      editLink: { baseUrl: 'https://github.com/andreabuttarelli/feega/edit/dev/web-docs/' },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/andreabuttarelli/feega' }],
      sidebar: [
        { label: 'Getting started', autogenerate: { directory: 'getting-started' } },
        { label: 'Canvas', autogenerate: { directory: 'canvas' } },
        { label: 'Motion', autogenerate: { directory: 'motion' } },
        { label: 'AI', autogenerate: { directory: 'ai' } },
        { label: 'Integrations', autogenerate: { directory: 'integrations' } },
        { label: 'Reference', autogenerate: { directory: 'reference' } },
        { label: 'Self-hosting', autogenerate: { directory: 'self-hosting' } },
        { label: 'Architecture', autogenerate: { directory: 'architecture', collapsed: true } }
      ]
    })
  ]
});
