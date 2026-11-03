import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-03',
  title: 'Reliable page imports',
  items: ['Long pages like linear.app and stripe.com now import from their URL.', 'An import that fails leaves nothing behind on the canvas.', 'Tablet and phone layouts of an imported page play in the prototype player.']
} satisfies ChangelogEntry;
