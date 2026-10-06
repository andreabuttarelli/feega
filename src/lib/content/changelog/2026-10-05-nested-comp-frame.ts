import type { ChangelogEntry } from './index';

const entry: ChangelogEntry = {
  date: '2026-10-05',
  title: 'Motions inside compositions keep their shape',
  items: [
    'A motion placed in a composition of another format keeps its own proportions and background',
    'Interactive motions inside a composition cell follow the cursor in their own frame',
    'Grids inside a looping motion stay filled on every loop'
  ]
};

export default entry;
