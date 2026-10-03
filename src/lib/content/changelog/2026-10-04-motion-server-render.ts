import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-04',
  title: 'Fast server export for motion videos',
  items: [
    'Motion videos now render on our servers by default: a 30-second 1080p video is ready in under a minute, with music and voice-over mixed in.',
    'You can close the tab while it renders: the video lands in your assets and you get a notification.',
    'The export shows the credit cost first and charges only when the video is ready. Rendering in the browser stays available for free.'
  ]
} satisfies ChangelogEntry;
