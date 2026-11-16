import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-16',
  title: 'Figma import keeps more of your design',
  items: [
    'Figma pastes and links keep constraints, minimum and maximum sizes, and mask layers',
    'Text keeps its vertical alignment, paragraph spacing, indent and gradient colors',
    'Strokes keep caps, joins and dash patterns; hidden layers stay in the layer list, hidden',
    'Cropped and tiled images keep their crop, scale and rotation'
  ]
} satisfies ChangelogEntry;
