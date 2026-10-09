import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-09',
  title: 'Scroll embeds that always move',
  items: [
    'Scroll-scrubbed embeds now follow their own path through the screen, on any page length.',
    'Wrap an embed in data-scroll="3" for a sticky scroll story three screens long.',
    'An embed link opened on its own now scrolls and scrubs by itself.'
  ]
} satisfies ChangelogEntry;
