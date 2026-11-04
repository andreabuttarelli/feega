import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Hide and lock nodes',
  items: [
    '⇧⌘H hides and ⇧⌘L locks frames, images and groups on the canvas',
    'Every node in Layers has its own eye and lock, and hidden nodes are dimmed',
    'Undo after a change to a frame no longer breaks the next edit to it'
  ]
} satisfies ChangelogEntry;
