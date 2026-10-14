import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'Profile name and API keys work again',
  items: [
    'Your first and last name in profile settings now save and show up again.',
    'API keys created from the API are tied to the workspace and keep their read or write access.',
    'Post short links, post media download and browser push notifications are retired.'
  ]
} satisfies ChangelogEntry;
