import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-02',
  title: '3D models',
  items: [
    'Add a 3D model node: connect a product image and get a 3D model you can spin, zoom and download as GLB.',
    'Render views turns the model into four images, ready for the rest of the canvas.',
    'New template: Product → 3D model.'
  ]
} satisfies ChangelogEntry;
