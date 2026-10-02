import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-02',
  title: 'Age check for uncensored mode',
  items: [
    'Uncensored mode now verifies you are 18+ with a quick selfie; an ID is asked only if needed.',
    'We keep only the yes/no result, and the check is deleted at the provider once decided.'
  ]
} satisfies ChangelogEntry;
