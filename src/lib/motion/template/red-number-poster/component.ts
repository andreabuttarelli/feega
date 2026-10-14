import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { POSTER_ART, POSTER_PHOTOS, colourProp, fontProp, linesProp, mediaProp, numberProp, posterComponent, prefixProp, textProp } from '../poster-kit';
import { RED_NUMBER_CSS, RED_NUMBER_VIEW } from './view';

export const RED_NUMBER_COMPONENT = 'RedNumberPoster';
export const RED_NUMBER_VAR_PREFIX = 'rednumber';

export const RED_NUMBER_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Hanken Grotesk', 'Schibsted Grotesk', 'Archivo', 'Space Grotesk'];

const COLUMN_ONE = 'A placeholder for a short paragraph about the work: what it shows and why it matters. Keep it to two or three lines.';
const COLUMN_TWO = 'A second short paragraph, set justified like the first, so the two columns read as one block at the top right of the page.';
const WORDS = ['First words', 'and the next', 'in the middle', 'then the', 'last ones'].join('\n');

export const RED_NUMBER_PROPS: Record<string, PropSpec> = {
  title: textProp('Title, top left', 'notes on time', { maxLength: 40 }),
  columns: linesProp('Two text columns, top right, one per paragraph', `${COLUMN_ONE}\n\n${COLUMN_TWO}`, 900),
  photos: mediaProp('Photo, turned to a duotone'),
  words: linesProp('Words on the photo: corners, centre, foot corners', WORDS),
  sides: linesProp('Side words: left | right, one pair per line', 'time | is\n— | —\nonly | a phase'),
  number: textProp('Big number, foot', '047', { maxLength: 4 }),
  marker: textProp('Number in the red circle', '12', { maxLength: 4 }),
  index: textProp('Line under the title', 'vol. 02 — a short series', { maxLength: 60 }),
  font: fontProp('Font', 'Inter Tight'),
  paper: colourProp('Paper colour', '#ffffff'),
  ink: colourProp('Type colour', '#1a1a1a'),
  tint: colourProp('Photo duotone colour', '#ff1a12'),
  numberColour: colourProp('Big number colour', '#2b2b2b'),
  photoSize: numberProp('Photo size (% of the width)', 66, 30, 90, 1),
  [VAR_PREFIX]: prefixProp(RED_NUMBER_VAR_PREFIX)
};

export const redNumberComponent = (): CustomComponent => posterComponent({ css: RED_NUMBER_CSS, js: `${POSTER_PHOTOS}\n${POSTER_ART}\n${RED_NUMBER_VIEW}` }, RED_NUMBER_PROPS);
