import type { ChangelogEntry } from './index';

export default {
  date: '2026-10-30',
  title: 'Import from URL looks like the page',
  items: [
    'Imported pages now match the source from top to bottom, not just the first screen.',
    'The page’s own fonts come in with the import and are added to your fonts.',
    'Text keeps links, bold and inline code in one layer, with the right line breaks.',
    'Icons and logos arrive as editable vector shapes; gradients, shadows, borders and blurs keep their look.',
    'Videos, maps and canvases arrive as pictures; cookie banners are left out.',
    'Pages up to 65,536 px tall import as stacked frames.'
  ]
} satisfies ChangelogEntry;
