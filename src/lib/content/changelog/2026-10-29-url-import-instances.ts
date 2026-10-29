import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-29',
  title: 'More components from imported pages',
  items: [
    'Sidebar rows, nav links and buttons in rows of an imported page now become components too.',
    'Copies of a different size or with a different icon stay linked to their component.',
    'Imported components show a real preview in the Components panel.',
    'Deeply nested groups and icons in imported pages are no longer missing.'
  ]
} satisfies ChangelogEntry;
