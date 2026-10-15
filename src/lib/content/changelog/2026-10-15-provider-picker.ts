import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-15',
  title: 'Choose who runs your model',
  items: [
    'When a model is available from several providers, the model menu lists each one with its price and reliability; Auto picks the cheapest reliable one.',
    'If Auto has to switch provider, the node says so. A provider you pick yourself is never swapped silently.',
    'New on kie.ai: Grok Imagine video and GPT 6 Luna text.'
  ]
} satisfies ChangelogEntry;
