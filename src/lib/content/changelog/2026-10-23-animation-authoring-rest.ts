import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-23',
  title: 'Design and Animate mode, groups in the timeline',
  items: [
    'A Design / Animate switch under every frame (and the E key): Design moves a whole animation when you move an element, Animate keys the change at the playhead.',
    'Dragging a keyframe shows the snap guide when it locks onto another key, clip edge, marker or the playhead.',
    'Convert to keys turns an expression into plain keyframes you can edit by hand.',
    'Select several segments in the timeline and Group them into one that moves as a unit.'
  ]
} satisfies ChangelogEntry;
