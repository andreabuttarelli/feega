import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Inspector number fields behave',
  items: [
    'Decimal points show in every inspector number (24.0, not 240).',
    'Enter leaves the field, so Cmd+Z undoes your edit instead of the typed text.',
    'Esc in a field reverts it and no longer changes the selection.'
  ]
} satisfies ChangelogEntry;
