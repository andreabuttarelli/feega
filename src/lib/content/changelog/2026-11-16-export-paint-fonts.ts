import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-16',
  title: 'Exported code matches the canvas',
  items: [
    'Exported code now includes your uploaded fonts, bundled in the zip',
    'Blend modes, angular and diamond gradients, stroke alignment and text shadows carry over to the code',
    'Anything CSS cannot draw is listed under Not exported'
  ]
} satisfies ChangelogEntry;
