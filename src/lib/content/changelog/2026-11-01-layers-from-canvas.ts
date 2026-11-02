import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-01',
  title: 'Layers shows what the canvas has loaded',
  items: ['The Layers panel no longer loads pages in the background: it lists what the canvas shows, and fills a page in as soon as the canvas loads it.']
} satisfies ChangelogEntry;
