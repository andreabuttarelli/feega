import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { colourProp, fontProp, linesProp, numberProp, posterComponent, prefixProp, textProp } from '../poster-kit';
import { DARK_TAGS_CSS, DARK_TAGS_VIEW } from './view';

export const DARK_TAGS_COMPONENT = 'DarkTagsPoster';
export const DARK_TAGS_VAR_PREFIX = 'darktags';

export const DARK_TAGS_FONTS = ['Archivo', 'Inter Tight', 'Space Grotesk', 'Hanken Grotesk'];

const TAGS = [
  'first name|#c7e62f|6|8',
  'second act|#2f6fe6|48|6',
  'third name|#e6472f|10|26',
  'fourth act|#e62fa0|54|28',
  'fifth name|#c7e62f|6|52',
  'sixth act|#2f6fe6|50|54',
  'seventh name|#e6472f|14|74',
  'eighth act|#e62fa0|52|78'
].join('\n');

export const DARK_TAGS_PROPS: Record<string, PropSpec> = {
  title: linesProp('Title, huge, multi line', 'to the\nedge\nand\nback'),
  titleColor: colourProp('Title colour', '#cfcfcf'),
  titleFont: fontProp('Title font', 'Archivo'),
  titleSize: numberProp('Title size (% of the width)', 15, 5, 22, 0.1),
  titleWeight: numberProp('Title weight', 800, 400, 900, 100, 'Style'),
  titleX: numberProp('Title, left %', 2, 0, 30, 0.5),
  titleY: numberProp('Title, top %', -2, -10, 30, 0.5),
  tags: linesProp('Tags: text | colour | left %, top %', TAGS),
  tagsTextColor: colourProp('Tag text colour', '#0a0a0a'),
  tagsFont: fontProp('Tag font', 'Inter Tight'),
  tagsSize: numberProp('Tag text size (% of the width)', 2.2, 0.8, 4, 0.1),
  marker: textProp('Mark inside the framed box', '01', { maxLength: 6 }),
  markerColor: colourProp('Mark text colour', '#cfcfcf'),
  markerBorderColor: colourProp('Mark border colour', '#cfcfcf'),
  markerFont: fontProp('Mark font', 'Space Grotesk'),
  markerSize: numberProp('Mark size (% of the width)', 6, 2, 14, 0.1),
  markerX: numberProp('Mark, left %', 5, 0, 90, 0.5),
  markerY: numberProp('Mark, top %', 90, 0, 97, 0.5),
  index: textProp('Small index line, foot right', 'a season of new names', { maxLength: 50 }),
  indexColor: colourProp('Index colour', '#7a7a7a'),
  indexFont: fontProp('Index font', 'Space Grotesk'),
  indexSize: numberProp('Index size (% of the width)', 1.1, 0.4, 2.5, 0.1),
  indexX: numberProp('Index, left %', 55, 0, 90, 0.5),
  indexY: numberProp('Index, top %', 95, 0, 98, 0.5),
  paper: colourProp('Background colour', '#2b2b2b'),
  [VAR_PREFIX]: prefixProp(DARK_TAGS_VAR_PREFIX)
};

export const darkTagsComponent = (): CustomComponent => posterComponent({ css: DARK_TAGS_CSS, js: DARK_TAGS_VIEW }, DARK_TAGS_PROPS);
