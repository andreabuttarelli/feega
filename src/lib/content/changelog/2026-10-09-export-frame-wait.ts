import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-09',
  title: 'Heavy videos export in Safari',
  items: ['Videos with many effects no longer stop exporting at the first frame in Safari, and grain renders faster.', 'When a frame cannot be drawn, the error says which moment of the video failed.']
} satisfies ChangelogEntry;
