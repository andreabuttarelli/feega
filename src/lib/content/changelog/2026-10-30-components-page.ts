import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-30',
  title: 'A Components page for every project',
  items: [
    'Creating a component moves its main to a Components page and leaves a linked instance in place.',
    'Imported sites put each component in its own small frame on the Components page instead of one huge frame.',
    'Variant sets show a dashed purple outline with a + below to add a variant.'
  ]
} satisfies ChangelogEntry;
