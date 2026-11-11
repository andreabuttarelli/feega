import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'No empty canvas when zooming out early',
  items: ['Zooming out right after opening a canvas shows every frame instead of empty space while the rest is still loading.']
} satisfies ChangelogEntry;
