import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { POSTER_ART, POSTER_PHOTOS, colourProp, fontProp, linesProp, mediaProp, numberProp, posterComponent, prefixProp, textProp } from '../poster-kit';
import { CURATED_BOARD_CSS, CURATED_BOARD_VIEW } from './view';

export const CURATED_BOARD_COMPONENT = 'CuratedBoardPoster';
export const CURATED_BOARD_VAR_PREFIX = 'curatedboard';

export const CURATED_BOARD_FONTS = ['Inter Tight', 'Inter', 'Archivo', 'Geist', 'Space Grotesk', 'Space Mono', 'IBM Plex Mono', 'JetBrains Mono'];

const SLOTS = ['50 2', '15.5 10', '84.5 10', '-2 38.5', '102 38.5', '15.5 66', '84.5 66', '50 72'].join('\n');
const CAPTIONS = ['01 | studio name', '02 | name.studio', '03 | your_name', '04 | archive name', '05 | ab____________cd', '06 | studio two', '07 | name name', '08 | the archive'].join('\n');

export const CURATED_BOARD_PROPS: Record<string, PropSpec> = {
  title: textProp('Title, centre', 'STUDIO® BOARD', { maxLength: 40 }),
  tags: linesProp('Tags: the first alone, the rest in a row', '/WEEKLY PICKS\n/NO RULES\n/JUST WORK'),
  photos: mediaProp('Photos in the thumbnails'),
  slots: linesProp('Thumbnails: centre across %, top %', SLOTS),
  captions: linesProp('Captions under each thumbnail: number | name', CAPTIONS),
  issue: textProp('Corner line, top left', 'ISSUE 014 / WEEK 00', { maxLength: 40 }),
  caption: textProp('Corner line, top right', 'curated every week →', { maxLength: 40 }),
  marker: textProp('Number in the circle by the title', '08', { maxLength: 4 }),
  font: fontProp('Title font', 'Inter Tight'),
  mono: fontProp('Tag and caption font', 'Space Mono'),
  paper: colourProp('Board colour', '#ecebe9'),
  ink: colourProp('Type colour', '#141414'),
  accent: colourProp('Circle colour', '#ff4d1f'),
  titleSize: numberProp('Title size (% of the width)', 10.5, 4, 20, 0.1),
  thumbSize: numberProp('Thumbnail height (% of the height)', 24, 10, 40, 0.5),
  [VAR_PREFIX]: prefixProp(CURATED_BOARD_VAR_PREFIX)
};

export const curatedBoardComponent = (): CustomComponent => posterComponent({ css: CURATED_BOARD_CSS, js: `${POSTER_PHOTOS}\n${POSTER_ART}\n${CURATED_BOARD_VIEW}` }, CURATED_BOARD_PROPS);
