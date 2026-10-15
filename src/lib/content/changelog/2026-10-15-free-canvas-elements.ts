import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-15',
  title: 'Draw shapes and text anywhere on the canvas',
  items: [
    'The text, box, ellipse and pen tools are always in the bottom bar, not only inside a frame.',
    'Drawing on the empty canvas makes a free element that opens straight on its properties: fills, strokes, effects, radius and text style, as in a frame.',
    'Free elements have no frame chrome and stay see-through on the canvas. ⌘Z removes one you just drew.'
  ]
} satisfies ChangelogEntry;
