import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-19',
  title: 'Open a running app by its address',
  items: [
    'Feega: Open from URL… and npx feega --url attach the editor to a dev server that is already running, without starting or stopping it.',
    'When a page has no source info, Feega says so and offers to add its plugin or start the server itself.'
  ]
} satisfies ChangelogEntry;
