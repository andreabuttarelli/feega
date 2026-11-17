import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-17',
  title: 'Local chat finds your coding agents',
  items: [
    'Local Feega now detects the coding agents installed on your computer, with version and sign-in status, and shows the command to install or log in to the rest.',
    'The agent you pick is remembered in the .feega file.',
    'New `feega agents` command lists them from the terminal.'
  ]
} satisfies ChangelogEntry;
