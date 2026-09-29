import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-29',
  title: 'Upgrade uses --credits now',
  items: [
    '`feega upgrade <slug> --credits N` replaces `--eur N` to pick a monthly plan; `--top-up N` is unchanged.'
  ]
} satisfies ChangelogEntry;
