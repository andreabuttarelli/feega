import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { colourProp, linesProp, numberProp, posterComponent, prefixProp, smallTextProps, textPartProps } from '../poster-kit';
import { BLUE_TRAILS_CSS, BLUE_TRAILS_VIEW } from './view';

export const BLUE_TRAILS_COMPONENT = 'BlueTrailsPoster';
export const BLUE_TRAILS_VAR_PREFIX = 'bluetrails';

export const BLUE_TRAILS_FONTS = ['Inter Tight', 'Inter', 'Hanken Grotesk', 'Space Grotesk'];

const COLUMNS = [24.4, 44.4, 64.5, 84.7];
const LEFT_COLUMNS = [15, 35, 55, 75];
const row = (xs: number[], y: number, trail: number) => xs.map((x) => `${x}|${y}|${trail}`);

const DOTS = [
  ...row(COLUMNS, 18.9, -16),
  ...row([15, 55], 27.8, 30),
  ...row([24.4, 44.4, 84.7], 36.7, -16),
  '15|45.6|44',
  '84.7|54.4|-52',
  ...row(LEFT_COLUMNS, 63.3, 14),
  ...row([40, 80], 72.2, -24),
  ...row(LEFT_COLUMNS, 81.1, 14)
].join('\n');

const WORDS = ['banners|19|26.3', 'posters|60|35.2', 'websites|19|61.8', 'graphics|67|70.7'].join('\n');

const INK = '#ffffff';
const FONT = 'Inter Tight';

export const BLUE_TRAILS_PROPS: Record<string, PropSpec> = {
  ...textPartProps('title', 'Title, each line shifted right', 'digital\ndesigner', { color: INK, font: FONT, size: 13, x: 10, y: 40, weight: 500, lines: true }),
  titleShift: numberProp('Title: shift per line (% of the width)', 21, 0, 40, 0.5),
  dots: linesProp('Dots: centre left %, top %, trail % (negative = to the left)', DOTS, 1200),
  dotsColor: colourProp('Dot colour', '#2f1cff'),
  dotsTailColor: colourProp('Trail colour', '#120a6e'),
  words: linesProp('Words over the dots: text | left %, top %', WORDS),
  ...textPartProps('tagline', 'Top left', 'keep your\ninner spark\nalight', { color: INK, x: 8, y: 5.6, lines: true }),
  ...textPartProps('topic', 'Top right', 'poster\ngraphics', { color: INK, x: 74, y: 5.6, lines: true }),
  ...textPartProps('brand', 'Bottom left', 'studio\nschool', { color: INK, x: 8, y: 89.6, lines: true }),
  ...textPartProps('tool', 'Bottom right', 'class of\n2027', { color: INK, x: 80, y: 89.6, lines: true }),
  ...textPartProps('marker', 'Ring mark, foot centre', '02', { color: INK, x: 50, y: 90.6 }),
  ...textPartProps('index', 'Vertical index, right edge', 'series 02 — blue hour', { color: '#5a55a8', x: 97, y: 38 }),
  ...smallTextProps(FONT, 3.3),
  paper: colourProp('Background colour', '#050506'),
  [VAR_PREFIX]: prefixProp(BLUE_TRAILS_VAR_PREFIX)
};

export const blueTrailsComponent = (): CustomComponent => posterComponent({ css: BLUE_TRAILS_CSS, js: BLUE_TRAILS_VIEW }, BLUE_TRAILS_PROPS);
