import { VAR_PREFIX, type CustomComponent, type PropSpec } from '$lib/motion/custom/component';
import { colourProp, fontProp, linesProp, numberProp, posterComponent, prefixProp, smallTextProps, textPartProps } from '../poster-kit';
import { STENCIL_STEPS_CSS, STENCIL_STEPS_VIEW } from './view';

export const STENCIL_STEPS_COMPONENT = 'StencilStepsPoster';
export const STENCIL_STEPS_VAR_PREFIX = 'stencil';

export const STENCIL_STEPS_FONTS = ['Archivo', 'Inter Tight', 'Bricolage Grotesque', 'Unbounded'];

const GREEN = '#22f53c';
const MAGENTA = '#ff1fd2';
const MOSS = '#3f8f2c';

const RECTS = [
  `8|6|18|8|${MAGENTA}`,
  `30|4|62|22|${GREEN}`,
  `36|6|12|9|${MOSS}`,
  `28|28|38|8|${MAGENTA}`,
  `22|36|56|16|${GREEN}`,
  `14|38|20|8|${MOSS}`,
  `40|46|46|6|${MAGENTA}`,
  `8|52|30|9|${MOSS}`,
  `34|56|62|20|${GREEN}`,
  `44|62|26|5|${MAGENTA}`,
  `12|72|30|11|${MAGENTA}`,
  `34|80|20|10|${GREEN}`
].join('\n');

const SYLLABLES = ['wal|14|6.5', 'ls of|36|20', 'col|22|34', 'our|44|48', 'and|30|62', '?|46|77'].join('\n');

const TAGS = ['→ example.org/festival|52|14.6', '→ example.org/programme|60|45', '→ example.org/map|38|58.4'].join('\n');

const INK = '#ffffff';

export const STENCIL_STEPS_PROPS: Record<string, PropSpec> = {
  rects: linesProp('Rectangles: left, top, width, height % | colour', RECTS),
  rectsColor: colourProp('Rectangle colour when a row has none', GREEN),
  syllables: linesProp('Stencil syllables: text | left %, top %', SYLLABLES),
  syllablesColor: colourProp('Syllable colour', '#0a0a0a'),
  syllablesFont: fontProp('Syllable font', 'Archivo'),
  syllablesSize: numberProp('Syllable size (% of the width)', 15, 6, 30, 0.5),
  syllablesCut: numberProp('Stencil cut height (% of a line)', 48, 10, 90, 1),
  tags: linesProp('Link tags: text | left %, top %', TAGS),
  tagsColor: colourProp('Tag colour', '#0a0a0a'),
  tagsTextColor: colourProp('Tag text colour', INK),
  ...textPartProps('title', 'Title labels, top right', 'City\nWall Art\nFestival', { color: INK, x: 74, y: 4.4, lines: true }),
  ...textPartProps('dates', 'Date labels', '15—24 X\n2027', { color: INK, x: 70, y: 28, lines: true }),
  ...textPartProps('program', 'Programme labels, foot right', 'murals\ninstallations\nexhibitions\nworkshops\nmusic\nfilms\ntalks', { color: INK, x: 70, y: 76, lines: true }),
  ...textPartProps('marker', 'Number label, foot left', 'ed. 06', { color: GREEN, x: 8, y: 90 }),
  ...textPartProps('index', 'Small credit label', 'partners — your names here', { color: INK, x: 8, y: 94.6 }),
  ...smallTextProps('Inter Tight', 3.4),
  paper: colourProp('Background colour', '#f7f7f5'),
  [VAR_PREFIX]: prefixProp(STENCIL_STEPS_VAR_PREFIX)
};

export const stencilStepsComponent = (): CustomComponent => posterComponent({ css: STENCIL_STEPS_CSS, js: STENCIL_STEPS_VIEW }, STENCIL_STEPS_PROPS);
