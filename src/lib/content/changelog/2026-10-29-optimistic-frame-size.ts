import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-29',
  title: 'Resizing frames never waits',
  items: ['Resizing any frame refits its content at once, and a group size or restored version that cannot be saved is put back with a notice.']
} satisfies ChangelogEntry;
