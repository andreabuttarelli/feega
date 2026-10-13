import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { POSTER_PHOTOS, colourProp, fontProp, linesProp, mediaProp, numberProp, posterComponent, prefixProp, textProp } from '../poster-kit';
import { VERTICAL_TYPE_CSS, VERTICAL_TYPE_VIEW } from './view';

export const VERTICAL_TYPE_COMPONENT = 'VerticalTypePoster';
export const VERTICAL_TYPE_VAR_PREFIX = 'verticaltype';

export const VERTICAL_TYPE_FONTS = ['Pixelify Sans', 'Silkscreen', 'Tiny5', 'Doto', 'Space Grotesk', 'Inter Tight', 'Space Mono'];

const LIST = ['SOFT CHEESE | SPARKLING', 'HARD CHEESE | DRY WHITE', 'BLUE CHEESE | SWEET WHITE', 'FRESH CURD | LIGHT RED', 'AGED RIND | FULL RED', 'SMOKED | FORTIFIED'].join('\n');

export const VERTICAL_TYPE_PROPS: Record<string, PropSpec> = {
  words: linesProp('Vertical words, one per line', 'Bread\nand\nOil'),
  wordPlaces: linesProp('Word places: column, row where it starts', '1 4.2\n4 5\n1 7.45'),
  photos: mediaProp('Photos'),
  photoCells: linesProp('Photo cells: column row width height', '2 0 2 5\n0 6 1 2'),
  blackCells: linesProp('Black cells: column row [width height]', '4 0 2 2\n5 4\n0 5'),
  list: linesProp('List, foot right: left | right per line', LIST),
  counter: textProp('Tab in the black cell', 'No. 07', { maxLength: 10 }),
  accentCells: linesProp('Accent cells: column row [width height]', '3 5'),
  caption: textProp('Small line under the grid head', 'a tasting in six courses', { maxLength: 60 }),
  font: fontProp('Word font', 'Pixelify Sans'),
  paper: colourProp('Paper colour', '#f5f5f3'),
  ink: colourProp('Ink colour', '#000000'),
  accent: colourProp('Accent cell colour', '#e8261c'),
  columns: numberProp('Grid columns', 6, 3, 12, 1),
  wordSize: numberProp('Word size (x a cell)', 1.15, 0.4, 2.5, 0.05),
  grain: numberProp('Photo grain', 0.55, 0, 1, 0.05, 'Style'),
  [VAR_PREFIX]: prefixProp(VERTICAL_TYPE_VAR_PREFIX)
};

export const verticalTypeComponent = (): CustomComponent => posterComponent({ css: VERTICAL_TYPE_CSS, js: `${POSTER_PHOTOS}\n${VERTICAL_TYPE_VIEW}` }, VERTICAL_TYPE_PROPS);
