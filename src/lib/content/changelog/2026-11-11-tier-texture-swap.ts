import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'Sharper images right after zooming',
  items: ['Zooming in no longer reloads whole frames to sharpen their images: only the pictures are swapped.']
} satisfies ChangelogEntry;
