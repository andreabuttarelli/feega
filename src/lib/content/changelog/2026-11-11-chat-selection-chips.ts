import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'The chat shows what you selected',
  items: [
    'Whatever you select on the canvas or inside a frame now appears as chips above the chat input, and the agent acts on it.',
    'Remove a chip to send without it; sent messages keep their chips after a reload.'
  ]
} satisfies ChangelogEntry;
