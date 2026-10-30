import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-30',
  title: 'Readable canvas when zoomed out',
  items: ['Frame and node names stay readable when you zoom far out, and hide only when the frame is tiny.', 'Hover and selection outlines and resize handles keep their thickness at every zoom.']
} satisfies ChangelogEntry;
