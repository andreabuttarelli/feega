import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-10',
  title: 'The Mac app is feega, signed in',
  items: [
    'The Mac app opens your feega account: sign in with email, Google or GitHub, and stay signed in.',
    'The Mac app draws the canvas natively on Metal, with smoother panning.',
    'Local .feega files still open from File → Open Local File… or a double-click.'
  ]
} satisfies ChangelogEntry;
