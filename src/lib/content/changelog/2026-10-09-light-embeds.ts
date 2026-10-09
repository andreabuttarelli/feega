import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-09',
  title: 'Faster embeds on phones',
  items: [
    'Published embeds load a light page and fetch images and music as separate cached files, so the first frame shows sooner.',
    'Embeds below the fold load only as they scroll into view.'
  ]
} satisfies ChangelogEntry;
