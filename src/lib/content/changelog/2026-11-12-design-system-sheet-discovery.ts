import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-12',
  title: 'Design tokens from every stylesheet your app loads',
  items: [
    'Importing from code now finds tokens in any stylesheet the page loads, including Nuxt 4 and monorepo theme packages.',
    'Tokens that only exist in the running page are imported read-only and marked as such.'
  ]
} satisfies ChangelogEntry;
