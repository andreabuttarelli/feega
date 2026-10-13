import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { colourProp, fontProp, linesProp, numberProp, posterComponent, prefixProp, textProp } from '../poster-kit';
import { BLOCK_TITLE_CSS, BLOCK_TITLE_VIEW } from './view';

export const BLOCK_TITLE_COMPONENT = 'BlockTitlePoster';
export const BLOCK_TITLE_VAR_PREFIX = 'blocktitle';

export const BLOCK_TITLE_FONTS = ['Rubik', 'Archivo', 'Familjen Grotesk', 'Bricolage Grotesque', 'Inter Tight', 'Schibsted Grotesk', 'Host Grotesk'];

const BODY = 'A short paragraph about the film goes here: what the story is, how it is told and why it stays with you. Three lines are enough to keep the foot of the poster quiet and even.';

export const BLOCK_TITLE_PROPS: Record<string, PropSpec> = {
  title: linesProp('Title, one line per row', 'everything\nwe never\nsaid aloud'),
  byline: linesProp('Line above the title', 'Name Surname & Name Surname'),
  names: linesProp('Names in the row, one per line', 'Name Surname\nName Surname\nName Surname\nName Surname'),
  body: linesProp('Paragraph at the foot', BODY, 800),
  blockNumber: textProp('Number in the block', '01', { maxLength: 6 }),
  blockLabel: textProp('Label in the block', 'FILM NO. 01 — FESTIVAL SELECTION', { maxLength: 60 }),
  caption: textProp('Vertical caption, right edge', 'IN CINEMAS SPRING 2027', { maxLength: 60 }),
  font: fontProp('Title font', 'Rubik'),
  textFont: fontProp('Text font', 'Inter Tight'),
  fontWeight: numberProp('Title weight', 800, 300, 900, 100, 'Style'),
  paper: colourProp('Paper colour', '#ebebea'),
  ink: colourProp('Type colour', '#262626'),
  block: colourProp('Block colour', '#6b63f4'),
  wear: numberProp('Worn print', 0.55, 0, 1, 0.05, 'Style'),
  fill: numberProp('Widest title line (share of the width)', 1, 0.5, 1, 0.01),
  leading: numberProp('Title line height (em)', 0.86, 0.7, 1.2, 0.01),
  overlap: numberProp('Block rises into the last line (em)', 0.34, 0, 0.8, 0.01),
  bylineSize: numberProp('Line above size (% of the width)', 2.9, 1, 6, 0.05),
  namesSize: numberProp('Names size (% of the width)', 3, 1, 6, 0.05),
  bodySize: numberProp('Paragraph size (% of the width)', 2.55, 1, 5, 0.05),
  [VAR_PREFIX]: prefixProp(BLOCK_TITLE_VAR_PREFIX)
};

export const blockTitleComponent = (): CustomComponent => posterComponent({ css: BLOCK_TITLE_CSS, js: BLOCK_TITLE_VIEW }, BLOCK_TITLE_PROPS);
