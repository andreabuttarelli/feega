import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'Light and Dark boards side by side',
  items: [
    'Any board or layer can use its own variable mode, so Light and Dark versions sit side by side and follow the same tokens.',
    'Dark boards imported from code are bound to your tokens instead of copying their colours.',
    'Pull keeps your token edits, adds new tokens, follows renames and reports conflicts.',
    'Spacing utilities like p-4 now link to your spacing token, and folders uploaded from the browser bring their tokens too.'
  ]
} satisfies ChangelogEntry;
