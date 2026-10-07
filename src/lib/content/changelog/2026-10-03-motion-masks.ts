import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-03',
  title: 'Motion editor: masks and track mattes',
  items: [
    'Mask any clip with a rectangle, ellipse, polygon, text, a picture, its brightness, or a linear or radial gradient.',
    'Feather, expand, rotate, invert and fade masks, and animate them with keyframes.',
    'Move and resize the mask on the preview, and drag polygon points.',
    'Use the clip on the track above as an alpha or luma matte, for text filled with video.',
    'The Motion agent can add masks and mattes, and sees them in the frames it checks.'
  ]
} satisfies ChangelogEntry;
