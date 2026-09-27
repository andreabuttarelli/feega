import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-27',
  title: 'Create post fixes',
  items: [
    'Create post now shows a clear error message if saving fails, without losing what you wrote.',
    'Reordering media in Create post is kept when the post is saved.'
  ]
} satisfies ChangelogEntry;
