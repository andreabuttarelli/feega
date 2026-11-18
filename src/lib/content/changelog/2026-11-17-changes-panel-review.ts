import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-17',
  title: 'Review code changes before pushing',
  items: [
    'The Changes panel lists each page with its changed files and diffs, starts with nothing selected, and shows exactly which files will be pushed before pushing.',
    'When no pull request can be opened, the panel says so and lets you copy the pushed branch.'
  ]
} satisfies ChangelogEntry;
