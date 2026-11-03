import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-03',
  title: 'Conflict notice',
  items: [
    'When someone else changes the same thing first, you now see a notice on the canvas instead of only in History.',
    'Conflict rows in History show their Keep mine and Keep theirs buttons in a single line.',
    'Deleting or moving something that is already gone no longer reports an error.'
  ]
} satisfies ChangelogEntry;
