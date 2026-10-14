import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { colourProp, fontProp, linesProp, numberProp, posterComponent, prefixProp, textProp } from '../poster-kit';
import { REPEAT_LINEUP_CSS, REPEAT_LINEUP_VIEW } from './view';

export const REPEAT_LINEUP_COMPONENT = 'RepeatLineupPoster';
export const REPEAT_LINEUP_VAR_PREFIX = 'repeatlineup';

export const REPEAT_LINEUP_FONTS = ['Inter Tight', 'Inter', 'Archivo', 'Geist', 'Schibsted Grotesk', 'Hanken Grotesk'];

const INFO = ['00 Month 2027', 'Series Name', '00 Street Name, Town', '11pm–4am'].join('\n');

export const REPEAT_LINEUP_PROPS: Record<string, PropSpec> = {
  lineup: linesProp('Line-up, one name per line', 'Artist Name\nSecond Act\nThird'),
  info: linesProp('Info row under each repeat, one item per line', INFO),
  labels: textProp('Small label inside the ellipses', 'Night Meetings', { maxLength: 30 }),
  marker: textProp('Word in the circle by the first name', 'live', { maxLength: 6 }),
  index: textProp('Prefix of the number on each repeat', 'N°', { maxLength: 6 }),
  caption: textProp('Vertical caption, right edge', 'three rooms — one night only', { maxLength: 60 }),
  font: fontProp('Font', 'Inter Tight'),
  paper: colourProp('Paper colour', '#efefe8'),
  ink: colourProp('Type colour', '#111111'),
  blocks: colourProp('Block colour', '#d6ee1f'),
  bars: colourProp('Bar and highlight colour', '#c6c6c4'),
  lines: colourProp('Construction line colour', '#e0412a'),
  guides: colourProp('Guide line colour', '#3d8fe6'),
  accent: colourProp('Circle colour', '#2f4bff'),
  repeatSize: numberProp('Repeat height (% of the width)', 60, 30, 120, 1),
  nameSize: numberProp('Name size (% of the width)', 8.4, 3, 16, 0.1),
  [VAR_PREFIX]: prefixProp(REPEAT_LINEUP_VAR_PREFIX)
};

export const repeatLineupComponent = (): CustomComponent => posterComponent({ css: REPEAT_LINEUP_CSS, js: REPEAT_LINEUP_VIEW }, REPEAT_LINEUP_PROPS);
