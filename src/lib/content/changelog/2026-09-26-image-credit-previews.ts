import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-26',
  title: 'Generation cost previews follow the selected model',
  items: [
    'Image generation now uses the cheapest eligible provider price without locking routing.',
    'Text generation and loops now estimate connected inputs and expected output from each model’s own rates.'
  ]
} satisfies ChangelogEntry;
