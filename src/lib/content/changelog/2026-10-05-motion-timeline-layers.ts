import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-05',
  title: 'A layer timeline for motion',
  items: [
    'Every clip has its own row in the timeline, grouped under its track.',
    'Twirl a layer open to see each animated property and its keyframes.',
    'Drag a property value in the timeline to change it, or click it to type, in px, % and degrees.',
    'Hide or lock a single layer from its row.',
    'Pinch the timeline to zoom on touch screens.',
    'The ruler counts in round steps and the playhead is red, so it never gets lost.'
  ]
} satisfies ChangelogEntry;
