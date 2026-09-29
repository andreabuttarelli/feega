import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-29',
  title: 'Cleaner mobile layout',
  items: [
    'On mobile, the Canvas/Chat switch sits at the bottom, next to the node bar.',
    'Promote works from the mobile top bar.',
    'The chat box no longer hides its placeholder on mobile.',
    'Menus, sheets and the selection toolbar fit small screens with larger touch targets.'
  ]
} satisfies ChangelogEntry;
