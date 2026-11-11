import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'Frames ready before you pan to them',
  items: ['Frames outside the view are loaded and kept with the canvas, so panning no longer shows them empty while they load.']
} satisfies ChangelogEntry;
