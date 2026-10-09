import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-09',
  title: 'Safer agent edits and Undo',
  items: [
    'The motion agent applies its edits in order, so edits inside several compositions no longer mix them up.',
    'Undo waits while the agent is working, and never empties a video.'
  ]
} satisfies ChangelogEntry;
