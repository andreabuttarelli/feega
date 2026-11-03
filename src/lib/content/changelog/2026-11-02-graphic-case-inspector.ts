import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Export and inspector polish',
  items: [
    'Frames and layers have an Export section in the right bar: pick scales and formats, then Export',
    'Type "export" in the command palette to export the selection',
    'Shift+R shows the rulers in Design',
    'Layout grid, pixel grid and outline toggles are remembered',
    'W and H of a frame now resize it on the canvas',
    'Drawing a shape no longer zooms the view out',
    'Several selected layers show their combined X, Y, W and H',
    'A page added with + shows up in the Pages list right away',
    'The fill editor sits above the bottom toolbar',
    'Layout grid fields are labelled'
  ]
} satisfies ChangelogEntry;
