import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { POSTER_ART, POSTER_PHOTOS, colourProp, fontProp, linesProp, mediaProp, numberProp, posterComponent, prefixProp, textProp } from '../poster-kit';
import { FESTIVAL_GRID_CSS, FESTIVAL_GRID_VIEW } from './view';

export const FESTIVAL_GRID_COMPONENT = 'FestivalGridPoster';
export const FESTIVAL_GRID_VAR_PREFIX = 'festivalgrid';

export const FESTIVAL_GRID_FONTS = ['Unbounded', 'Syne', 'Lexend', 'Space Grotesk', 'Inter Tight', 'Archivo', 'Familjen Grotesk'];

export const FESTIVAL_GRID_PROPS: Record<string, PropSpec> = {
  title: linesProp('Title, top right', 'Festival\n2027'),
  info: linesProp('Small block, left of the photo', 'FREE\nENTRY\n—\n9PM'),
  photos: mediaProp('Photo'),
  edition: linesProp('Edition and venue, under the photo', 'FESTIVAL NAME\n2027 5TH EDITION\n—\nVENUE NAME\nTOWN NAME'),
  season: textProp('Small line, right of the edition', 'SUMMER 2027', { maxLength: 30 }),
  programme1: linesProp('Programme, first column: heading, then entries', 'MONTH ONE\n\nSA00 OPENING\nACT NAME\nSECOND ACT'),
  programme2: linesProp('Programme, second column', 'MONTH TWO\n\nSA00\nACT NAME\n\nSA00\nSECOND ACT\n\nSA00\nTHIRD ACT'),
  programme3: linesProp('Programme, third column', 'MONTH THREE\n\nSA00\nACT NAME\n\nSA00 CLOSING\nSECOND ACT\nTHIRD ACT DJ'),
  partners: linesProp('Partner names under the marks', 'partner\npartner\npartner\npartner'),
  dots: linesProp('Dots down the left rule: row, one per line', '0.3\n4.3\n5.9\n9.7'),
  dotLabel: textProp('Label by each dot, numbered', 'pt.', { maxLength: 6 }),
  counter: textProp('Number in the accent cell', '05', { maxLength: 4 }),
  caption: textProp('Vertical caption, right edge', 'open air — every saturday', { maxLength: 60 }),
  font: fontProp('Title font', 'Unbounded'),
  bodyFont: fontProp('Text font', 'Lexend'),
  paper: colourProp('Paper colour', '#ffffff'),
  ink: colourProp('Type colour', '#0b0b0b'),
  gridColour: colourProp('Grid colour', '#dadada'),
  accent: colourProp('Accent cell colour', '#ff5a1f'),
  rows: numberProp('Grid rows', 10, 6, 16, 1),
  titleSize: numberProp('Title size (% of the width)', 13, 5, 22, 0.1),
  [VAR_PREFIX]: prefixProp(FESTIVAL_GRID_VAR_PREFIX)
};

export const festivalGridComponent = (): CustomComponent => posterComponent({ css: FESTIVAL_GRID_CSS, js: `${POSTER_PHOTOS}\n${POSTER_ART}\n${FESTIVAL_GRID_VIEW}` }, FESTIVAL_GRID_PROPS);
