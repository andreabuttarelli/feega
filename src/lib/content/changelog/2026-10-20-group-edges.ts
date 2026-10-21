import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-20',
  title: 'Stretch a selection',
  items: ['Drag the sides of the selection box to stretch the selected elements on one axis; corners resize freely, Shift keeps the ratio.', 'Resizing a selection snaps to the frame and other elements.', 'Hold Shift while dragging a selection to lock it to one direction.']
} satisfies ChangelogEntry;
