import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-03',
  title: 'Build components the Figma way',
  items: [
    'Draw a text or shape over a main, or drop a layer on it, and it lands inside the main',
    'Add variant places the new variant beside its main',
    'Pasting a main into another frame gives a linked instance at the same size',
    'Text on a button inside a card instance changes that card only',
    'Change to switches an instance to another variant in Play, in any frame'
  ]
} satisfies ChangelogEntry;
