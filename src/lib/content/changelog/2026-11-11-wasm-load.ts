import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'Canvases open faster on return visits',
  items: ['The canvas engine is cached by your browser between visits and starts downloading while the canvas data loads.']
} satisfies ChangelogEntry;
