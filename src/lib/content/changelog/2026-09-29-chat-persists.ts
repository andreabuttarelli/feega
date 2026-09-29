import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-29',
  title: 'Chat history survives a reload',
  items: [
    'Chat replies are saved on projects with a brand, and stay after a reload.',
    'Tool steps the agent took stay visible in the conversation after a reload.'
  ]
} satisfies ChangelogEntry;
