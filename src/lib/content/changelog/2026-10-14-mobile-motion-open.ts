import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'Faster video editor on phones',
  items: [
    'Opening a video on the canvas shows the editor in half a second on a phone, and the first frame in under one.',
    'The video stays on its node while the canvas zooms to it.'
  ]
} satisfies ChangelogEntry;
