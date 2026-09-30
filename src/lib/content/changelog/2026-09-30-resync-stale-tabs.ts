import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-30',
  title: 'Old tabs catch up when you come back',
  items: [
    'Returning to a canvas tab after sleep, a lost connection or a long break refreshes it with the latest changes.',
    'Unsent edits are kept, except on nodes deleted elsewhere — you are told when one is discarded.',
    'If the canvas or project was deleted meanwhile, you are taken somewhere valid with a note explaining why.',
    'When a new version of feega is out, a Reload button appears instead of a surprise refresh.'
  ]
} satisfies ChangelogEntry;
