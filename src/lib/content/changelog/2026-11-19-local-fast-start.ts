import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-19',
  title: 'Local canvas starts faster',
  items: [
    '`npx feega` opens the browser at once and starts from the app it already has, updating in the background for next time.',
    'A new app version installs in seconds instead of half a minute when its dependencies have not changed.',
    'The VS Code extension opens a canvas about half a second sooner, and closing a tab while it starts now stops its server.'
  ]
} satisfies ChangelogEntry;
