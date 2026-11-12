import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-12',
  title: 'Clear messages when an import fails',
  items: ['A source that fails to import from the home prompt now explains why in plain words.']
} satisfies ChangelogEntry;
