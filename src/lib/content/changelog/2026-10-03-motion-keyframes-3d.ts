import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-03',
  title: 'Motion editor: keyframes and 3D',
  items: [
    'Animate position, scale, rotation on X/Y/Z, skew, depth, perspective, opacity, blur and colours with keyframes.',
    'Each clip opens into keyframe lanes in the timeline: drag, multi-select, copy and paste keyframes, pick an ease per segment with a curve preview.',
    'The properties panel shows values at the playhead, a ◆ toggle per property, rotation dials and an anchor picker.',
    '3D models animate their rotation and the camera orbit, dolly and field of view.',
    'J and K jump to the previous and next keyframe.',
    'The Motion agent can animate clips with keyframes and 3D transforms.'
  ]
} satisfies ChangelogEntry;
