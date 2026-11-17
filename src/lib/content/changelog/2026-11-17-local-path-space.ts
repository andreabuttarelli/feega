import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-17',
  title: 'Local mode starts from any folder',
  items: ['Local Feega now starts from folders with spaces in their path, and says so when the app fails to start instead of exiting silently.']
} satisfies ChangelogEntry;
