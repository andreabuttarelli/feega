import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { colourProp, linesProp, posterComponent, prefixProp, smallTextProps, textPartProps } from '../poster-kit';
import { ACID_STROKES_CSS, ACID_STROKES_VIEW } from './view';

export const ACID_STROKES_COMPONENT = 'AcidStrokesPoster';
export const ACID_STROKES_VAR_PREFIX = 'acidstrokes';

export const ACID_STROKES_FONTS = ['Inter Tight', 'Pinyon Script', 'Italianno', 'Corinthia', 'Archivo', 'Familjen Grotesk'];

const STROKES = [
  '-4|4|42|62|7.7',
  '2|-2|30|80|5.3',
  '20|-1|26|110|4.8',
  '44|-3|22|60|3.8',
  '70|1|34|128|6.2',
  '96|6|40|100|7.2',
  '-3|58|46|-58|8.2',
  '-2|100|38|-80|6.7',
  '30|103|30|-112|5.3',
  '62|101|34|-64|6.2',
  '104|70|44|-120|8.2',
  '100|40|28|160|4.8'
].join('\n');

const BURSTS = ['30|60|17|0', '68|66|24|9', '84|55|8|7'].join('\n');

const INK = '#0b0b0b';

export const ACID_STROKES_PROPS: Record<string, PropSpec> = {
  ...textPartProps('title', 'Title, two lines with a gap', 'Fusion\n\nInnovation', { color: INK, font: 'Inter Tight', size: 12.5, x: 17, y: 20, weight: 500, lines: true }),
  ...textPartProps('script', 'Script word in the gap', 'and', { color: INK, font: 'Pinyon Script', x: 39, y: 27.6 }),
  strokes: linesProp('Strokes: left %, top %, length %, angle, width %', STROKES),
  strokesColor: colourProp('Stroke colour', INK),
  bursts: linesProp('Bursts: left %, top %, radius %, points (0 = oval)', BURSTS),
  burstsColor: colourProp('Burst colour', INK),
  ...textPartProps('dates', 'Dates, vertical left', 'AUG. 8 — 2027 — OCT. 18', { color: INK, x: 11.5, y: 3, lines: false }),
  ...textPartProps('heading', 'Heading, top', '2027 exhibition of\ncontemporary art\nAug. 8, 9:00–12:00', { color: INK, x: 39, y: 5, lines: true }),
  ...textPartProps('venue', 'Venue, foot left', 'Harbour\nContemporary\nArt Space', { color: INK, x: 17, y: 80, lines: true }),
  ...textPartProps('marker', 'Square mark, right', '№ 07', { color: INK, x: 84, y: 34 }),
  ...textPartProps('index', 'Vertical index, right edge', 'curated works — open daily', { color: INK, x: 97.6, y: 74 }),
  ...smallTextProps('Inter Tight', 2.2),
  paper: colourProp('Background colour', '#b8ff2e'),
  [VAR_PREFIX]: prefixProp(ACID_STROKES_VAR_PREFIX)
};

export const acidStrokesComponent = (): CustomComponent => posterComponent({ css: ACID_STROKES_CSS, js: ACID_STROKES_VIEW }, ACID_STROKES_PROPS);
