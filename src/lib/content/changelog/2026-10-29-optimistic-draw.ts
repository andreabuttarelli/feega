import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-29',
  title: 'Instant drawing and duplicating',
  items: [
    'Shapes, text and paths appear the moment you finish drawing them, inside a frame or free on the canvas.',
    'Drawing a shape over a frame puts it straight into the frame.',
    'Duplicated frames, elements and nodes appear the moment you press ⌘D, Alt-drag or pick Duplicate.',
    '⌘D on an element inside a frame copies that element, not the whole frame.'
  ]
} satisfies ChangelogEntry;
