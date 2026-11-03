import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-03',
  title: 'Cleaner page imports',
  items: ['Imported layers are named by what they show, never by HTML tag.', 'Footer columns and one-off sections no longer become components.', 'Colours that look the same in an imported page become one colour.']
} satisfies ChangelogEntry;
