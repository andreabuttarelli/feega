import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-27',
  title: 'Team invites now work',
  items: [
    'Opening an invite link and signing in, signing up, continuing with GitHub or resetting your password adds you to the inviting workspace.',
    'You land in that workspace’s most recent project.',
    'Invites must be accepted with the invited email address.',
    'Expired, used or mismatched invites show a clear message on the login page.'
  ]
} satisfies ChangelogEntry;
