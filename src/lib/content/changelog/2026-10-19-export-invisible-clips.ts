import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-19',
  title: 'Exports no longer stall on hidden clips',
  items: ['Videos with a hidden music or video clip now export to the end instead of failing on a frame that "did not draw".']
} satisfies ChangelogEntry;
