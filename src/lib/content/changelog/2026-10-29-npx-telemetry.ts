import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-29',
  title: 'Local mode telemetry',
  items: ['npx feega sends anonymous start stats (version, OS, Node). Turn it off with FEEGA_TELEMETRY=0 or DO_NOT_TRACK=1.']
} satisfies ChangelogEntry;
