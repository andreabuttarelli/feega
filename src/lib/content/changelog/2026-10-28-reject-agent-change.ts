import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-28',
  title: 'Reject one agent change',
  items: [
    'Reject any single agent change from the canvas, and keep every edit you made after it.',
    'If you edited the same field since, you choose: keep yours or take the reject.',
    'A reject is one step you can undo.'
  ]
} satisfies ChangelogEntry;
