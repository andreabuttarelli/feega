import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-18',
  title: 'Code autosave for GitHub frames',
  items: [
    'Choose the branch your edits go to, including main, or start a new one',
    'Edits to a frame imported from GitHub are saved to code as you work',
    'Saved work becomes commits with a summary message every few minutes, or when you commit now',
    'Open a pull request into any branch, and mark it ready from the top bar',
    'The top bar shows repo, branch, save state, pull request and CI'
  ]
} satisfies ChangelogEntry;
