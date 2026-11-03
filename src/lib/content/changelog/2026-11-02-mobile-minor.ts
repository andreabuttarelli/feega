import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Frame key, zoom readout and new canvases in a project',
  items: [
    'F picks the frame tool.',
    'The View menu shows the zoom level and the same zoom keys as the shortcut card: ⇧1 fit, ⇧0 100%, ⇧2 selection.',
    'Space-drag with a mouse moves the canvas exactly with the pointer and stops when you let go.',
    'New canvas can start in a project you already have, and the canvas shows in its pages.',
    'A pen path starts as a black 1 px line.'
  ]
} satisfies ChangelogEntry;
