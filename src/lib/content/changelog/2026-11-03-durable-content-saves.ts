import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-03',
  title: 'Edits survive offline and closed tabs',
  items: [
    'Fills, text and other changes inside an element now save after a lost connection or a closed tab.',
    'Shapes drawn offline stay on the canvas and save when you are back online.',
    'The save status counts every waiting change, and closing the tab warns while any is unsent.',
    'Undoing right before a reload is no longer lost.'
  ]
} satisfies ChangelogEntry;
