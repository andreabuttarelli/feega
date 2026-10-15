import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-15',
  title: 'A selected poster part shows only its own properties',
  items: [
    'Selecting a text inside a poster lists only what belongs to it, never the page background or other texts.',
    'Its fill recolours that text alone, even when other texts share the same colour.',
    'Settings shared with other parts sit under "Shared with N parts".',
    'Agents can colour a single part too.'
  ]
} satisfies ChangelogEntry;
