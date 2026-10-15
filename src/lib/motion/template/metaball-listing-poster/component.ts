import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { colourProp, fontProp, linesProp, numberProp, posterComponent, prefixProp, smallTextProps, textPartProps } from '../poster-kit';
import { METABALL_LISTING_CSS, METABALL_LISTING_VIEW } from './view';

export const METABALL_LISTING_COMPONENT = 'MetaballListingPoster';
export const METABALL_LISTING_VAR_PREFIX = 'metaballs';

export const METABALL_LISTING_FONTS = ['Inter Tight', 'Archivo', 'Hanken Grotesk', 'Space Grotesk'];

const EVENTS = [
  'FR 03.10|soul, funk|Back to Basics:|DJ First',
  'SA 04.10|indie, pop|Zero Hour:|Second Name / The Third',
  'TH 09.10|folk|Quiet Room|Fourth Name',
  'FR 10.10|electronic|Late Shift|Fifth Collective / Sixth',
  'SA 11.10|house, disco|Open Floor:|Seventh / Eighth Duo',
  'WE 15.10|jazz|Night Session|Ninth Quartet',
  'FR 17.10|afro, dance|Block Party:|Tenth Family / Eleventh / DJ Twelve',
  'SA 18.10|hip hop|New Voices|Thirteen / Fourteen',
  'FR 24.10|techno|Long Night:|Fifteen / Sixteen'
].join('\n');

const BLOBS = [
  '30|4|13', '42|10|9', '22|14|7', '58|3|6',
  '8|33|8', '20|40|11', '34|36|6', '62|44|12', '76|37|8', '88|48|9', '48|50|6',
  '18|72|9', '40|79|13', '54|70|7', '78|80|11', '92|72|6', '6|92|7'
].join('\n');

const WORDS = ['late-|2|11.5', 'nights|1|42.5', 'oct|46|75'].join('\n');

const INK = '#0a0a0a';

export const METABALL_LISTING_PROPS: Record<string, PropSpec> = {
  events: linesProp('Listing: date | genre | title | names / names', EVENTS, 1500),
  eventsColor: colourProp('Listing title and rule colour', INK),
  eventsMuteColor: colourProp('Listing names colour', '#9b9b9b'),
  eventsColumns: numberProp('Listing columns', 3, 1, 4, 1),
  words: linesProp('Huge words: text | left %, top %', WORDS),
  wordsColor: colourProp('Huge words colour', INK),
  wordsFont: fontProp('Huge words font', 'Inter Tight'),
  wordsSize: numberProp('Huge words size (% of the width)', 27, 10, 50, 0.5),
  wordsWeight: numberProp('Huge words weight', 600, 300, 900, 100, 'Style'),
  blobs: linesProp('Blobs: centre left %, top %, radius %', BLOBS),
  blobsColor: colourProp('Blob colour', '#f05ac0'),
  halftoneColor: colourProp('Halftone dot colour', '#c9c9c9'),
  ...textPartProps('footer', 'Venue lines, foot', 'Venue Name\nStreet 00, 0000 City\nexample.org', { color: INK, x: 23, y: 94.2, lines: true }),
  ...textPartProps('marker', 'Mark, foot left', '№ 10', { color: INK, x: 2.5, y: 95 }),
  ...textPartProps('index', 'Vertical index, right edge', 'autumn programme — doors 21:00', { color: '#6e6e6e', x: 98.6, y: 98 }),
  ...smallTextProps('Inter Tight', 2.9),
  paper: colourProp('Background colour', '#ffffff'),
  [VAR_PREFIX]: prefixProp(METABALL_LISTING_VAR_PREFIX)
};

export const metaballListingComponent = (): CustomComponent => posterComponent({ css: METABALL_LISTING_CSS, js: METABALL_LISTING_VIEW }, METABALL_LISTING_PROPS);
