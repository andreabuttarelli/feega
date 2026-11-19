import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-19',
  title: 'Faster live frames',
  items: [
    'Live frames show a sharp snapshot on the canvas, so canvases with many of them stay smooth; double-click one to edit the running page.',
    'Snapshots refresh when your dev server reloads a change.',
    'Source mapping works whatever the order of plugins in your Vite config.'
  ]
} satisfies ChangelogEntry;
