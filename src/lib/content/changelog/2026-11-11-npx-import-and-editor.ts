import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'Feega in Cursor and VS Code',
  items: [
    'Running `npx feega` inside a project asks to import it: your app’s home page lands on the canvas as an editable frame.',
    'The Feega extension for Cursor and VS Code opens .feega files as a canvas in an editor tab.',
    'Your editor’s agent connects to the open canvas automatically and edits it live.'
  ]
} satisfies ChangelogEntry;
