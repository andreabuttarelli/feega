import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-26',
  title: 'Native canvas in the Mac app',
  items: ['The macOS desktop app can now draw the canvas natively on Metal (opt-in, falls back to the browser engine).']
} satisfies ChangelogEntry;
