import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-28',
  title: 'Clearer render failures',
  items: [
    'A browser render link nobody opened now closes after 30 minutes and says so, instead of hanging for two hours.',
    'When a video model refuses a request, the reason is shown instead of a generic error.'
  ]
} satisfies ChangelogEntry;
