import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-27',
  title: 'Paste any social link into the feed node',
  items: [
    'The social feed node now understands any pasted URL — profile, single post or several links at once.',
    'Platform is detected automatically from the URL for Instagram, TikTok, X, Threads, YouTube, Facebook and LinkedIn.',
    'Paste a single post or video link to sync just that one item.',
    'Paste several accounts or posts (one per line or comma-separated) to sync all of them.',
    'The node shows what it understood — "Instagram · profile @nike", "TikTok · 1 post".',
    'A link the feed can\'t handle yet (hashtags, unsupported platforms) says so instead of syncing nothing.'
  ]
} satisfies ChangelogEntry;
