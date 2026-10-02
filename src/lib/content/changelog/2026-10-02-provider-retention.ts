import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-02',
  title: 'Less of your content left at AI providers',
  items: [
    'Wiro and ElevenLabs copies of your inputs and results are deleted once your result is saved.',
    'Text and Gemini image requests go only to providers that do not collect or train on your data.',
    'Links to your files sent to AI providers now expire after five minutes.'
  ]
} satisfies ChangelogEntry;
