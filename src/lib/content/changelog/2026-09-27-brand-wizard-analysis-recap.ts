import type { ChangelogEntry } from './index';

export default {
  date: '2026-09-27',
  title: 'A clearer new-brand wizard',
  items: [
    'While a website is being read, the wizard now shows what it is actually doing — fetching the homepage, reading logo and colours, following links, detecting products, finding social handles, drafting a target audience.',
    'The recap after analysis reads as a summary instead of a form — name and description show as plain text, with an Edit button to change them.',
    'The recap now shows every image found on the site, not just the logo.',
    'Each brand colour shows a swatch you can click to pick a new one, next to its hex code.',
    'Fixed: long product lists could get clipped instead of scrolling, hiding the Continue button.',
    'Fixed: text fields across the wizard had extra padding and misaligned borders.'
  ]
} satisfies ChangelogEntry;
