import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-27',
  title: 'A cleaner menu in the canvas',
  items: [
    'The burger menu now shows who you are — name, email and organization — right at the top.',
    'Billing shows your credit balance without opening a separate page.',
    'A changelog link now lives in the menu.',
    'Rows, spacing and icons are consistent with the rest of the app.'
  ]
} satisfies ChangelogEntry;
