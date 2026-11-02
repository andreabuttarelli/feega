import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Stack panel, rebuilt',
  items: [
    'The Stack panel is compact chips: size with its mode, alignment beside the gap, and padding as horizontal and vertical.',
    'Padding opens to four labelled sides and folds back to two.',
    'Min and max width and height take px or %, from the size menu.',
    'Rarely used Stack settings, like canvas stacking, sit behind the settings button.'
  ]
} satisfies ChangelogEntry;
