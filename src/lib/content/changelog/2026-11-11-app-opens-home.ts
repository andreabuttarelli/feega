import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'The app opens on your home again',
  items: [
    'Opening the app goes to your home, or to sign-in when signed out.',
    'A prompt typed on feega.app waits through sign-in and fills your composer; nothing is sent until you press send.'
  ]
} satisfies ChangelogEntry;
