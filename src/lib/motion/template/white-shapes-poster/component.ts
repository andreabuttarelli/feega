import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { colourProp, fontProp, linesProp, numberProp, posterComponent, prefixProp, textProp } from '../poster-kit';
import { WHITE_SHAPES_CSS, WHITE_SHAPES_VIEW } from './view';

export const WHITE_SHAPES_COMPONENT = 'WhiteShapesPoster';
export const WHITE_SHAPES_VAR_PREFIX = 'whiteshapes';

export const WHITE_SHAPES_FONTS = ['Inter Tight', 'Inter', 'Geist', 'Hanken Grotesk', 'Schibsted Grotesk', 'Host Grotesk', 'Archivo'];

const SHAPES = ['56 5 20 13 -0.6 0.4', '69 14 22 18 0.5 -0.3', '20 18 27 8 0.3 0.6', '31 24 15 9 -0.4 0.2', '29 36 40 5 0.4 -0.5', '14 45 72 25 -0.8 1.1', '7 62 15 10 0.6 0.9', '33 74 25 23 0.3 -0.8'].join('\n');
const INFO = [
  'Opening\n0000.00.00\n18:00 — 20:00',
  'Inaugurazione\n0000.00.00\n18:00 — 20:00',
  'Exhibition\n0000.00.00 — 00',
  'Mostra\n0000.00.00 — 00',
  'Open hours\nWeekdays 12:00 — 20:00\nWeekends 10:00 — 19:00',
  'Location\nVenue Name\nSecond floor, Building\n000 Street Name, City'
].join('\n\n');
const PLACES = ['6 25', '6 34', '52 52', '70 52', '6 76', '62 86'].join('\n');

export const WHITE_SHAPES_PROPS: Record<string, PropSpec> = {
  title: linesProp('Title, top left', 'Moving\nRooms'),
  titleAlt: linesProp('Title in the second language, top right', 'Stanze\nin moto'),
  shapes: linesProp('Shapes: left top width height tilt-top tilt-foot (%)', SHAPES),
  info: linesProp('Info blocks, one per paragraph', INFO, 900),
  places: linesProp('Info block places: left top (%), one per line', PLACES),
  marker: textProp('Number in the circle', '04', { maxLength: 4 }),
  index: textProp('Index line, foot left', 'room 04 / 12 — spaces that shift', { maxLength: 60 }),
  caption: textProp('Vertical caption, right edge', 'an exhibition in eight volumes', { maxLength: 60 }),
  font: fontProp('Font', 'Inter Tight'),
  paper: colourProp('Background colour', '#000000'),
  shape: colourProp('Shape colour', '#ffffff'),
  accent: colourProp('Text and circle colour', '#8f826f'),
  titleSize: numberProp('Title size (% of the width)', 5.2, 2, 12, 0.1),
  infoSize: numberProp('Info size (% of the width)', 1.9, 1, 4, 0.05),
  markerX: numberProp('Circle centre across (% of the width)', 88, 0, 100, 0.5),
  markerY: numberProp('Circle centre down (% of the height)', 39, 0, 100, 0.5),
  [VAR_PREFIX]: prefixProp(WHITE_SHAPES_VAR_PREFIX)
};

export const whiteShapesComponent = (): CustomComponent => posterComponent({ css: WHITE_SHAPES_CSS, js: WHITE_SHAPES_VIEW }, WHITE_SHAPES_PROPS);
