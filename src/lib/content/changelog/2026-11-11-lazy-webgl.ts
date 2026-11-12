import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'A lighter canvas engine on WebGPU browsers',
  items: ['Browsers with WebGPU download a smaller canvas engine; the WebGL renderer loads only where it is needed.']
} satisfies ChangelogEntry;
