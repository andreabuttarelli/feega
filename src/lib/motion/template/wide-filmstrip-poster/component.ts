import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { POSTER_ART, POSTER_PHOTOS, colourProp, fontProp, linesProp, mediaProp, numberProp, posterComponent, prefixProp, textProp } from '../poster-kit';
import { WIDE_FILMSTRIP_CSS, WIDE_FILMSTRIP_VIEW } from './view';

export const WIDE_FILMSTRIP_COMPONENT = 'WideFilmstripPoster';
export const WIDE_FILMSTRIP_VAR_PREFIX = 'widefilmstrip';

export const WIDE_FILMSTRIP_FONTS = ['Inter Tight', 'Inter', 'Familjen Grotesk', 'Hanken Grotesk', 'Geist', 'Schibsted Grotesk', 'Space Mono'];

const NOTES = ['EN | Opening night', 'at 7:00 pm', '', 'FR | Soirée d’ouverture', 'à 19:00'].join('\n');

export const WIDE_FILMSTRIP_PROPS: Record<string, PropSpec> = {
  title: textProp('Title, across the top', 'ELSEWHERE', { maxLength: 30 }),
  left: linesProp('Left column', 'Exhibition\n/ Show title\n\nFirst Name\nSurname'),
  notes: linesProp('Right column: paragraphs, the first line starts with a tag |', NOTES),
  photos: mediaProp('Photos in the film frames'),
  dates: linesProp('Dates, huge, at the foot', '00.00. –\n00.00.2027.'),
  venue: linesProp('Venue, next to the mark', 'Gallery Name\nSecond Line'),
  address: linesProp('Address, foot right', '00 Street Name\nTown'),
  counter: textProp('Frame number prefix on the strip', '0', { maxLength: 4 }),
  index: textProp('Line over the dates', 'show no. 07 — free entry', { maxLength: 60 }),
  caption: textProp('Vertical caption, right edge', 'a room of moving light', { maxLength: 60 }),
  font: fontProp('Font', 'Inter Tight'),
  titleWeight: numberProp('Title and date weight', 300, 100, 900, 100, 'Style'),
  paper: colourProp('Paper colour', '#ffffff'),
  ink: colourProp('Type colour', '#0a0a0a'),
  strip: colourProp('Film strip colour', '#0a0a0a'),
  tint: colourProp('Placeholder frame tint', '#ff2a3a'),
  [VAR_PREFIX]: prefixProp(WIDE_FILMSTRIP_VAR_PREFIX)
};

export const wideFilmstripComponent = (): CustomComponent => posterComponent({ css: WIDE_FILMSTRIP_CSS, js: `${POSTER_PHOTOS}\n${POSTER_ART}\n${WIDE_FILMSTRIP_VIEW}` }, WIDE_FILMSTRIP_PROPS);
