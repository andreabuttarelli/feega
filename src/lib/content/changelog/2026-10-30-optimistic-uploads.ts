import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-30',
  title: 'Instant uploads',
  items: [
    'A file dropped on the canvas shows at once, with its upload progress.',
    'Changes still saving when you reload the page are sent again after the reload.'
  ]
} satisfies ChangelogEntry;
