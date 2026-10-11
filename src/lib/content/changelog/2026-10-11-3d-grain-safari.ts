import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-11',
  title: '3D scenes with grain play smoothly everywhere',
  items: [
    'Grainy 3D objects show up in Safari on Retina screens.',
    '3D scenes with grain play at full frame rate in wide embeds.',
    'Embedding the same video twice on a page now logs a warning.'
  ]
} satisfies ChangelogEntry;
