import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-03',
  title: 'Layers in paint order',
  items: [
    'Layers lists the frontmost layer first, on the canvas and inside frames',
    'Exported code keeps linear gradients at the angle you set',
    'A blend mode on a group of shapes blends with what is underneath it'
  ]
} satisfies ChangelogEntry;
