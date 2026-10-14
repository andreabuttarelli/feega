import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { colourProp, fontProp, linesProp, numberProp, posterComponent, prefixProp, textProp } from '../poster-kit';
import { BRICK_CAPS_CSS, BRICK_CAPS_VIEW } from './view';

export const BRICK_CAPS_COMPONENT = 'BrickCapsPoster';
export const BRICK_CAPS_VAR_PREFIX = 'brickcaps';

export const BRICK_CAPS_FONTS = ['Archivo', 'Inter Tight', 'Space Grotesk'];

const BARS = ['night market', 'saturday', '02.09.27', 'live sets, open floor'].join('\n');
const CORNERS = ['TL|11:00–04:00', 'TR|by: open collective', 'BL|reserve: hi@studio.test', 'BR|skyline hall'].join('\n');

export const BRICK_CAPS_PROPS: Record<string, PropSpec> = {
  bars: linesProp('Caps lines, each on its own bar', BARS),
  barsColor: colourProp('Bar colour', '#141414'),
  barsTextColor: colourProp('Bar text colour', '#ffffff'),
  barsFont: fontProp('Bar font', 'Archivo'),
  barsSize: numberProp('Bar text size (% of the width)', 9, 3, 16, 0.1),
  barsX: numberProp('Bars, left %', 0, 0, 20, 0.5),
  barsY: numberProp('Bars, top %', 10, 0, 40, 0.5),
  corners: linesProp('Info corners: TL/TR/BL/BR | text', CORNERS),
  cornersColor: colourProp('Info corner colour', '#141414'),
  cornersFont: fontProp('Info corner font', 'Space Grotesk'),
  cornersSize: numberProp('Info corner size (% of the width)', 1.3, 0.5, 3, 0.1),
  marker: textProp('Word in the accent circle', 'live', { maxLength: 6 }),
  markerColor: colourProp('Circle colour', '#141414'),
  markerFont: fontProp('Circle font', 'Space Grotesk'),
  markerSize: numberProp('Circle size (% of the width)', 6, 2, 14, 0.1),
  markerX: numberProp('Circle, left %', 88, 0, 100, 0.5),
  markerY: numberProp('Circle, top %', 70, 0, 100, 0.5),
  index: textProp('Small index line, foot centre', 'strictly 18+', { maxLength: 40 }),
  indexColor: colourProp('Index colour', '#141414'),
  indexFont: fontProp('Index font', 'Space Grotesk'),
  indexSize: numberProp('Index size (% of the width)', 1.6, 0.6, 3, 0.1),
  indexX: numberProp('Index, left %', 4, 0, 70, 0.5),
  indexY: numberProp('Index, top %', 92, 0, 98, 0.5),
  paper: colourProp('Background colour', '#f4d35e'),
  brickLineColor: colourProp('Brick line colour', '#141414'),
  brickCols: numberProp('Brick columns', 6, 2, 16, 1),
  brickRowHeight: numberProp('Brick row height %', 6, 2, 16, 0.5),
  [VAR_PREFIX]: prefixProp(BRICK_CAPS_VAR_PREFIX)
};

export const brickCapsComponent = (): CustomComponent => posterComponent({ css: BRICK_CAPS_CSS, js: BRICK_CAPS_VIEW }, BRICK_CAPS_PROPS);
