import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-20',
  title: 'Vector edit mode',
  items: [
    'Double-click a path, polygon, star or line to edit its points; Esc or a click outside leaves.',
    'Points snap to the frame and other layers, and Alt-click switches a point between corner and smooth.',
    'The chat and connected agents can move, add, delete and smooth path points.'
  ]
} satisfies ChangelogEntry;
