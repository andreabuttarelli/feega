import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-06',
  title: 'Voices',
  items: [
    'Text to speech works without picking a voice: it starts with a default one.',
    'The voice list shows only the standard voices, never voices made by other workspaces.'
  ]
} satisfies ChangelogEntry;
