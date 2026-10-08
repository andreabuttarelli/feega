import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-08',
  title: 'Zoom and pan the motion preview',
  items: [
    'Zoom the preview to Fit, 50%, 100% or 200% from its corner control or with ⌘+ ⌘− ⌘0 ⌘1.',
    'Pinch or ⌘-scroll to zoom where you point; two fingers, space-drag or scroll to pan.',
    'Double-tap around the preview to switch between Fit and 100%.',
    'Double-click the divider above the timeline to reset its height; on touch it has a bigger grip.'
  ]
} satisfies ChangelogEntry;
