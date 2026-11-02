import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Cleaner edges on the canvas',
  items: [
    'Shapes on the canvas no longer show a white ring or white specks along their edges.',
    'In Motion, the bottom toolbar moves above the timeline the moment it opens, instead of sliding across it.'
  ]
} satisfies ChangelogEntry;
