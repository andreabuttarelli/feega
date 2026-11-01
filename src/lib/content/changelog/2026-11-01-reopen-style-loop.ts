import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-01',
  title: 'Canvases with imported pages open without freezing',
  items: ['Reopening a canvas with an imported page no longer freezes it: the page draws right away and zoom works while it loads.']
} satisfies ChangelogEntry;
