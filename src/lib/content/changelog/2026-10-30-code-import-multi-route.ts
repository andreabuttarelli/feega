import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-30',
  title: 'Import from code: more pages, frameworks and Storybook',
  items: [
    'Import from code takes several pages at once: one frame, a board per page, each component shared across pages.',
    'Next.js server components, Vue and Svelte apps now come in with their components.',
    'Paste a public Storybook link to bring in its stories as components and variants, with no app to start.',
    'Components nested on the same element, and icon components, now come in as components.',
    'Exported React and Svelte code no longer turns layout groups into Group components.'
  ]
} satisfies ChangelogEntry;
