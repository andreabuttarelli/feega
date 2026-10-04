import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-04',
  title: 'Rich typography in motion videos',
  items: [
    'Set tracking, line height, weight, width and slant on titles, text, kickers and captions, and animate each one.',
    'Variable fonts animate smoothly across their weight and width axes; any other axis can be set too.',
    'Text is measured after its font loads and shrunk to fit its box, instead of being estimated.',
    'Roboto, Roboto Flex and about 220 more Google families are now in the font picker.'
  ]
} satisfies ChangelogEntry;
