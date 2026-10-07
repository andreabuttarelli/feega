import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-04',
  title: 'Blend modes in motion videos',
  items: [
    'Every visual layer has a blend mode: multiply, screen, overlay, soft light, difference, colour and ten more.',
    'Blended layers keep their camera moves and look the same in the preview, browser export and server render.',
    'The motion agent can set blend modes too.'
  ]
} satisfies ChangelogEntry;
