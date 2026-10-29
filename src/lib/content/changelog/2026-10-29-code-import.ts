import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-29',
  title: 'Import from code',
  items: [
    'Paste a public GitHub React repo and a page: every component becomes a main component, every use an instance, and its props become variants.',
    'Exporting that frame to React or Svelte gives back the same component names and props.'
  ]
} satisfies ChangelogEntry;
