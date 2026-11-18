import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-18',
  title: 'Local setup asks for an account only if you want one',
  items: [
    'Running feega on your computer, connecting a Feega account is now an optional first step you can skip.',
    'Feega Cloud is offered only once your account is connected, and opens in your browser.',
    'The local chat says plainly it runs your own assistant, like Claude Code or Codex, with no feega credits.'
  ]
} satisfies ChangelogEntry;
