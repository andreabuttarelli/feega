import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-29',
  title: 'Agent writes text the canvas can show',
  items: [
    'When you ask the canvas agent for written copy, it lands in a document node you can read and edit.',
    'The agent no longer reports a node as added when the canvas could not show its content.'
  ]
} satisfies ChangelogEntry;
