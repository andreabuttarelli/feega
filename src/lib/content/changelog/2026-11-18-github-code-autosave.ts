import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-18',
  title: 'Code autosave for GitHub frames',
  items: [
    'Editing a frame imported from GitHub now commits the code as you work, to a draft pull request',
    'Ready for review replaces the manual push',
    'Name the branch, or commit straight to the base branch',
    'The top bar shows repo, branch, save state, pull request and CI'
  ]
} satisfies ChangelogEntry;
