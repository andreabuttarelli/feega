import type { ChangelogEntry } from './index';

const entry: ChangelogEntry = {
  date: '2026-10-05',
  title: 'Motion properties in pixels, percent and degrees',
  items: [
    'Position, size and translate are in pixels of the composition, scale and opacity in percent, rotation in degrees',
    'Sliders span the composition and move one pixel, percent or degree per step, with the unit beside the field',
    'The motion assistant uses the same units'
  ]
};

export default entry;
