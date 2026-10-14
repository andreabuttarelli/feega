import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'Shapes and text take layered strokes',
  items: [
    'Shapes, paths and text stack several strokes, each with a colour or gradient, its own width and an eye to hide it.',
    'A stroke sits inside, centred on or outside the edge.',
    'Rectangles take a different width per side.',
    'Dash, gap, cap and join are set per stroke.',
    'The motion chat and MCP agents set stroke stacks too.'
  ]
} satisfies ChangelogEntry;
