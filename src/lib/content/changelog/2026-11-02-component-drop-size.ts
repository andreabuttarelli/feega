import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Dropped components keep their size',
  items: ['A component dragged onto empty canvas lands exactly its own size, no oversized empty box around it.']
} satisfies ChangelogEntry;
