import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-09',
  title: 'No empty flashes while tiles refresh (preview)',
  items: ['With ?coreTiles, areas of the canvas no longer go empty while they refresh; the old picture stays until the new one is ready.']
} satisfies ChangelogEntry;
