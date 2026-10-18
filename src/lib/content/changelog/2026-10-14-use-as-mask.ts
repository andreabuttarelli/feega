import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'Use a shape as mask',
  items: [
    'Select a shape and the layers above it, then Use as mask (⌃⌘M): the shape cuts them, soft edges and animation included.',
    'Masked layers sit under their mask in Layers; drag a layer in or out to mask or unmask it, and use the eye to turn the mask off.',
    'Track mattes show the matted layer again; before, it rendered empty.'
  ]
} satisfies ChangelogEntry;
