import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-29',
  title: 'Wiro models and opt-in age-restricted features',
  items: [
    'Image and video nodes can use Wiro models, listed under Wiro in the model menu with their price.',
    'Workspace owners on a paid plan can allow age-restricted features in Settings > Content policy.',
    'Every request is safety-screened; minors and real, identifiable people are always refused.',
    'Age-restricted results are badged, hidden from share links and never published without your confirmation.'
  ]
} satisfies ChangelogEntry;
