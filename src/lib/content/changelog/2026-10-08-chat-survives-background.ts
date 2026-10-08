import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-08',
  title: 'Chat keeps working when you leave',
  items: [
    'Switching app or locking your phone mid-reply no longer loses the chat: the agent keeps working and you see its answer when you come back.',
    'Your unsent message stays in the composer after a reload.'
  ]
} satisfies ChangelogEntry;
