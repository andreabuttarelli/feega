import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-18',
  title: 'Local agent chat remembers, shows its steps and can be stopped',
  items: [
    'Chatting with Claude Code, Codex or another agent on your computer keeps one session per chat: later messages answer at once and remember earlier ones.',
    'The chat shows when the agent is starting, its thinking, each tool it runs and its plan.',
    'Stop a running reply from the send button; what the agent already wrote stays.',
    'Pick the reasoning effort next to the model, as in the cloud chat.'
  ]
} satisfies ChangelogEntry;
