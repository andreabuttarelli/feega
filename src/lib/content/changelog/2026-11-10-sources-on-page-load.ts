import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-10',
  title: 'Frames load while the canvas starts',
  items: ['A canvas starts fetching its frames as soon as it opens, so they appear sooner.']
} satisfies ChangelogEntry;
