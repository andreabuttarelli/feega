import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-27',
  title: 'Reference photos on image and video nodes',
  items: [
    'Image and video nodes have a References picker: choose photos from a shared global catalogue or your project media.',
    'Picked references are used automatically when the node generates — no extra nodes to wire.',
    'Media has a new Global tab with the shared reference catalogue.'
  ]
} satisfies ChangelogEntry;
