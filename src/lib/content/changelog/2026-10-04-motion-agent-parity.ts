import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-04',
  title: 'The motion agent sees and edits the whole video',
  items: [
    'The motion agent can rename, reorder and remove tracks, and unregister assets a video no longer uses.',
    'It now reads transition lengths, media trims and track names when it looks at your video.'
  ]
} satisfies ChangelogEntry;
