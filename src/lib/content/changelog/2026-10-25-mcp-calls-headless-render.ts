import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-25',
  title: 'Agents can export videos on their own',
  items: [
    'Render links have a headless version that starts by itself, so agents export videos for free without a click.',
    'Agent batches take one target for every step and report clearly what ran and what did not.',
    'Code components explain their editable props and come with a full example.'
  ]
} satisfies ChangelogEntry;
