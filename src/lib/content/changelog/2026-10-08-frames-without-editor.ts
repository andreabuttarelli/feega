import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-08',
  title: 'The motion agent keeps going when the editor is away',
  items: ['When the editor is not open, the agent skips its visual check instead of failing and waiting, and finishes the turn.']
} satisfies ChangelogEntry;
