import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-30',
  title: 'Tall frames export as images',
  items: [
    'Very tall frames, like imported web pages, now export as PNG, JPG and WebP at any size.',
    'A WebP too tall for the format is scaled to fit, and the export says so.',
    'When an export fails, it now says why.'
  ]
} satisfies ChangelogEntry;
