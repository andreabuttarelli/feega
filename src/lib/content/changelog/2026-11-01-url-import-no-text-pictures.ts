import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-01',
  title: 'Imported navs and cards stay editable',
  items: [
    'Blocks with text, links or buttons inside never come in as a picture: shadows, blends and fades are kept on editable layers.',
    'Sticky navigation bars built with Tailwind no longer come in as a single image.'
  ]
} satisfies ChangelogEntry;
