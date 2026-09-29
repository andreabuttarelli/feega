import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-29',
  title: 'Cleaner project pages',
  items: [
    'Every project page now has a header with its title and a link back to the canvas.',
    'Settings show their sections in a side menu on desktop.',
    'The calendar is in English.',
    'Brand logos that fail to load show the brand initials instead of a broken image.',
    'Buttons use one primary style across the app.'
  ]
} satisfies ChangelogEntry;
