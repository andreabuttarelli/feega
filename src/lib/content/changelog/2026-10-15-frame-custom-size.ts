import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-15',
  title: 'Custom frame size',
  items: ['Frames have a Custom format: resize the frame on the canvas and the composition takes its exact shape, with no black bands.', 'Width and height are shown in Properties and can be typed in.', 'The chat agent can set a custom width and height too.']
} satisfies ChangelogEntry;
