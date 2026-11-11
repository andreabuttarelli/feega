import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'Motion playback keeps up',
  items: ['Playing a heavy motion frame on the canvas now skips frames it cannot draw in time instead of falling behind the timeline.']
} satisfies ChangelogEntry;
