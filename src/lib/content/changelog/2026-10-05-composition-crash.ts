import type { ChangelogEntry } from './index';

const entry: ChangelogEntry = {
  date: '2026-10-05',
  title: 'Canvas no longer goes blank with a connected composition',
  items: [
    'Fixed: a canvas with a composition fed by another node crashed and showed nothing',
    'A node that fails to display now shows its error in place, and the rest of the canvas keeps working'
  ]
};

export default entry;
