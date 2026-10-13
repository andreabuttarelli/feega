import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { POSTER_PHOTOS, colourProp, fontProp, linesProp, mediaProp, numberProp, posterComponent, prefixProp, textProp } from '../poster-kit';
import { PHOTO_GRID_CSS, PHOTO_GRID_VIEW } from './view';

export const PHOTO_GRID_COMPONENT = 'PhotoGridPoster';
export const PHOTO_GRID_VAR_PREFIX = 'photogrid';

export const PHOTO_GRID_FONTS = ['Archivo', 'Inter Tight', 'Inter', 'Geist', 'Space Grotesk', 'Schibsted Grotesk', 'Familjen Grotesk'];

const TITLE = ['SHAPING', 'QUIET FORMS', 'FROM THE', 'PLAIN LOGIC', 'OF SIMPLE', 'VOLUMES'].join('\n');
const TILES = [
  '3 2', '13 2 f', '6 3 f', '7 3', '11 3 f', '3 4 f', '4 4', '8 4 2 2', '12 4 f', '4 5', '2 6 f', '5 6', '12 6 2 2 f', '3 7', '9 7 f',
  '6 8', '10 8', '3 9', '6 9 2 3', '13 9', '12 10', '3 11', '9 11', '11 11', '5 12', '10 12 2 2', '13 12', '8 13', '2 14', '3 14',
  '6 14', '12 14', '4 15', '6 15', '3 16', '7 16 2 2', '10 16', '4 17', '12 17', '9 18'
].join('\n');
const NOTES = [
  'AFTER THE RAIN,\nTHE CONCRETE\nHOLDS THE LIGHT.\nEDGES SOFTEN,\nWINDOWS STARE\nBACK AT THE SKY.',
  'A PLACEHOLDER\nFOR A SHORT TEXT\nABOUT THE WORK:\nWHAT IT SHOWS,\nAND WHY IT\nMATTERS.',
  'REPLACE THESE\nLINES WITH YOUR\nOWN, SET SMALL\nAND ALIGNED\nTO THE GRID.'
].join('\n\n');

export const PHOTO_GRID_PROPS: Record<string, PropSpec> = {
  title: linesProp('Title, one line per row', TITLE),
  photos: mediaProp('Photos, cut into the tiles'),
  tiles: linesProp('Tiles: column row [width height] [f = over title]', TILES, 1200),
  notes: linesProp('Small text blocks, one per paragraph', NOTES, 900),
  notePlaces: linesProp('Text block places: column row, one per line', '15 5\n0 13\n15 16'),
  coords: linesProp('Vertical marks down the right edge', 'CITY NAME\n00.0000° N\n00.0000° W'),
  counter: textProp('Number in the accent cell', '012', { maxLength: 6 }),
  index: textProp('Index line, foot', 'plate 03 — a study of simple volumes', { maxLength: 60 }),
  accentCells: linesProp('Accent cells: column row [width height]', '13 8 2 2\n2 18'),
  font: fontProp('Font', 'Archivo'),
  fontWeight: numberProp('Title weight', 700, 300, 900, 100, 'Style'),
  tracking: numberProp('Title letter spacing (em)', 0.1, -0.05, 0.3, 0.01, 'Style'),
  paper: colourProp('Paper colour', '#f3f3f1'),
  ink: colourProp('Type colour', '#0b0b0b'),
  gridColour: colourProp('Grid colour', '#dcdcd8'),
  accent: colourProp('Accent cell colour', '#2b3cff'),
  columns: numberProp('Grid columns', 16, 6, 30, 1),
  grain: numberProp('Photo grain', 0.35, 0, 1, 0.05, 'Style'),
  [VAR_PREFIX]: prefixProp(PHOTO_GRID_VAR_PREFIX)
};

export const photoGridComponent = (): CustomComponent => posterComponent({ css: PHOTO_GRID_CSS, js: `${POSTER_PHOTOS}\n${PHOTO_GRID_VIEW}` }, PHOTO_GRID_PROPS);
