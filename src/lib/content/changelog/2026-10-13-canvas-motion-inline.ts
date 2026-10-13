import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-13',
  title: 'Edit videos right on the canvas',
  items: [
    'Click a video on the canvas to edit it in place: it plays in its node, with the timeline below and the agent and properties beside it.',
    'A Layers panel lists everything on the canvas and every track and clip of the open video.',
    'The canvas has fixed bars around it, and side panels make room instead of covering it.'
  ]
} satisfies ChangelogEntry;
