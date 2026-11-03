import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Frames read in canvas pixels',
  items: [
    'A frame and everything inside it now show their size, radius, gap and type in the same pixels you see on the canvas.',
    'Frame size and presets set how big the frame is on the canvas.',
    'Image exports pick the resolution: 1× is the frame as big as on the canvas, and exports start at 2×.',
    'Resizing a frame keeps its layers, type and corner radius at their size and applies their constraints.',
    'Text styles keep their pixel size in every frame.',
    'Typing a width on a text keeps it.'
  ]
} satisfies ChangelogEntry;
