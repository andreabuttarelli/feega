import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-29',
  title: 'Instant undo after a drop',
  items: ['Undo right after dragging an element out of a frame, or dropping one in, now reverts it instead of doing nothing.']
} satisfies ChangelogEntry;
