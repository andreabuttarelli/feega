import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-18',
  title: 'Faster canvas reopen',
  items: ['Reopened canvases show their nodes at once, and running nodes no longer flicker.']
} satisfies ChangelogEntry;
