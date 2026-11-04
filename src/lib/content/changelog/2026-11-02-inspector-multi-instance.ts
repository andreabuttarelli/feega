import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Multi-select and instance properties',
  items: [
    'Selecting several layers shows X, Y, W and H, with Mixed where they differ.',
    'Spacing stays blank when the selected layers overlap.',
    'Instances show X, Y, W and H and read "Instance of" their main component.',
    'A layer has the same name in Layers and in Properties; text layers are named by their text.'
  ]
} satisfies ChangelogEntry;
