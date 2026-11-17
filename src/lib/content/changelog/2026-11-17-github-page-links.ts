import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-17',
  title: 'Every imported page stays linked to its code',
  items: ['A code import now links each page it captured, and the components those pages use, so changes to any file a page imports show up on its frame.', 'The Changes panel shows each frame before and after your edits.']
} satisfies ChangelogEntry;
