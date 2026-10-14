import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'Moving elements between frames, tidied',
  items: ['An element dropped on the empty canvas becomes a frame of its own shape, with no bars.', 'Undo in an open frame right after moving an element to another frame puts it back in both.']
} satisfies ChangelogEntry;
