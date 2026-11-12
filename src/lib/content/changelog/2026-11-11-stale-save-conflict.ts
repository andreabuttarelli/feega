import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'No more lost frame edits from an old tab',
  items: ['A tab holding an older copy of a frame can no longer overwrite newer changes: it loads the latest version and tells you.']
} satisfies ChangelogEntry;
