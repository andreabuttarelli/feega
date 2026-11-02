import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Shapes and text on the canvas act as one object',
  items: [
    'X, Y, W, H and rotation of a shape or text on the canvas are its real place and size, in canvas pixels',
    'Type size, radius, stroke, blur, shadows, gap and padding show canvas pixels',
    'Position, size and rotation fields can be scrubbed, and one undo puts back size, text size or rotation',
    'Shadows and glows show past the shape instead of being cut off',
    'Flip and rotate 90° turn a shape in place, and arrow keys move it by 1 or 10 px',
    'Cmd+D duplicates a shape as a new layer, and dragging a text box handle now resizes it'
  ]
} satisfies ChangelogEntry;
