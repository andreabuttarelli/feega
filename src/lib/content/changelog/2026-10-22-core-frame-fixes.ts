import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-22',
  title: 'Frame editing fixes',
  items: [
    'Frames with thousands of small shapes no longer go blank.',
    'Delete removes the selected shapes inside a frame, not the whole frame.',
    'A shape drawn on the canvas opens on its properties right away.',
    'The align bar stays clickable when a frame sits near the bottom toolbar.',
    'Leaving the page while a frame edit is still saving now asks first.'
  ]
} satisfies ChangelogEntry;
