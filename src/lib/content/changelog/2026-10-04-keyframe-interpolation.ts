import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-04',
  title: 'Keyframe interpolation',
  items: [
    'Keyframes can be Bezier, Linear, Hold, Auto-bezier or Continuous, separately on the way in and out.',
    'Roving position keyframes keep the speed even between their neighbours.',
    'The motion agent can set and change keyframe interpolation.'
  ]
} satisfies ChangelogEntry;
