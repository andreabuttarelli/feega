import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-20',
  title: 'Position and constraints',
  items: [
    'New elements keep their size when you resize the frame: they are pinned left and top.',
    'The Position section holds align, X/Y, constraints with a visual widget, rotation, rotate 90 and flips. The rotation origin is now called Pivot.'
  ]
} satisfies ChangelogEntry;
