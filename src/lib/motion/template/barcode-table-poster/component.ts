import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { colourProp, fontProp, linesProp, numberProp, posterComponent, prefixProp, textProp } from '../poster-kit';
import { BARCODE_TABLE_CSS, BARCODE_TABLE_VIEW } from './view';

export const BARCODE_TABLE_COMPONENT = 'BarcodeTablePoster';
export const BARCODE_TABLE_VAR_PREFIX = 'barcodetable';

export const BARCODE_TABLE_FONTS = ['Inter Tight', 'Archivo', 'Space Mono', 'Newsreader'];

const EVENT_LINES = ['Date | 04.29 – 05.18', 'Venue | Studio Building, Floor 7', 'District | Town Centre', 'Entry | Free, RSVP required'].join('\n');

export const BARCODE_TABLE_PROPS: Record<string, PropSpec> = {
  titlePrimary: linesProp('Primary title, top right', 'A Tribute\nto Type'),
  titlePrimaryColor: colourProp('Primary title colour', '#0a0a0a'),
  titlePrimarySize: numberProp('Primary title size (% of the width)', 5.6, 2, 10, 0.1),
  titlePrimaryWeight: numberProp('Primary title weight', 600, 400, 900, 100, 'Style'),
  titlePrimaryX: numberProp('Primary title, left %', 46, 0, 90, 0.5),
  titlePrimaryY: numberProp('Primary title, top %', 4, 0, 50, 0.5),
  titleSecondary: linesProp('Secondary title, under the primary', 'An Open\nLetterform Design\nShowcase'),
  titleSecondaryColor: colourProp('Secondary title colour', '#0a0a0a'),
  titleSecondaryX: numberProp('Secondary title, left %', 46, 0, 90, 0.5),
  titleSecondaryY: numberProp('Secondary title, top %', 18, 0, 80, 0.5),
  eventLines: linesProp('Event rows: label | value', EVENT_LINES),
  eventLinesColor: colourProp('Event rows colour', '#0a0a0a'),
  eventLinesX: numberProp('Event rows, left %', 46, 0, 90, 0.5),
  eventLinesY: numberProp('Event rows, top %', 58, 0, 90, 0.5),
  footer: textProp('Footer line, foot left', 'supported by the design council and the type archive', { maxLength: 90 }),
  footerColor: colourProp('Footer colour', '#8a8a8a'),
  footerX: numberProp('Footer, left %', 4, 0, 60, 0.5),
  footerY: numberProp('Footer, top %', 97, 0, 99, 0.5),
  partners: linesProp('Partner marks, foot right: one name per line', 'archive\npress\nguild'),
  partnersColor: colourProp('Partner marks colour', '#0a0a0a'),
  partnersX: numberProp('Partner marks, left %', 46, 0, 80, 0.5),
  partnersY: numberProp('Partner marks, top %', 97, 0, 99, 0.5),
  counter: textProp('Number in the accent cell', '01', { maxLength: 4 }),
  counterColor: colourProp('Accent cell colour', '#d4322a'),
  counterX: numberProp('Accent cell, left %', 4, 0, 90, 0.5),
  counterY: numberProp('Accent cell, top %', 4, 0, 90, 0.5),
  index: textProp('Small index line, left column foot', 'no. 2024 / 07', { maxLength: 30 }),
  indexColor: colourProp('Index colour', '#8a8a8a'),
  indexX: numberProp('Index, left %', 4, 0, 60, 0.5),
  indexY: numberProp('Index, top %', 92, 0, 98, 0.5),
  barcodeColor: colourProp('Barcode colour', '#0a0a0a'),
  barcodeX: numberProp('Barcode, left %', 4, 0, 60, 0.5),
  barcodeY: numberProp('Barcode, top %', 4, 0, 60, 0.5),
  barcodeW: numberProp('Barcode width %', 38, 5, 90, 0.5),
  barcodeH: numberProp('Barcode height %', 88, 5, 95, 0.5),
  paper: colourProp('Background colour', '#ffffff'),
  font: fontProp('Font', 'Inter Tight'),
  gridColor: colourProp('Grid colour', '#d6d6d6'),
  gridCols: numberProp('Grid columns', 5, 2, 10, 1),
  [VAR_PREFIX]: prefixProp(BARCODE_TABLE_VAR_PREFIX)
};

export const barcodeTableComponent = (): CustomComponent => posterComponent({ css: BARCODE_TABLE_CSS, js: BARCODE_TABLE_VIEW }, BARCODE_TABLE_PROPS);
