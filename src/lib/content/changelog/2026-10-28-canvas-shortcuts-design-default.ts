import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-28',
  title: 'Canvas shortcuts fixed',
  items: [
    '⌥⌘[ and ⌥⌘] send to back and bring to front, on the canvas and inside frames.',
    '⇧F picks the Frame tool.',
    'Tool tooltips show only the shortcuts that work.',
    'New canvases open the bottom bar in Design mode.'
  ]
} satisfies ChangelogEntry;
