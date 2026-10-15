import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-15',
  title: 'Generation settings that fit the model',
  items: [
    'Switching model keeps the aspect ratio only when the new model supports it.',
    'Models that cannot run from a canvas node are no longer offered.'
  ]
} satisfies ChangelogEntry;
