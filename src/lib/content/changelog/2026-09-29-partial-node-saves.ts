import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-29',
  title: 'Edits no longer overwrite each other',
  items: [
    'Editing a node keeps changes made at the same time by teammates, the assistant or a running generation.'
  ]
} satisfies ChangelogEntry;
