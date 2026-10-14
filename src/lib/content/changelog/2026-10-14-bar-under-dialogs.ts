import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-14',
  title: 'Dialogs on a frame are never covered by the toolbar',
  items: ['The bottom toolbar hides while a frame’s export or template dialog is open, so its buttons are always reachable.']
} satisfies ChangelogEntry;
