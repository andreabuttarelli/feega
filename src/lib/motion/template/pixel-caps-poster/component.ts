import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { POSTER_ART, POSTER_PHOTOS, colourProp, fontProp, linesProp, mediaProp, numberProp, posterComponent, prefixProp, textProp } from '../poster-kit';
import { PIXEL_CAPS_CSS, PIXEL_CAPS_VIEW } from './view';

export const PIXEL_CAPS_COMPONENT = 'PixelCapsPoster';
export const PIXEL_CAPS_VAR_PREFIX = 'pixelcaps';

export const PIXEL_CAPS_FONTS = ['Archivo', 'Inter Tight', 'Space Grotesk', 'Hanken Grotesk'];

const COLUMN_ONE = 'A short note on the work on show: where it started and what it is reaching for, set in two justified columns.';
const COLUMN_TWO = 'The second column continues the same note, so the pair reads as one block of text beside the title.';
const SLOTS = ['58 44 18 20', '58 68 18 18'].join('\n');
const BLOCKS = ['4 40 50 8', '4 60 30 6'].join('\n');

export const PIXEL_CAPS_PROPS: Record<string, PropSpec> = {
  title: linesProp('Title, 3 lines, top left', 'open\nstudio\ndays'),
  titleColor: colourProp('Title colour', '#161108'),
  titleSize: numberProp('Title size (% of the width)', 11.5, 4, 18, 0.1),
  titleWeight: numberProp('Title weight', 800, 400, 900, 100, 'Style'),
  titleX: numberProp('Title, left %', 4, 0, 40, 0.5),
  titleY: numberProp('Title, top %', 3, 0, 30, 0.5),
  columns: linesProp('Two justified text columns', `${COLUMN_ONE}\n\n${COLUMN_TWO}`, 700),
  columnsColor: colourProp('Columns colour', '#161108'),
  columnsX: numberProp('Columns, left %', 4, 0, 60, 0.5),
  columnsY: numberProp('Columns, top %', 86, 0, 97, 0.5),
  photos: mediaProp('Photos in the two slots'),
  slots: linesProp('Photo slots: left %, top %, width %, height %', SLOTS),
  index: textProp('Number prefix over each photo', 'fig.', { maxLength: 6 }),
  indexColor: colourProp('Photo number colour', '#161108'),
  blackBlocks: linesProp('Black blocks: left %, top %, width %, height %', BLOCKS),
  blackBlocksColor: colourProp('Black block colour', '#161108'),
  blockNumber: textProp('Number on the first black block', '03', { maxLength: 4 }),
  blockNumberColor: colourProp('Block number colour', '#f3ead9'),
  blockNumberX: numberProp('Block number, left %', 6, 0, 80, 0.5),
  blockNumberY: numberProp('Block number, top %', 42, 0, 95, 0.5),
  blockLabel: textProp('Label on the second black block', 'archive series', { maxLength: 30 }),
  blockLabelColor: colourProp('Block label colour', '#f3ead9'),
  blockLabelX: numberProp('Block label, left %', 6, 0, 80, 0.5),
  blockLabelY: numberProp('Block label, top %', 62, 0, 97, 0.5),
  pixelsColor: colourProp('Pixel scatter colour', '#e8732a'),
  pixelsX: numberProp('Pixel area, left %', 0, 0, 80, 0.5),
  pixelsY: numberProp('Pixel area, top %', 0, 0, 80, 0.5),
  pixelsW: numberProp('Pixel area width %', 100, 10, 100, 0.5),
  pixelsH: numberProp('Pixel area height %', 100, 10, 100, 0.5),
  pixelCount: numberProp('Pixel count', 140, 20, 400, 1),
  paper: colourProp('Background colour', '#f3ead9'),
  font: fontProp('Font', 'Archivo'),
  [VAR_PREFIX]: prefixProp(PIXEL_CAPS_VAR_PREFIX)
};

export const pixelCapsComponent = (): CustomComponent => posterComponent({ css: PIXEL_CAPS_CSS, js: `${POSTER_PHOTOS}\n${POSTER_ART}\n${PIXEL_CAPS_VIEW}` }, PIXEL_CAPS_PROPS);
