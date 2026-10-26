import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-22',
  title: 'Resizing that follows the pointer',
  items: ['Dragging a corner keeps the opposite corner in place, and the shape and its selection follow the pointer while you drag.', 'Dragging a side of a shape, an element in a frame or a frame resizes that side only; Alt resizes from the centre, Shift keeps the ratio.']
} satisfies ChangelogEntry;
