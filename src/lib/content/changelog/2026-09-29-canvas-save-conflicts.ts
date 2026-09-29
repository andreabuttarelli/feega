import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-29',
  title: 'Canvas edits survive simultaneous changes',
  items: [
    'Editing a node while it updates elsewhere now keeps your change instead of failing.',
    'Save errors on the canvas now say what went wrong.'
  ]
} satisfies ChangelogEntry;
