import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-19',
  title: 'Feega for VS Code 0.2.0',
  items: [
    'Feega is now a VS Code extension: design in your codebase.',
    'In a repository with several apps, Feega asks which one to open and remembers it; Choose app… switches.',
    'Missing dependencies install automatically on first run, with progress and Cancel.',
    'The preview opens as soon as the dev server listens, and a server that cannot start says why right away.',
    'Every process Feega starts stops with the panel or the window.',
    'Open the running app is now Open from current workspace.'
  ]
} satisfies ChangelogEntry;
