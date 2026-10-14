import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'Layers shows every frame',
  items: [
    'Layers lists the contents of every frame, not only the open one; click one to open its frame on it.',
    'Hovering a layer outlines it on the canvas.',
    'Clicking on the canvas or in Layers now always selects one thing; shift or ⌘ adds.'
  ]
} satisfies ChangelogEntry;
