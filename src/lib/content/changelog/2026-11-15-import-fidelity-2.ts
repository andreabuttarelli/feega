import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-15',
  title: 'Site imports keep more details',
  items: [
    'A component inside another component (like a search field in a navbar) now stays where it belongs.',
    'Imported lists keep their bullets and numbers.',
    'Images inside rounded cards keep their rounded corners.'
  ]
} satisfies ChangelogEntry;
