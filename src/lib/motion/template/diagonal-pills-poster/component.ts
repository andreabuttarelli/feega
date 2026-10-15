import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { colourProp, linesProp, numberProp, posterComponent, prefixProp, smallTextProps, textPartProps } from '../poster-kit';
import { DIAGONAL_PILLS_CSS, DIAGONAL_PILLS_VIEW } from './view';

export const DIAGONAL_PILLS_COMPONENT = 'DiagonalPillsPoster';
export const DIAGONAL_PILLS_VAR_PREFIX = 'diagpills';

export const DIAGONAL_PILLS_FONTS = ['Inter Tight', 'Inter', 'Space Grotesk', 'Manrope'];

const PILLS = [
  '2|30|30|',
  '10|47|36|slides',
  '36|30|30|booklets',
  '62|28|30|leaflets',
  '6|71|40|',
  '40|50|34|',
  '62|56|34|notebooks',
  '74|38|22|',
  '6|90|24|posters',
  '30|92|22|flyers',
  '50|88|30|print',
  '76|86|18|'
].join('\n');

const INK = '#f4f2ff';
const FONT = 'Inter Tight';

export const DIAGONAL_PILLS_PROPS: Record<string, PropSpec> = {
  ...textPartProps('title', 'Title, rotated along the pills', 'digital\n  designer', { color: '#ffffff', font: FONT, size: 15, x: 9, y: 72, weight: 500, lines: true }),
  pills: linesProp('Pills: tail left %, tail top %, length % | word along it', PILLS),
  pillsColor: colourProp('Pill colour', '#a093f2'),
  pillsTailColor: colourProp('Pill tail colour', '#2a2160'),
  pillsWidth: numberProp('Pill thickness (% of the width)', 11, 4, 20, 0.5),
  pillsAngle: numberProp('Pill angle (degrees)', -45, -80, 0, 1, 'Style'),
  ...textPartProps('brand', 'Top left', 'studio\nschool', { color: INK, x: 5, y: 3.5, lines: true }),
  ...textPartProps('tagline', 'Top right', 'poster graphics\nby hand', { color: INK, x: 95, y: 3.5, lines: true }),
  ...textPartProps('credit', 'Bottom left', 'first name\nlast name', { color: INK, x: 5, y: 92, lines: true }),
  ...textPartProps('role', 'Bottom right', 'graphic\ndesigner', { color: INK, x: 95, y: 92, lines: true }),
  ...textPartProps('marker', 'Ring mark, foot centre', '01', { color: INK, x: 50, y: 91.5 }),
  ...textPartProps('index', 'Small index line, under the top', 'vol. 01 — eight formats', { color: '#8d86b8', x: 38, y: 4.2 }),
  ...smallTextProps(FONT, 2.4),
  paper: colourProp('Background colour', '#060608'),
  [VAR_PREFIX]: prefixProp(DIAGONAL_PILLS_VAR_PREFIX)
};

export const diagonalPillsComponent = (): CustomComponent => posterComponent({ css: DIAGONAL_PILLS_CSS, js: DIAGONAL_PILLS_VIEW }, DIAGONAL_PILLS_PROPS);
