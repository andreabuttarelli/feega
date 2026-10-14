import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'One chat for the canvas and every frame',
  items: [
    'The chat inside a frame is now the same conversation as the canvas chat.',
    'The chat knows which frame you have open, what you selected and where the playhead is, and edits it directly.',
    'Earlier chats about a frame stay readable above the conversation.'
  ]
} satisfies ChangelogEntry;
