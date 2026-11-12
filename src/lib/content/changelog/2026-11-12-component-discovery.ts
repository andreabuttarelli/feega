import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-12',
  title: 'Import from code reads your component library',
  items: [
    'Props declared as a fixed set of values, like a callout type or a heading level, now become variants.',
    'React components written in .js files are recognised.',
    'The import result lists every component found in your code, with its variants, and which ones no imported page showed.'
  ]
} satisfies ChangelogEntry;
