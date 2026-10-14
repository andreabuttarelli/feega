import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'Connection status dot',
  items: [
    'A small dot in the top bar shows whether the canvas is live, reconnecting or offline — no more stuck warning.',
    'The canvas reconnects on its own and catches up on changes made while you were away.',
    'Canvas messages are now all in English.'
  ]
} satisfies ChangelogEntry;
