import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-15',
  title: 'Groups move, scale and turn as one',
  items: [
    '⌘Z undoes a group rotation.',
    'Resizing a group scales the frames inside it; dragging a group carries them along live.',
    'A click on a frame inside a group selects that frame.',
    'New shapes and groups show their picture right away, not an empty outline.'
  ]
} satisfies ChangelogEntry;
