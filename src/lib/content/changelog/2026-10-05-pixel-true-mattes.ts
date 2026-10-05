import type { ChangelogEntry } from './index';

const entry: ChangelogEntry = {
  date: '2026-10-05',
  title: 'Track mattes from any layer, and stacked masks',
  items: [
    'Track mattes now use the layer above exactly as it renders: animated text, video, 3D and custom layers can all reveal the clip below',
    'New inverted alpha and inverted luma mattes',
    'Clips take several masks, each set to add, subtract, intersect or difference'
  ]
};

export default entry;
