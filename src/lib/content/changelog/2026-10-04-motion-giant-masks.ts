import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-04',
  title: 'Bigger masks and trimmed code scenes in motion',
  items: [
    'Masks can now grow up to 60 times the frame, so a word can open into a full-screen window onto the next scene.',
    'Trimming the start of a code scene now starts its animation from that point instead of from the beginning.'
  ]
} satisfies ChangelogEntry;
