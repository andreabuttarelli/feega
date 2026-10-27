import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-26',
  title: 'A floating sidebar',
  items: [
    'The sidebar now floats with a gap from the window edges.',
    'Your account and workspace stay at the bottom while the rest scrolls.',
    'The projects list is gone from the sidebar.'
  ]
} satisfies ChangelogEntry;
