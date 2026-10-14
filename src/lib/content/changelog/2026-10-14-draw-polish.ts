import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'Sharper drawing tools in frames',
  items: [
    'Rectangles round each corner on its own, from Properties or a handle on the canvas.',
    'The pen adds a point where you click on a path; Delete removes the selected point.',
    'In Design mode the arrow keys move the selection by 1 px, with Shift by 10.',
    'Moving or resizing snaps to nearby edges and centres and shows the distances.',
    'Align and distribute several elements from Properties, and ask the agent to do it.'
  ]
} satisfies ChangelogEntry;
