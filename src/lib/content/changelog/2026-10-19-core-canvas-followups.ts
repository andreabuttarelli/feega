import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-19',
  title: 'Canvas renderer fixes',
  items: ['Frames and cards no longer show the dot grid on top of them.', 'Frames with nothing to draw keep their preview instead of turning black.', 'Devices with WebGPU but no usable graphics adapter now use the new renderer through WebGL2.']
} satisfies ChangelogEntry;
