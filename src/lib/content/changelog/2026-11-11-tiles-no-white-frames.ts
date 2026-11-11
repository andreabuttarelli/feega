import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'No empty frames while zooming',
  items: ['With the new tiled renderer, frames no longer flash white or empty while you zoom right after opening a canvas.']
} satisfies ChangelogEntry;
