import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-19',
  title: 'Feega Inspect for VS Code, Cursor and Windsurf',
  items: [
    'Click an element of your running app inside your editor and change its spacing, type, colour, size, radius, layout or shadow.',
    'Each change is written to your source as a Tailwind class or your own token, or as plain CSS in projects without Tailwind, and Cmd/Ctrl+Z restores the file.',
    'Double-click a text to rewrite it in place.',
    'Switch between Design and Navigate, move through your routes, and preview at desktop, tablet or phone width.',
    'Inspect reuses a dev server you already started only when it belongs to the open project.',
    '"This element" now changes only the selected element, even when it shares a class with others.',
    'Open in editor jumps to the exact line, and text that comes from data points at where the data is defined.',
    'Headings and paragraphs that wrap styled spans now show Typography.'
  ]
} satisfies ChangelogEntry;
