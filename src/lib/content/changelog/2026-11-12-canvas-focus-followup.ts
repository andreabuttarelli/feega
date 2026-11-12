import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-12',
  title: 'Shortcuts right after a toolbar click',
  items: [
    'After clicking a toolbar tool, canvas shortcuts work straight away.',
    'Typing in a field never triggers timeline shortcuts.',
    'Escape in a menu or popover closes only that popup and keeps the selection.'
  ]
} satisfies ChangelogEntry;
