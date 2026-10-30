import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-29',
  title: 'Variants in exported code',
  items: [
    'A component with variants exports as one React or Svelte component with a prop per variant, instead of one copy per variant.',
    'Pages built with Tailwind 4 keep their colours when imported from a URL.',
    'Components nested inside components inside auto layout land where they belong.'
  ]
} satisfies ChangelogEntry;
