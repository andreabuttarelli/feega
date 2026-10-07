import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-07',
  title: 'A sidebar for the dashboard',
  items: [
    'The dashboard has a sidebar that stays open on desktop, with your projects and every tool one click away.',
    'On phones the same menu opens from the top-left button.',
    'The dashboard is cleaner: fewer lines, larger previews.',
    'Dark mode uses a pure black background.'
  ]
} satisfies ChangelogEntry;
