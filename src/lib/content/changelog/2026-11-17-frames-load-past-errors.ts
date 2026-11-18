import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-17',
  title: 'Frames load through server hiccups',
  items: ['A frame whose pictures cannot all be read now opens with the rest instead of staying blank', 'A frame that fails to load tries again on its own']
} satisfies ChangelogEntry;
