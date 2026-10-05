import type { ChangelogEntry } from './index';

const entry: ChangelogEntry = {
  date: '2026-10-05',
  title: 'Select and move layers right in the motion preview',
  items: [
    'Click a layer in the preview to select it; Alt+click picks the one underneath',
    'Drag to move, pull corners and sides to scale (Shift keeps proportions), turn outside a corner to rotate, and move the anchor point',
    'Layers snap to the frame and to each other, with guides',
    'On a keyframed property, dragging sets a keyframe at the playhead',
    'Works with touch'
  ]
};

export default entry;
