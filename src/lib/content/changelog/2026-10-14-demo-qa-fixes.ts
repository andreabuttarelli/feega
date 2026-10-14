import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'Steadier video generation and saves',
  items: [
    'A video you pay for is never lost when the database is slow.',
    'The canvas guide no longer appears for accounts that already finished onboarding.',
    'A save that hits a busy database retries once and says so if it still fails.'
  ]
} satisfies ChangelogEntry;
