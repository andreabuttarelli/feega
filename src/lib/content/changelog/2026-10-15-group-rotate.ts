import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-15',
  title: 'Groups turn, and hold frames',
  items: [
    'Select a group and drag the round handle above it to rotate everything in it around its centre; hold Shift for 15° steps.',
    'Frames can go in a group with shapes: the group moves and turns them together, and each frame still opens and plays.'
  ]
} satisfies ChangelogEntry;
