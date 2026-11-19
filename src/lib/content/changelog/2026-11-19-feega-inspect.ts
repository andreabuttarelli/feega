import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-19',
  title: 'Feega Inspect for VS Code, Cursor and Windsurf',
  items: [
    'Click an element of your running app inside your editor and change its spacing, type, colour, size, radius, layout or shadow.',
    'Each change is written to your source as a Tailwind class or your own token, and Cmd/Ctrl+Z restores the file.'
  ]
} satisfies ChangelogEntry;
