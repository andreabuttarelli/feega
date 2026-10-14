import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'A clearer Properties panel',
  items: [
    'Properties shows the same sections in the same order for every layer: Layout, Layer, Fill, Stroke, Effects, Text, Animation.',
    'Every value has an English label and its unit; drag a label to scrub the value.',
    'Colours get a swatch, a hex field and a picker with brand and recent colours.',
    'Text alignment is three icon toggles.',
    'Selecting several layers shows their shared values, and Mixed where they differ.',
    'The Properties panel now runs the full height of the editor and scrolls on its own.'
  ]
} satisfies ChangelogEntry;
