import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-10',
  title: 'The chat can log in to your app',
  items: [
    'Give the chat a test account of your app: it logs in, photographs the pages you name and rebuilds them in your videos.',
    'Later turns reuse the same login: "now open billing" just works.',
    'The AI sees these credentials, so use a test account. Forget it anytime from project settings or by asking.',
    'It asks before clicking anything that deletes, pays, sends or invites.'
  ]
} satisfies ChangelogEntry;
