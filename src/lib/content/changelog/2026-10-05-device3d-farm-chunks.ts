import type { ChangelogEntry } from './index';

const entry: ChangelogEntry = {
  date: '2026-10-05',
  title: 'Faster renders with 3D device mockups',
  items: [
    'Videos with long 3D device shots render on more machines at once and finish instead of timing out',
    'A part of a render that runs out of time is retried in smaller pieces, and a failure names the frames and what to change'
  ]
};

export default entry;
