import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { colourProp, fontProp, linesProp, numberProp, posterComponent, prefixProp, textProp } from '../poster-kit';
import { ROTATED_CARDS_CSS, ROTATED_CARDS_VIEW } from './view';

export const ROTATED_CARDS_COMPONENT = 'RotatedCardsPoster';
export const ROTATED_CARDS_VAR_PREFIX = 'rotatedcards';

export const ROTATED_CARDS_FONTS = ['Fraunces', 'Playfair Display', 'Inter Tight', 'Archivo'];

const CARDS_POS = ['5 28 42 15 -3', '48 22 42 15 2', '8 46 42 15 2', '50 50 42 15 -2', '6 68 42 15 3'].join('\n');
const CARDS = [
  '#2f5fd8|7 feb, sat|artcraft|studio workshop',
  '#e8601f|15 feb, sun|design|walk and letters',
  '#2f8f4a|7 mar, sat|artcraft|linocut session',
  '#2f5fd8|each wed|design|portfolio club',
  '#e8601f|each thu|artcraft|sketch club'
].join('\n');

export const ROTATED_CARDS_PROPS: Record<string, PropSpec> = {
  title: linesProp('Title, big serif, top', 'spring events\nat the studio'),
  titleColor: colourProp('Title colour', '#161616'),
  titleSize: numberProp('Title size (% of the width)', 8.4, 3, 14, 0.1),
  titleWeight: numberProp('Title weight', 600, 400, 900, 100, 'Style'),
  titleX: numberProp('Title, left %', 5, 0, 40, 0.5),
  titleY: numberProp('Title, top %', 3, 0, 30, 0.5),
  cardsPos: linesProp('Card positions: left %, top %, width %, height %, rotate deg', CARDS_POS),
  cards: linesProp('Cards: colour | date | hashtag | name', CARDS, 900),
  cardsTextColor: colourProp('Card text colour', '#ffffff'),
  yearTag: textProp('Year tag, bottom left', '2027', { maxLength: 10 }),
  yearTagColor: colourProp('Year tag colour', '#161616'),
  yearTagX: numberProp('Year tag, left %', 5, 0, 60, 0.5),
  yearTagY: numberProp('Year tag, top %', 90, 0, 97, 0.5),
  wordmark: textProp('Wordmark, next to the year tag', 'studio', { maxLength: 20 }),
  wordmarkColor: colourProp('Wordmark colour', '#161616'),
  wordmarkX: numberProp('Wordmark, left %', 16, 0, 70, 0.5),
  wordmarkY: numberProp('Wordmark, top %', 90, 0, 97, 0.5),
  marker: textProp('Word in the accent circle', 'new', { maxLength: 6 }),
  markerColor: colourProp('Circle colour', '#161616'),
  markerSize: numberProp('Circle size (% of the width)', 6, 2, 14, 0.1),
  markerX: numberProp('Circle, left %', 90, 0, 100, 0.5),
  markerY: numberProp('Circle, top %', 10, 0, 100, 0.5),
  index: textProp('Small index line, foot right', 'all details in the programme', { maxLength: 50 }),
  indexColor: colourProp('Index colour', '#8a8a8a'),
  indexX: numberProp('Index, left %', 55, 0, 90, 0.5),
  indexY: numberProp('Index, top %', 96, 0, 99, 0.5),
  paper: colourProp('Background colour', '#ffffff'),
  font: fontProp('Font', 'Fraunces'),
  [VAR_PREFIX]: prefixProp(ROTATED_CARDS_VAR_PREFIX)
};

export const rotatedCardsComponent = (): CustomComponent => posterComponent({ css: ROTATED_CARDS_CSS, js: ROTATED_CARDS_VIEW }, ROTATED_CARDS_PROPS);
