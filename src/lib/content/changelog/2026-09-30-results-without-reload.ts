import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-30',
  title: 'Live results on the canvas',
  items: [
    'Generated text appears in the node as soon as it is ready, no reload needed.',
    'Editing the prompt while a generation starts no longer cancels it.',
    'Changes made by the assistant or by connected agents show up live on an open canvas.'
  ]
} satisfies ChangelogEntry;
