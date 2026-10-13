import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { colourProp, fontProp, linesProp, numberProp, posterComponent, prefixProp, textProp } from '../poster-kit';
import { BOXED_TYPE_CSS, BOXED_TYPE_VIEW } from './view';

export const BOXED_TYPE_COMPONENT = 'BoxedTypePoster';
export const BOXED_TYPE_VAR_PREFIX = 'boxedtype';

export const BOXED_TYPE_FONTS = ['Inter', 'Inter Tight', 'Hanken Grotesk', 'Host Grotesk', 'Geist', 'Schibsted Grotesk', 'Archivo'];

export const BOXED_TYPE_PROPS: Record<string, PropSpec> = {
  title: linesProp('Title, one boxed line per row', 'Posters\nWithout\nAny\nPictures?'),
  word: textProp('Big word in the dark box', 'YES.', { maxLength: 20 }),
  statement: linesProp('Statement, one boxed line per row', 'BECAUSE TYPE\nCAN CARRY\nA WHOLE\nSTORY'),
  note: linesProp('Small note beside the title', 'FIVE POSTER IDEAS THAT\nRELY ON LAYOUT, TYPE &\nSTYLE — NOT STOCK\nPHOTOS.'),
  tag1: linesProp('Tag, left', 'STUDIO NAME &\nDESIGN TEAM'),
  tag2: linesProp('Tag, centre', 'NOTES ON\nOUR DESIGN PROCESS'),
  tag3: linesProp('Tag, right', 'N.08'),
  font: fontProp('Font', 'Inter'),
  fontWeight: numberProp('Weight', 500, 300, 800, 100, 'Style'),
  paper: colourProp('Paper colour', '#d5d5d4'),
  ink: colourProp('Dark colour', '#2a2a2c'),
  highlight: colourProp('Title box colour', '#a1a1a1'),
  light: colourProp('Light box colour', '#f1f0f4'),
  rule: colourProp('Top rule colour', '#ee1c23'),
  titleSize: numberProp('Title size (% of the width)', 13.7, 5, 20, 0.1),
  wordSize: numberProp('Big word size (% of the width)', 28, 8, 40, 0.5),
  statementSize: numberProp('Statement size (% of the width)', 4.4, 2, 8, 0.05),
  tagSize: numberProp('Tags and note size (% of the width)', 1.65, 1, 3, 0.05),
  noteLine: numberProp('Note sits beside title line', 2, 1, 8, 1),
  wordLeft: numberProp('Dark box left edge (% of the width)', 32.5, 0, 70, 0.5),
  [VAR_PREFIX]: prefixProp(BOXED_TYPE_VAR_PREFIX)
};

export const boxedTypeComponent = (): CustomComponent => posterComponent({ css: BOXED_TYPE_CSS, js: BOXED_TYPE_VIEW }, BOXED_TYPE_PROPS);
