import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-14',
  title: 'Sharper site imports',
  items: [
    'A very long imported page now starts at the top of its own frame instead of spilling halfway into the next one.',
    'Imported tables keep their text colour, font and size, and thin borders stay thin on large boards.',
    'Text cut with an ellipsis on the site is cut the same way on the canvas.',
    'Imports no longer capture an element in its hover state after a cookie banner is dismissed.'
  ]
} satisfies ChangelogEntry;
