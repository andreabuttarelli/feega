import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-05',
  title: 'A layer timeline for motion',
  items: [
    'Every clip has its own row in the timeline, grouped under its track.',
    'Twirl a layer open to see each animated property, its value and its keyframes.',
    'Hide or lock a single layer from its row.',
    'The ruler counts in round steps and the playhead is red, so it never gets lost.'
  ]
} satisfies ChangelogEntry;
