import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-04',
  title: 'Motion paths',
  items: [
    'Position can follow a curved motion path, drawn on the preview with draggable handles.',
    'Auto-orient turns a layer along its path; speed along the path follows its keyframe ease.',
    'The motion agent can draw and bend motion paths.'
  ]
} satisfies ChangelogEntry;
