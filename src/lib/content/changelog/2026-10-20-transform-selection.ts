import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-20',
  title: 'Resize and rotate a selection',
  items: ['Drag a corner of the selection box to resize all selected elements together; hold Alt to resize from the centre.', 'Drag outside a corner to rotate the selection around its centre; hold Shift to snap to 15 degrees.']
} satisfies ChangelogEntry;
