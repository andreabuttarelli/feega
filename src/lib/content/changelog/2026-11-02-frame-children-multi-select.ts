import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Select many layers inside a frame',
  items: [
    'Shift-click and Cmd-click inside a frame add layers to the selection instead of selecting the frame.',
    'Dragging on the background of a frame draws a selection box over its layers; move a frame by its title or once it is selected.',
    'Dropping a layer from another frame or from the canvas onto a stack adds it to the stack.'
  ]
} satisfies ChangelogEntry;
