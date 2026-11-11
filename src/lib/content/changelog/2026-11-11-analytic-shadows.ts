import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'Faster card shadows',
  items: ['Shadows on rectangular and rounded cards draw in one step, so canvases full of cards re-render faster after a zoom.']
} satisfies ChangelogEntry;
