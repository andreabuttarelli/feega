import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-26',
  title: 'Photo studio for agents',
  items: ['Agents and the CLI can price a Photo studio batch, then start it, with `feega studio`.', 'A batch only starts from a fresh price quote, so credits are never spent on a stale price.']
} satisfies ChangelogEntry;
