import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-02',
  title: 'Cleaner properties panel',
  items: [
    'Design mode no longer shows timing, 3D, transform or parenting: they appear in Motion mode.',
    'Morph controls appear only in Motion mode, on shapes that have something to morph into.',
    'Blur lives in Effects only, and stack children show their size once.',
    'Absolute position in a stack is now a labelled "Ignore auto layout" toggle; clip content is the same checkbox everywhere.',
    'Ellipse arcs read start in degrees, sweep and ratio in percent.'
  ]
} satisfies ChangelogEntry;
