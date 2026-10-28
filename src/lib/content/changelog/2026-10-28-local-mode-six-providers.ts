import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-28',
  title: 'Local mode generates with six providers',
  items: [
    'Local mode now generates with your own Kie.ai, OpenRouter, Higgsfield, Wiro, ElevenLabs or text LLM keys.',
    'Voices and sound effects work in local mode with an ElevenLabs key.',
    'npx feega reads a .env file in the folder you run it from.',
    'At start, local mode tells you whether each key works, without spending anything.'
  ]
} satisfies ChangelogEntry;
