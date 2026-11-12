import type { ChangelogEntry } from './index';

export default {
  date: '2026-11-12',
  title: 'Fills from a variable',
  items: ['A fill that comes from a colour variable now looks like any other fill, and detaches into a plain colour in one click.', 'Adding a fill to a layer bound to a variable now works: the layer keeps its colour and gets the new fill on top.']
} satisfies ChangelogEntry;
