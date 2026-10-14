import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { POSTER_ART, POSTER_PHOTOS, colourProp, fontProp, linesProp, mediaProp, numberProp, posterComponent, prefixProp, textProp } from '../poster-kit';
import { SCATTERED_TYPE_CSS, SCATTERED_TYPE_VIEW } from './view';

export const SCATTERED_TYPE_COMPONENT = 'ScatteredTypePoster';
export const SCATTERED_TYPE_VAR_PREFIX = 'scatteredtype';

export const SCATTERED_TYPE_FONTS = ['Archivo', 'Inter Tight', 'Familjen Grotesk', 'Hanken Grotesk', 'Geist', 'Space Grotesk', 'Space Mono'];

const BLOCKS = ['Place Name\n at the venue', 'Second line\n  of words', 'Opening\n 13–17 h', 'Archive', 'Archive', 'Town and\nweekend'].join('\n\n');
const PLACES = ['2.5 25 0', '62 40.5 0', '26 57 0', '88 13 90', '4.5 44 90', '85 55 90'].join('\n');
const SLOTS = ['62.5 17 24 26', '15 36 21 23', '62.5 58 15.5 17', '7 73 42 21.5'].join('\n');

export const SCATTERED_TYPE_PROPS: Record<string, PropSpec> = {
  dates: linesProp('Dates, top left', '00.00 –\n 00.00'),
  corner: textProp('Word, top right', 'Studio', { maxLength: 30 }),
  blocks: linesProp('Text blocks, one per paragraph', BLOCKS, 900),
  places: linesProp('Text block places: across %, down %, turn (0 or 90)', PLACES),
  photos: mediaProp('Photos'),
  slots: linesProp('Photos: across %, down %, width %, height % of width', SLOTS),
  tags: linesProp('Tags: across %, down % [o = accent circle with the marker]', '62.5 9\n7 65\n44 47 o'),
  tagText: textProp('Text in the black tags', '%', { maxLength: 4 }),
  time: linesProp('Time, huge, foot right', '6:00–\n8:00PM'),
  label: textProp('Black label, foot left', 'CLUB NAME', { maxLength: 30 }),
  marker: textProp('Word in the accent circle', 'new', { maxLength: 4 }),
  index: textProp('Number prefix over each photo', 'fig.', { maxLength: 6 }),
  caption: textProp('Line under the dates', 'a season of open studios', { maxLength: 60 }),
  font: fontProp('Font', 'Archivo'),
  paper: colourProp('Paper colour', '#f1f1f3'),
  ink: colourProp('Type colour', '#0c0c0c'),
  tint: colourProp('Placeholder photo tint', '#d9261c'),
  accent: colourProp('Circle colour', '#d9261c'),
  textSize: numberProp('Text size (% of the width)', 4.9, 2, 9, 0.1),
  [VAR_PREFIX]: prefixProp(SCATTERED_TYPE_VAR_PREFIX)
};

export const scatteredTypeComponent = (): CustomComponent => posterComponent({ css: SCATTERED_TYPE_CSS, js: `${POSTER_PHOTOS}\n${POSTER_ART}\n${SCATTERED_TYPE_VIEW}` }, SCATTERED_TYPE_PROPS);
