import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-12',
  title: 'A component library for motion videos',
  items: [
    'Add → Browse components opens every ready-made component with a moving preview, search and filters.',
    'Each component shows its editable fields before you insert it at the playhead.',
    'The home now has a row of components: pick 16:9, 9:16 or 1:1 and start a new video from one.',
    'Agents and the CLI can start a video from a component too: `feega motion new --template <id>`.'
  ]
} satisfies ChangelogEntry;
