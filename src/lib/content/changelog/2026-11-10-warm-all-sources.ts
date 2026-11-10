import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-10',
  title: 'Faster canvas open',
  items: ['Opening a canvas with many frames now loads all of them together instead of a few at a time.']
} satisfies ChangelogEntry;
