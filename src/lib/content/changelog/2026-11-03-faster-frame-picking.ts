import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-03',
  title: 'Faster selection inside frames',
  items: ['Clicking, hovering and dragging elements inside a frame responds faster on large canvases.', 'A frame’s contents can be selected as soon as the frame appears, without waiting for the rest of the canvas.']
} satisfies ChangelogEntry;
