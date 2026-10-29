import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-29',
  title: 'Canvas edits show at once',
  items: [
    'Moving an element into a frame, wrapping with a stack and wrapping in a section now happen instantly; saving continues in the background.',
    'If a change cannot be saved, the canvas puts it back and tells you.'
  ]
} satisfies ChangelogEntry;
