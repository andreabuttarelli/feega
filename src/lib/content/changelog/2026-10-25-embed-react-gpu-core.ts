import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-25',
  title: 'Embeds draw with the canvas engine',
  items: ['Published videos and the React SDK now draw with the same GPU engine as the canvas, so they look the same everywhere.', 'The React SDK draws plain videos inline, without an iframe.']
} satisfies ChangelogEntry;
