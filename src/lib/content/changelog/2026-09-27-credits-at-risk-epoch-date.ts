import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-27',
  title: 'Fixed a wrong expiry date on the billing page',
  items: [
    'Credits with no expiry no longer show a "1/1/1970" expiry date on the billing page.'
  ]
} satisfies ChangelogEntry;
