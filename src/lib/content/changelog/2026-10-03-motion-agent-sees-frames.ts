import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-03',
  title: 'Motion editor: the agent sees the video',
  items: [
    'The Motion agent can look at frames of your video, and checks its own edits for clipped text, overlaps and contrast.',
    'Long titles wrap and shrink to fit the frame instead of being cut off.',
    'Text animations no longer flash or jump after they have finished entering.',
    'Overlapping clips stack in the timeline, so every clip edge can be trimmed.',
    'The preview fills its pane at the video\'s exact shape, with no black bars.',
    'Timing fields show rounded seconds and accept a comma or a dot.',
    'The Motion editor works on phones: preview on top, timeline below, properties and agent in bottom sheets.'
  ]
} satisfies ChangelogEntry;
