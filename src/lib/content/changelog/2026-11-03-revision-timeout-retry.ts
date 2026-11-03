import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-03',
  title: 'Saves ride out a busy moment',
  items: ['Saving a large frame waits and tries again when the server is briefly busy, and page imports retry instead of failing.']
} satisfies ChangelogEntry;
