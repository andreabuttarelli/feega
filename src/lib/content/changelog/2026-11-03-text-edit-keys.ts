import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-03',
  title: 'Faster text editing',
  items: ['Undo while typing goes back a word at a time.', 'Typing "- " or "1. " at the start of a line starts a list.', '⌘⇧X strikes through the selected text.']
} satisfies ChangelogEntry;
