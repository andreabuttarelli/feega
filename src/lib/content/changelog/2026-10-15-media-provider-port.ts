import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-15',
  title: 'Model prices you can trust',
  items: [
    'Recommended image models no longer show a per-image price that the model does not actually charge.',
    'Models from a provider that is not available are hidden instead of failing when you run them.'
  ]
} satisfies ChangelogEntry;
