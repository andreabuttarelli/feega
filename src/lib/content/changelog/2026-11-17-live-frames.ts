import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-17',
  title: 'Live frames in local Feega',
  items: [
    'Add live frame shows a page of your running dev server on the canvas, and it updates as you save files.',
    'Feega finds your dev server or starts it for you, and `feega dev-server` shows its status.',
    'Live frames keep a snapshot, so a reopened canvas still shows them without the dev server.'
  ]
} satisfies ChangelogEntry;
