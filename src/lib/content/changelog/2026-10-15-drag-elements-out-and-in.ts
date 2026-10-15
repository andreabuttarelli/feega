import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-15',
  title: 'Drag elements out of frames and back in',
  items: [
    'Drag an element out of a frame onto the canvas: it stays a free element with the same look and size you saw.',
    'Drag a free element onto a frame to put it inside. ⌘Z undoes either move.',
    '⌘Z after deleting something on the canvas brings it back again.'
  ]
} satisfies ChangelogEntry;
