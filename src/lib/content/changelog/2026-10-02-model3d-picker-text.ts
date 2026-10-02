import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-02',
  title: '3D models from text',
  items: [
    'Pick the 3D model, its resolution and texturing from the node toolbar, with the price per run.',
    'A 3D node now takes a description: it draws a product shot first, then models it.',
    'Image-only 3D runs are no longer blocked by the safety check.',
    'New template: Text → 3D model.'
  ]
} satisfies ChangelogEntry;
