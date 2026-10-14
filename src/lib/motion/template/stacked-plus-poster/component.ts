import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { colourProp, fontProp, linesProp, numberProp, posterComponent, prefixProp, textProp } from '../poster-kit';
import { STACKED_PLUS_CSS, STACKED_PLUS_VIEW } from './view';

export const STACKED_PLUS_COMPONENT = 'StackedPlusPoster';
export const STACKED_PLUS_VAR_PREFIX = 'stackedplus';

export const STACKED_PLUS_FONTS = ['Archivo', 'Inter Tight', 'Hanken Grotesk', 'Geist', 'Space Grotesk'];

const ROWS = [
  'slow|say less than you think, ask more than you expect,|R',
  'growth|with quiet persistence,|L',
  'belongs||R',
  'to the|that keeps showing up, not the one who waits,|R',
  'patient||L'
].join('\n');

export const STACKED_PLUS_PROPS: Record<string, PropSpec> = {
  rows: linesProp('Title rows: word | note | side (L or R)', ROWS, 800),
  rowsColor: colourProp('Title colour', '#0b0b0b'),
  rowsSize: numberProp('Title size (% of the width)', 13, 5, 20, 0.1),
  rowsWeight: numberProp('Title weight', 800, 400, 900, 100, 'Style'),
  rowsX: numberProp('Title block, left %', 4, 0, 30, 0.5),
  rowsY: numberProp('Title block, top %', 2, 0, 20, 0.5),
  noteColor: colourProp('Note colour', '#0b0b0b'),
  plusColor: colourProp('Plus colour', '#ffd400'),
  plusX: numberProp('Plus, left %', 78, 0, 100, 0.5),
  plusY: numberProp('Plus, top %', 3, 0, 100, 0.5),
  plusSize: numberProp('Plus size (% of the width)', 9, 2, 20, 0.1),
  quarterColor: colourProp('Quarter circle colour', '#2b5ce6'),
  quarterX: numberProp('Quarter circle, left %', 72, 0, 100, 0.5),
  quarterY: numberProp('Quarter circle, top %', 54, 0, 100, 0.5),
  quarterSize: numberProp('Quarter circle size (% of the width)', 15, 4, 30, 0.1),
  rectColor: colourProp('Rectangle colour', '#ff5a1f'),
  rectX: numberProp('Rectangle, left %', 3, 0, 100, 0.5),
  rectY: numberProp('Rectangle, top %', 72, 0, 100, 0.5),
  rectW: numberProp('Rectangle width %', 16, 2, 50, 0.5),
  rectH: numberProp('Rectangle height %', 10, 2, 40, 0.5),
  marker: textProp('Word in the accent circle', 'now', { maxLength: 6 }),
  markerColor: colourProp('Circle colour', '#0b0b0b'),
  markerSize: numberProp('Circle size (% of the width)', 6, 2, 14, 0.1),
  markerX: numberProp('Circle, left %', 60, 0, 100, 0.5),
  markerY: numberProp('Circle, top %', 90, 0, 100, 0.5),
  index: textProp('Small index line, foot', 'no. 04 — a short series', { maxLength: 60 }),
  indexColor: colourProp('Index colour', '#0b0b0b'),
  indexX: numberProp('Index, left %', 4, 0, 80, 0.5),
  indexY: numberProp('Index, top %', 94, 0, 100, 0.5),
  caption: textProp('Imprint line, foot right', 'studio notes', { maxLength: 40 }),
  captionColor: colourProp('Imprint colour', '#0b0b0b'),
  captionX: numberProp('Imprint, left %', 80, 0, 100, 0.5),
  captionY: numberProp('Imprint, top %', 94, 0, 100, 0.5),
  paper: colourProp('Background colour', '#eef0e8'),
  font: fontProp('Font', 'Archivo'),
  [VAR_PREFIX]: prefixProp(STACKED_PLUS_VAR_PREFIX)
};

export const stackedPlusComponent = (): CustomComponent => posterComponent({ css: STACKED_PLUS_CSS, js: STACKED_PLUS_VIEW }, STACKED_PLUS_PROPS);
