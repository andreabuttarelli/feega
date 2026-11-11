import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'Steadier canvas start in Safari',
  items: ['Canvases in Safari start the graphics engine once, instead of losing and restarting it while frames load.']
} satisfies ChangelogEntry;
