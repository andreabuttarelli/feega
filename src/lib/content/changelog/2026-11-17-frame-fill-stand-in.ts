import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-17',
  title: 'Frames show their colour while they load',
  items: ['While a large canvas loads, a frame that has not drawn yet shows the background colour of its page instead of a blank card.']
} satisfies ChangelogEntry;
