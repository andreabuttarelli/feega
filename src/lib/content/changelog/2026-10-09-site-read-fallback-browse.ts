import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-09',
  title: 'Sites that block bots can be read',
  items: [
    'Launch films now start from sites protected by bot checks, using a real browser when a plain read is refused.',
    'When a site cannot be read at all, the agent says so and uses other public sources, clearly marked.',
    'Agents can browse a page step by step — click, scroll, read, take screenshots — never logging in or paying.'
  ]
} satisfies ChangelogEntry;
