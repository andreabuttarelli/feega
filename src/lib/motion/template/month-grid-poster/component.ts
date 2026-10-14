import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { colourProp, fontProp, linesProp, numberProp, posterComponent, prefixProp, textProp } from '../poster-kit';
import { MONTH_GRID_CSS, MONTH_GRID_VIEW } from './view';

export const MONTH_GRID_COMPONENT = 'MonthGridPoster';
export const MONTH_GRID_VAR_PREFIX = 'monthgrid';

export const MONTH_GRID_FONTS = ['Inter Tight', 'Archivo', 'Hanken Grotesk', 'Space Mono'];

const CARDS_POS = ['6 34 26 15', '36 34 26 15', '66 34 26 15', '6 51 26 15', '36 51 26 15', '66 51 26 15'].join('\n');
const CARDS = [
  'lecture|wed, 8.22 · 6pm|guest speaker|studio one',
  'exhibition|8.21 – 9.7|open spreads|the annex gallery',
  'lecture|wed, 9.5 · 6pm|second speaker|studio two',
  'lecture|wed, 9.12 · 6pm|third speaker|studio three',
  'screening|wed, 9.26 · 7pm|closing reel|the small theatre',
  'talk|fri, 9.26 · 6pm|open panel|the main hall'
].join('\n');

export const MONTH_GRID_PROPS: Record<string, PropSpec> = {
  label: linesProp('Label block, top left', 'sp.07\ntalks /\nshowcases /\nevents'),
  labelColor: colourProp('Label text colour', '#161108'),
  labelBgColor: colourProp('Label highlight colour', '#f4c22b'),
  labelX: numberProp('Label, left %', 5, 0, 60, 0.5),
  labelY: numberProp('Label, top %', 3, 0, 30, 0.5),
  months: linesProp('Month words, one per line, stacked', 'august\nseptember\noctober\nnovember'),
  monthsColor: colourProp('Month words colour', '#e7e2d8'),
  monthsSize: numberProp('Month words size (% of the width)', 13, 4, 20, 0.1),
  monthsWeight: numberProp('Month words weight', 700, 300, 900, 100, 'Style'),
  monthsX: numberProp('Month words, left %', 2, 0, 40, 0.5),
  monthsY: numberProp('Month words, top %', 26, 0, 60, 0.5),
  cardsPos: linesProp('Card positions: left %, top %, width %, height %', CARDS_POS),
  cards: linesProp('Cards: category | date time | name | venue', CARDS, 1200),
  cardsColor: colourProp('Card colour', '#f4c22b'),
  cardsTagColor: colourProp('Card tag colour', '#161108'),
  cardsTextColor: colourProp('Card text colour', '#161108'),
  note: textProp('Note, top right', 'entry is free, seats are limited.', { maxLength: 90 }),
  noteColor: colourProp('Note colour', '#8a8578'),
  noteX: numberProp('Note, left %', 68, 0, 90, 0.5),
  noteY: numberProp('Note, top %', 3, 0, 30, 0.5),
  marker: textProp('Word in the accent circle', 'new', { maxLength: 6 }),
  markerColor: colourProp('Circle colour', '#161108'),
  markerSize: numberProp('Circle size (% of the width)', 6, 2, 14, 0.1),
  markerX: numberProp('Circle, left %', 92, 0, 100, 0.5),
  markerY: numberProp('Circle, top %', 70, 0, 100, 0.5),
  index: textProp('Small index line, foot', 'season guide — no. 18', { maxLength: 40 }),
  indexColor: colourProp('Index colour', '#8a8578'),
  indexX: numberProp('Index, left %', 5, 0, 80, 0.5),
  indexY: numberProp('Index, top %', 97, 0, 99, 0.5),
  paper: colourProp('Background colour', '#ffffff'),
  font: fontProp('Font', 'Inter Tight'),
  [VAR_PREFIX]: prefixProp(MONTH_GRID_VAR_PREFIX)
};

export const monthGridComponent = (): CustomComponent => posterComponent({ css: MONTH_GRID_CSS, js: MONTH_GRID_VIEW }, MONTH_GRID_PROPS);
