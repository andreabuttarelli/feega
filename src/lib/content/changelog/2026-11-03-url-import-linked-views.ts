import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-03',
  title: 'Imported tablet and phone layouts follow your edits',
  items: [
    'An imported page’s tablet and phone layouts now share its layers: edit a headline or a picture on desktop and it changes in every layout.',
    'Pages imported with breakpoints keep plain layers; import without breakpoints to get components.'
  ]
} satisfies ChangelogEntry;
