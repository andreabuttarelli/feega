import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-23',
  title: 'SVG files import as editable layers',
  items: [
    'Dropping or uploading an SVG file gives editable vector layers instead of a flat image.',
    'Imported SVGs keep gradients, rounded corners, clipping and text.'
  ]
} satisfies ChangelogEntry;
