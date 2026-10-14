import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { POSTER_PHOTOS, colourProp, fontProp, linesProp, mediaProp, numberProp, posterComponent, prefixProp, textProp } from '../poster-kit';
import { SLICED_PHOTO_CSS, SLICED_PHOTO_VIEW } from './view';

export const SLICED_PHOTO_COMPONENT = 'SlicedPhotoPoster';
export const SLICED_PHOTO_VAR_PREFIX = 'slicedphoto';

export const SLICED_PHOTO_FONTS = ['Inter Tight', 'Inter', 'Archivo', 'Geist', 'Hanken Grotesk', 'Schibsted Grotesk', 'Space Grotesk'];

const PHRASES = ['SAY LESS', 'MEAN MORE', 'THEN', 'LOOK AGAIN', 'UNTIL IT', 'CLICKS'].join('\n');
const STRIPS = ['14 34 68', '-6 26 76', '4 10 66', '-10 22 98', '8 6 74', '-4 2 60', '12 30 64'].join('\n');

export const SLICED_PHOTO_PROPS: Record<string, PropSpec> = {
  phrases: linesProp('Phrases: corners and middle, left then right', PHRASES),
  photos: mediaProp('Photo, cut into strips'),
  strips: linesProp('Strips: shift down %, from %, to % of the photo', STRIPS),
  code: linesProp('Tiny code block, foot right', 'AB    20\n0000  27\n\nNOTES WITH\nNO WORDS'),
  marker: textProp('Number in the ring, top centre', '07', { maxLength: 4 }),
  index: textProp('Number prefix under each line', '', { maxLength: 4 }),
  caption: textProp('Vertical caption, left edge', 'cut, shifted, put back', { maxLength: 60 }),
  font: fontProp('Font', 'Inter Tight'),
  paper: colourProp('Background colour', '#f2581c'),
  ink: colourProp('Type and line colour', '#ffffff'),
  phraseSize: numberProp('Phrase size (% of the width)', 4.6, 2, 9, 0.1),
  photoSize: numberProp('Photo size (% of the width)', 78, 40, 100, 1),
  [VAR_PREFIX]: prefixProp(SLICED_PHOTO_VAR_PREFIX)
};

export const slicedPhotoComponent = (): CustomComponent => posterComponent({ css: SLICED_PHOTO_CSS, js: `${POSTER_PHOTOS}\n${SLICED_PHOTO_VIEW}` }, SLICED_PHOTO_PROPS);
