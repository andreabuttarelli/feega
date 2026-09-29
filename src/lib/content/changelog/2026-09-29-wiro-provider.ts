import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-29',
  title: 'Wiro models and opt-in uncensored generation',
  items: [
    'Image and video nodes can use Wiro models, listed under Wiro in the model menu with their price.',
    'Workspace owners on a paid plan can allow uncensored models in Settings > Content policy.',
    'Every request is safety-screened; minors and real, identifiable people are always refused.',
    'Uncensored results are badged, hidden from share links and never published without your confirmation.'
  ]
} satisfies ChangelogEntry;
