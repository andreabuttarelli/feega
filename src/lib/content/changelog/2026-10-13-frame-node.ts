import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-13',
  title: 'Frames',
  items: [
    'Motion nodes are now called Frames: they hold videos and still graphics alike.',
    'A frame on the canvas takes the shape of its graphic, and keeps it when resized.',
    'While a frame is open, its controls sit in the canvas top bar: one bar instead of two.'
  ]
} satisfies ChangelogEntry;
