import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-26',
  title: 'More layer effects',
  items: [
    'New effects: displacement map, radial blur, lens blur, bulge, twirl and sharpen.',
    'Chroma key removes a green or blue screen, with spill suppression.',
    'All of them can be keyframed and used by the motion agent.'
  ]
} satisfies ChangelogEntry;
