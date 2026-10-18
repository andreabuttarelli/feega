import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-18',
  title: 'Playback no longer gets stuck on the first frame',
  items: ['A work area shorter than half a second no longer traps playback: Space plays the whole video again.']
} satisfies ChangelogEntry;
