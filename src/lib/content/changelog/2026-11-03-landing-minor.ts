import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-03',
  title: 'Esc, sideways scroll and page renames',
  items: [
    'Esc puts a drawing tool down and goes back to Select.',
    'Shift with the mouse wheel scrolls the canvas sideways.',
    'Right-click a frame to rename it.',
    'Double-click any page in Pages to rename it.'
  ]
} satisfies ChangelogEntry;
