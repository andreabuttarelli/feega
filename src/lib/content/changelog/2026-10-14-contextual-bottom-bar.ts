import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'One bottom bar that follows what you edit',
  items: [
    'The bottom bar switches to drawing tools, image and templates while a frame is open, and back to canvas tools when it closes.',
    'Poster photos and arrows are their own elements: select one and press Delete to remove it, or right-click a line to insert a photo after it.'
  ]
} satisfies ChangelogEntry;
