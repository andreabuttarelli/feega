import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-12',
  title: 'Keyboard-safe inspector',
  items: [
    'Delete, Tab and letter keys pressed on an inspector button no longer delete or reselect layers or switch tools.',
    'Tab and Shift-Tab move through the inspector controls in order.',
    'Escape closes only the open menu or picker, keeps the layer selected and returns focus to the button that opened it.'
  ]
} satisfies ChangelogEntry;
