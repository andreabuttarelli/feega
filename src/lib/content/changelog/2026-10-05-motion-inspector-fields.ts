import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-05',
  title: 'A tidier motion inspector',
  items: [
    'Properties follow one order for every layer: content, style, layout, timing, then the rest.',
    'Sections fold away and stay as you left them for each kind of layer.',
    'Drag a value’s label to scrub it; hold Shift for big steps and Alt for fine ones.',
    'Keyframe a value from the diamond next to it; right-click for an expression.',
    'Timing reads seconds:frames, like the timecode.'
  ]
} satisfies ChangelogEntry;
