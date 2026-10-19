import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-18',
  title: 'Frames: select, move, open',
  items: [
    'Click a frame to select it, drag it to move it, double-click to edit what is inside.',
    'Frame tiles no longer show an Open editor button.',
    'On a phone, opening a frame keeps the canvas where it is.'
  ]
} satisfies ChangelogEntry;
