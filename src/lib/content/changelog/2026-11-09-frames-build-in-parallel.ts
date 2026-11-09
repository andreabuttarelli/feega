import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-09',
  title: 'Frames load in parallel',
  items: ['Frames on a canvas are prepared in parallel, so a first open finishes sooner.']
} satisfies ChangelogEntry;
