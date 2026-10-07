import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-29',
  title: 'Age-restricted generations now check for real people too',
  items: [
    'Age-restricted generations are refused when the prompt is specific enough to identify a real person, like a named tattoo, an exact facial description or a handle.',
    'The refusal message says what to remove so you can try again.'
  ]
} satisfies ChangelogEntry;
