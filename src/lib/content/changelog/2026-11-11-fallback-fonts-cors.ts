import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-11',
  title: 'Symbols and CJK text render on the canvas',
  items: ['Arrows, symbols, emoji and Chinese or Korean characters in frames now draw with their fallback fonts instead of going missing.']
} satisfies ChangelogEntry;
