import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-04',
  title: 'Pick the model and reasoning for the chat',
  items: [
    'The chat and the motion editor let you pick the AI model, grouped by provider, with its relative cost.',
    'Models that reason get a reasoning level, and the chat shows when the agent is thinking.',
    'Your choice is remembered. The default is Claude Sonnet 5.5 at medium reasoning.'
  ]
} satisfies ChangelogEntry;
