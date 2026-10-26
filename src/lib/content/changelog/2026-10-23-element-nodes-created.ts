import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-23',
  title: 'Free elements are their own thing',
  items: [
    'Shapes, text, images and SVGs placed on the canvas are saved as elements, never as frames',
    'Duplicating or copy-pasting a free element keeps its drawing and size'
  ]
} satisfies ChangelogEntry;
