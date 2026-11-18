import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-18',
  title: 'Edit your running app from the canvas',
  items: [
    'In local Feega, click an element inside a live frame and change its text, colours, type, spacing or radius: the change is written to your source file.',
    'Values that match your theme are written as your own tokens, and only the one class or text changes.',
    'Edits land on a separate `feega/live` branch, undo with Cmd/Ctrl+Z, and Push sends them to GitHub.',
    'Agents can do the same with `feega live-edit` and the `live_edit` tool.',
    'Live frames and element picking now work in SvelteKit apps.'
  ]
} satisfies ChangelogEntry;
