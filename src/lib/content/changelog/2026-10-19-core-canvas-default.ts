import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-19',
  title: 'New canvas renderer by default',
  items: ['The canvas now draws frames, cards and wires with the same engine as the video editor, and loads less code.', 'Frames with custom components show their real content on the canvas instead of a preview image.']
} satisfies ChangelogEntry;
