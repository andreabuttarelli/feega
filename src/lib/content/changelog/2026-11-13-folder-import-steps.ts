import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-13',
  title: 'Folder imports that explain themselves',
  items: [
    'Importing a folder without installed dependencies now installs them first, instead of failing.',
    'In VS Code, a folder import shows each step as it happens, and a failure shows the dev server log with a Retry button.'
  ]
} satisfies ChangelogEntry;
