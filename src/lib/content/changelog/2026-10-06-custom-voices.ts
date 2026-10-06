import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-06',
  title: 'Voices',
  items: [
    'Text to speech works without picking a voice: it starts with a default one.',
    'Search the voice library by language, gender, accent and use, and preview before picking.',
    'Design a new voice from a description.',
    'Clone your own voice by recording it in the browser; cloning someone else needs their consent, and the recording is deleted once the voice exists.',
    'See how many custom voice slots you have left, and delete voices you no longer need.'
  ]
} satisfies ChangelogEntry;
