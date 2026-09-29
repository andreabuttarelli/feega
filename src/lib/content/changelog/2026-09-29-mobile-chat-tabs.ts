import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-29',
  title: 'Chat keeps working when you switch tabs',
  items: [
    'Switching between Chat and Canvas no longer interrupts the assistant.',
    'The canvas shows new nodes as soon as you return to it.',
    'Replies are saved even if you close or reload the page mid-answer.',
    'Leaving the project while the assistant works asks for confirmation.'
  ]
} satisfies ChangelogEntry;
