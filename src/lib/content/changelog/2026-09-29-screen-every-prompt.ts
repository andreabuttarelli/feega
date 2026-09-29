import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-29',
  title: 'Every prompt is checked before it reaches a model',
  items: [
    'Prompts with sexual content, graphic violence, hate, self-harm or weapons are blocked before anything is generated, on canvas nodes, loops, the chat, prompt enhancement, influencers and the API.',
    'A blocked prompt says which rule it broke, the node stops running and no credits are charged.'
  ]
} satisfies ChangelogEntry;
