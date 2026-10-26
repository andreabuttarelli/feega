import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-22',
  title: 'Figma-style editing inside frames',
  items: [
    'Elements inside a frame snap to each other and to the frame edges, with smart guides and spacing.',
    'Rotate elements from just outside their corners; Shift snaps to 15°.',
    'Shift keeps proportions or locks a move to one axis; Alt resizes from the centre.',
    'Several selected elements resize and rotate together as one group.',
    'Arrow keys nudge by 1px, Shift+arrows by 10px.',
    'Hold Alt over another element to measure the distance to it.',
    'Flip horizontal and vertical are in the element action bar.'
  ]
} satisfies ChangelogEntry;
