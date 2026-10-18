import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-18',
  title: 'Canvas stays drawn',
  items: ['Nodes no longer vanish from the canvas after zooming out or a long session.', 'Dragging a selection box on the canvas no longer highlights page text.']
} satisfies ChangelogEntry;
