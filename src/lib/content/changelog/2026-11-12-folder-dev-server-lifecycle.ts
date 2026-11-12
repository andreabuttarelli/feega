import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-12',
  title: 'Folder imports clean up after themselves',
  items: ['Importing from a local folder stops the project’s dev server when the import ends, and when feega quits.']
} satisfies ChangelogEntry;
