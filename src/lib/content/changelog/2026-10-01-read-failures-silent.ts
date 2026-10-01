import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-01',
  title: 'No false save errors',
  items: ['The canvas no longer says a change failed to save when only a background lookup failed.']
} satisfies ChangelogEntry;
