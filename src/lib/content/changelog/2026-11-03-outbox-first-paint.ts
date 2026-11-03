import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-03',
  title: 'Offline edits show right after a reload',
  items: [
    'Shapes moved offline show where you left them as soon as the canvas reopens.',
    'Undo removes a shape drawn offline at once, without waiting for the connection.',
    'The save status no longer stays on Saving after everything has landed.'
  ]
} satisfies ChangelogEntry;
