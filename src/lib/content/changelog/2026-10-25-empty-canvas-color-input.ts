import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-25',
  title: 'Empty canvas and faster colour typing',
  items: [
    'A new canvas opens empty, without the starting-point overlay.',
    'Colour fields accept short hex like f, ff or fff, and 4 or 8 digits with opacity.',
    'Colour fields accept rgb(), rgba() or bare numbers like 255 0 0 50%, with alpha setting opacity.'
  ]
} satisfies ChangelogEntry;
