import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-19',
  title: 'Feega opens your app faster',
  items: [
    'Feega reuses the dev server you already run for the app, on any port.',
    'Closing and reopening the editor keeps its dev server warm, ten minutes by default (setting "Keep the dev server after closing"); Stop now ends it.'
  ]
} satisfies ChangelogEntry;
