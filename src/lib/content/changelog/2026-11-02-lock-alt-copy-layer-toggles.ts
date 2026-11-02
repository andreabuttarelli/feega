import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Locked layers stay put, Alt-drag copies',
  items: [
    'Locked layers and locked elements no longer move when dragged.',
    'Alt-drag an element inside a frame to drag a copy, leaving the original in place.',
    'Free elements show their eye and lock in Layers, and hidden ones are dimmed.',
    'Run flow only appears when the selection has something to generate.'
  ]
} satisfies ChangelogEntry;
