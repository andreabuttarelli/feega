import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Sharper graphic design on the canvas',
  items: [
    'Dropping an image onto a frame puts it inside the frame, clipped to it',
    'Dragging an image into a frame keeps the picture, and Undo takes it back out',
    'Image fills show at once, and the empty fill opens a file picker on click',
    'Union, Subtract, Intersect and Exclude make one shape, named after the operation and boxed tightly',
    'New layers rotate and scale around their centre',
    'Blend modes on a group now blend the whole group',
    'Linear gradients keep their angle at every zoom',
    'Pen strokes stay seamless when zoomed in',
    'Moving a point outside a shape grows its box to fit'
  ]
} satisfies ChangelogEntry;
