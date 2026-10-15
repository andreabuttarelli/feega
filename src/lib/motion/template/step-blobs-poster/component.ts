import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { colourProp, linesProp, numberProp, posterComponent, prefixProp, smallTextProps, textPartProps, textProp } from '../poster-kit';
import { STEP_BLOBS_CSS, STEP_BLOBS_VIEW } from './view';

export const STEP_BLOBS_COMPONENT = 'StepBlobsPoster';
export const STEP_BLOBS_VAR_PREFIX = 'stepblobs';

export const STEP_BLOBS_FONTS = ['Manrope', 'Inter Tight', 'Familjen Grotesk', 'Space Grotesk'];

const BLOBS = ['51|1.4|47|23|2', '51|26.2|47|23.4|0', '2|50.6|47|23|3', '2|75.6|47|23|3'].join('\n');

const SPECS = ['2027|39|1.6', 'MARGIN  4—12|33.5|50.8', '( Fluid )|51|71.6', 'GUTTER  25×25|33.5|75.8', '( Golden )|51|95.8'].join('\n');

const CONTENTS = ['Columns', 'Canon grid', 'Square', 'Flexible'].map((w, i) => `0${i + 1}   ${w}`).join('\n');

const NOTES = ['COLUMNS', '', 'the most common grid', 'on a screen', '', 'a relative grid,', 'set in percentages', '', 'FLEXIBLE', 'SQUARE', '(modular)', '', 'rows and columns of one size', 'make a field of cells'].join('\n');

const INK = '#0b0b0b';
const FONT = 'Manrope';

export const STEP_BLOBS_PROPS: Record<string, PropSpec> = {
  ...textPartProps('title', 'Title, inverts over the shapes', 'Grid\n     lines\n          in design', { color: '#f4f4f4', font: FONT, size: 14.6, x: 1.5, y: 0.4, weight: 300, lines: true }),
  ...textPartProps('number', 'Huge number', '04', { color: INK, size: 37, x: 0.5, y: 25.6 }),
  blobs: linesProp('Shapes: left, top, width, height %, steps (0 = box)', BLOBS),
  blobsColor: colourProp('Shape colour', '#050505'),
  blobsRound: numberProp('Shape corner rounding (% of the width)', 4.2, 0, 12, 0.1),
  grid: textProp('Grid: columns rows', '8 12', { maxLength: 9 }),
  gridColor: colourProp('Grid line colour', '#a3a3a3'),
  specs: linesProp('Spec lines: text | left %, top %', SPECS),
  specsColor: colourProp('Spec line colour', INK),
  ...textPartProps('contents', 'Contents list, left', CONTENTS, { color: INK, x: 2, y: 19, lines: true }),
  ...textPartProps('notes', 'Notes, right column', NOTES, { color: INK, x: 98, y: 51.4, lines: true }),
  ...textPartProps('index', 'Small index, top right', 'four grids\nfor one page', { color: INK, x: 98, y: 1.6, lines: true }),
  ...textPartProps('marker', 'Mark inside the rounded box', 'fig. 4 / 12', { color: '#f0f0f0', x: 55, y: 45 }),
  ...smallTextProps(FONT, 1.55),
  paper: colourProp('Background colour', '#d9d9d9'),
  [VAR_PREFIX]: prefixProp(STEP_BLOBS_VAR_PREFIX)
};

export const stepBlobsComponent = (): CustomComponent => posterComponent({ css: STEP_BLOBS_CSS, js: STEP_BLOBS_VIEW }, STEP_BLOBS_PROPS);
