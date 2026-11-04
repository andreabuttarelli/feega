import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-04',
  title: 'Stacks of text resize where you drag',
  items: ['Resizing a Stack of text follows the cursor instead of jumping to a different size', 'The drop line in a Stack spans the Stack you see', 'Width and height in the panel match the Stack on the canvas', 'Making a vertical Stack narrower wraps its text instead of letting it spill out']
} satisfies ChangelogEntry;
