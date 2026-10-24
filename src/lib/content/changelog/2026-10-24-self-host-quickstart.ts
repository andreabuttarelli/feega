import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-24',
  title: 'Run feega on your own machine',
  items: [
    'One command, docker compose up, now starts feega with a demo login and a sample canvas.',
    'The canvas, animation and image export work without any API keys; AI features tell you which key to add.',
    'Self-hosted instances have no credit limits.'
  ]
} satisfies ChangelogEntry;
