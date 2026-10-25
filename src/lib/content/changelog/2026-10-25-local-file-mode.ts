import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-25',
  title: 'Run feega locally on a .feega file',
  items: [
    'npm run local -- work.feega opens one canvas on your machine: no account, no database, no Docker.',
    'Your work saves to the .feega file as you go; import it at feega.app to continue in the cloud.',
    'Agents using the feega CLI or MCP edit the local canvas without logging in, and you see their changes live.'
  ]
} satisfies ChangelogEntry;
