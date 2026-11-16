import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-16',
  title: 'Smoother frame resizing',
  items: ['Resizing a long page frame follows the pointer instead of freezing', 'Resizing or undoing a resize no longer rewrites the text styles of the frame']
} satisfies ChangelogEntry;
