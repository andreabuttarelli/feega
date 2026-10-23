import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-23',
  title: 'Figma paste keeps what you copied',
  items: [
    'Shapes, text and groups copied in Figma now land as free elements on the canvas, not inside a new frame; frames and sections still land as frames',
    'Pasting over a frame puts everything inside it',
    'Rotation, stacked fills and strokes, and auto layout (direction, spacing, padding, alignment, sizing) come across from Figma'
  ]
} satisfies ChangelogEntry;
