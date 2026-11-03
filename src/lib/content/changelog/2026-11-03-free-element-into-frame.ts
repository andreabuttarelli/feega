import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-03',
  title: 'Drag free elements into frames from Layers',
  items: [
    'Drag a free element row in Layers onto a frame, or onto a layer or stack inside it, to move it there.',
    'Dragging a free element over a stack on the canvas shows the line where it will land.',
    '⇧A on a shape you just drew inside a frame wraps only that shape, not the whole frame.'
  ]
} satisfies ChangelogEntry;
