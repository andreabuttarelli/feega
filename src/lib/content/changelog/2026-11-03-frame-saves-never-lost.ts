import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-03',
  title: 'Frames hold hundreds of layers and tall pages',
  items: [
    'Frames hold hundreds of layers, and deleting layers no longer fills the frame up',
    'Pasting layers with another frame selected puts them in that frame',
    'Frames take tall pages, up to 16384 px a side; video size limits apply only when you export'
  ]
} satisfies ChangelogEntry;
