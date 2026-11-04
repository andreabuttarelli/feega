import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Resizing you can undo',
  items: [
    'Frames resize to any size from every handle, including the side edges.',
    'Undo and redo now cover resizing, for every kind of layer.',
    'Number keys set opacity like in Figma: 1 to 9 for 10 to 90%, 0 for 100%. They no longer add nodes.'
  ]
} satisfies ChangelogEntry;
