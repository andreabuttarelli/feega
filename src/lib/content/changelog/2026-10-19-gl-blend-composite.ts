import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-19',
  title: 'Blend modes on WebGL canvases',
  items: ['Layers set to multiply and other blend modes no longer erase what is under them on devices without WebGPU.']
} satisfies ChangelogEntry;
