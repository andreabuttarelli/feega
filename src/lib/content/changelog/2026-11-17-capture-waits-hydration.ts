import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-17',
  title: 'Imports wait for the page to finish loading',
  items: ['Importing a page now waits for sidebars and other parts drawn by scripts, and for lazy images, before capturing it.']
} satisfies ChangelogEntry;
