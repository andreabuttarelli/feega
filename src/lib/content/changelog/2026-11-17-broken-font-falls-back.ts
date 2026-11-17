import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-17',
  title: 'Damaged fonts no longer blank a page',
  items: ['A page that uses a damaged font file now draws, with the default font for the letters that font cannot provide.']
} satisfies ChangelogEntry;
