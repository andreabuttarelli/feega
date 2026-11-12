import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-12',
  title: 'Faster canvases with neutral filters',
  items: ['Layers with filters that change nothing, like a zero blur, now draw as fast as layers without filters.']
} satisfies ChangelogEntry;
