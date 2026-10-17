import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-16',
  title: 'Connections stay on their ports',
  items: ['Connections now end exactly on the port, without a gap.', 'Switching a model keeps existing connections attached to their ports as they move.']
} satisfies ChangelogEntry;
