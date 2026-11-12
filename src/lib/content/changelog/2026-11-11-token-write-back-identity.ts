import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'Token write-back survives edits above',
  items: ['Editing a design token no longer reports "changed in the code" just because lines were added or removed above it.']
} satisfies ChangelogEntry;
