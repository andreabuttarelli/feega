import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-18',
  title: 'Shapes on the canvas move as one object',
  items: [
    'Dragging or resizing a selected shape on the canvas moves and sizes the shape itself: it no longer slides out of view or jumps back.',
    'Clicking away from a shape after editing it no longer reloads it.'
  ]
} satisfies ChangelogEntry;
