import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-04',
  title: 'Our own motion engine',
  items: [
    'Motion videos, transitions and code components now run on feega’s own animation engine: they look the same, and every frame is the same in the preview and in the export.',
    'Code components keep working as before, with eases, staggers and text split into lines, words or characters.'
  ]
} satisfies ChangelogEntry;
