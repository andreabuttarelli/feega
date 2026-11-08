import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-08',
  title: 'Lighter zoom out',
  items: ['Zooming out over many nodes does less work per step, so frames stay even on slower computers.']
} satisfies ChangelogEntry;
