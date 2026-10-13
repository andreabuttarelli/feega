import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { colourProp, fontProp, linesProp, numberProp, posterComponent, prefixProp, textProp } from '../poster-kit';
import { SQUARE_WORDS_CSS, SQUARE_WORDS_VIEW } from './view';

export const SQUARE_WORDS_COMPONENT = 'SquareWordsPoster';
export const SQUARE_WORDS_VAR_PREFIX = 'squarewords';

export const SQUARE_WORDS_FONTS = ['Work Sans', 'Hanken Grotesk', 'Host Grotesk', 'Familjen Grotesk', 'Schibsted Grotesk', 'Inter', 'Space Grotesk'];

const WORDS = ['Studio', 'identity', 'Creative', 'form', 'concept', 'art', 'design'].join('\n');
const PLACES = ['9.3 20.7', '32.9 30.2', '6.5 40.4', '11.1 49.5', '40 71.9', '40.5 78.9', '22 88.3'].join('\n');
const BODY = 'Studio Name is a creative lab focused on building brand identity through strategy, clarity, and intentional design.';

export const SQUARE_WORDS_PROPS: Record<string, PropSpec> = {
  words: linesProp('Words, one per line', WORDS),
  places: linesProp('Word places, "left baseline" per line (% width, % height)', PLACES),
  front: numberProp('Words from this line on sit over the square', 5, 1, 20, 1),
  body: linesProp('Text in the square', BODY, 400),
  dotLabel: textProp('Number in the circle', '07', { maxLength: 4 }),
  index: textProp('Index line, foot', '(07) — Studio Name, Index 2027', { maxLength: 60 }),
  caption: textProp('Vertical caption, right edge', 'brand notes, sheet seven', { maxLength: 60 }),
  font: fontProp('Font', 'Work Sans'),
  fontWeight: numberProp('Weight', 400, 200, 800, 100, 'Style'),
  paper: colourProp('Background colour', '#c9c8c8'),
  tint: colourProp('Corner tint', '#d8c0be'),
  ink: colourProp('Type colour', '#111111'),
  square: colourProp('Square colour', '#ff360a'),
  dot: colourProp('Circle colour', '#000000'),
  wordSize: numberProp('Word size (% of the width)', 11.4, 3, 25, 0.1),
  bodySize: numberProp('Square text size (% of the width)', 2.25, 1, 5, 0.05),
  squareX: numberProp('Square left edge (% of the width)', 29.8, 0, 90, 0.5),
  squareY: numberProp('Square top (% of the height)', 28.7, 0, 90, 0.5),
  squareW: numberProp('Square width (% of the width)', 49.6, 10, 100, 0.5),
  squareH: numberProp('Square height (% of the height)', 44.5, 5, 100, 0.5),
  dotSize: numberProp('Circle diameter (% of the width)', 9.3, 2, 30, 0.1),
  dotY: numberProp('Circle centre down (% of the height)', 42.2, 0, 100, 0.5),
  [VAR_PREFIX]: prefixProp(SQUARE_WORDS_VAR_PREFIX)
};

export const squareWordsComponent = (): CustomComponent => posterComponent({ css: SQUARE_WORDS_CSS, js: SQUARE_WORDS_VIEW }, SQUARE_WORDS_PROPS);
