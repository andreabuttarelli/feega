import type { ChangelogEntry } from './index';

const entry: ChangelogEntry = {
  date: '2026-10-05',
  title: 'Bento compositions, with motions inside',
  items: [
    'New Bento composition: a grid of rounded cells, with cells spanning rows or columns',
    'One gap sets both the space between cells and the margin to the edge',
    'Each cell has its own fit, crop and colour; corners and a cascade entrance are adjustable',
    'Connect a motion node to a composition: it plays inside its cell, live, and exports with it'
  ]
};

export default entry;
