import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-29',
  title: 'Plans from $8 a month',
  items: [
    'Six monthly plans — $8, $16, $32, $64, $128, $256 — with 1 credit per dollar and every feature included.',
    'Top-ups at the same price never expire.',
    'After paying, the billing page confirms the payment and updates your balance on its own.',
    '`feega upgrade <slug> --usd 16` opens checkout for a plan; `--top-up 8` for a top-up.'
  ]
} satisfies ChangelogEntry;
