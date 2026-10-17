import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-16',
  title: 'Shapes appear instantly',
  items: [
    'Shapes drawn on the canvas or inside a frame appear instantly and no longer flicker while saving.',
    'A shape drawn on the canvas is a single layer, not a frame with the shape inside.',
    'New Frame tool in the bottom bar: click for a default frame, drag to draw one at any size.'
  ]
} satisfies ChangelogEntry;
